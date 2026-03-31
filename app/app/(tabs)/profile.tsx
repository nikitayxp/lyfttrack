import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import {
  ActivityIndicator,
  Animated,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { EmptyState } from '@/components/common/EmptyState';
import { FeedCommentsModal } from '@/components/feed/FeedCommentsModal';
import { WorkoutFeedCard } from '@/components/feed/WorkoutFeedCard';
import {
  addComment,
  getCurrentCommentAuthorProfile,
  getWorkoutComments,
  toggleLike,
  type CommentAuthorProfile,
  type WorkoutCommentWithProfile,
} from '@/services/interactionService';
import { getProfile, type ProfileRow } from '@/services/profileService';
import { addWeight, getWeightHistory, type BodyMeasurementEntry } from '@/services/measurementService';
import { getAllTimePRs, getCurrentWorkoutStreak, type AllTimePR } from '@/services/statsService';
import { supabase } from '@/services/supabase';
import { getErrorMessage, getUserWorkouts, type WorkoutFeedItem } from '@/services/workoutService';
import { toSafeNumber } from '@/utils/inputValidation';

const palette = Colors.dark;
const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.surface;
const HISTORY_PAGE_SIZE = 20;

type FeedLikeInteractionState = {
  hasLiked: boolean;
  likesCount: number;
  isPending: boolean;
};

function initialsFromName(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function formatWeightKg(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '--';
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatDateShort(value: string): string {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return '--';
  }

  return new Date(timestamp).toLocaleDateString('pt-PT', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type WeightTrend = 'up' | 'down' | 'flat' | null;

function getWeightTrend(
  latest: BodyMeasurementEntry | null,
  previous: BodyMeasurementEntry | null
): { trend: WeightTrend; deltaText: string } {
  if (!latest || !previous) {
    return { trend: null, deltaText: 'Adiciona mais um registo para veres a tendencia' };
  }

  const delta = Number((latest.weight - previous.weight).toFixed(1));

  if (!Number.isFinite(delta) || delta === 0) {
    return {
      trend: 'flat',
      deltaText: 'Estavel face ao registo anterior',
    };
  }

  if (delta > 0) {
    return {
      trend: 'up',
      deltaText: `+${formatWeightKg(Math.abs(delta))} kg face ao registo anterior`,
    };
  }

  return {
    trend: 'down',
    deltaText: `-${formatWeightKg(Math.abs(delta))} kg face ao registo anterior`,
  };
}

type SkeletonCardProps = {
  compact?: boolean;
  lines?: number;
};

function SkeletonCard({ compact = false, lines = 3 }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <View style={[styles.skeletonCard, compact && styles.skeletonCardCompact]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Animated.View
          key={`skeleton-${index}`}
          style={[
            styles.skeletonLine,
            index === 0 ? styles.skeletonLineWide : styles.skeletonLineNarrow,
            { opacity },
          ]}
        />
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const isWeb = Platform.OS === 'web';
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const [workouts, setWorkouts] = useState<WorkoutFeedItem[]>([]);
  const [weightHistory, setWeightHistory] = useState<BodyMeasurementEntry[]>([]);
  const [allTimePrs, setAllTimePrs] = useState<AllTimePR[]>([]);
  const [currentWorkoutStreak, setCurrentWorkoutStreak] = useState(0);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isWeightModalVisible, setIsWeightModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [optimisticLikeState, setOptimisticLikeState] = useState<Record<string, FeedLikeInteractionState>>({});
  const [commentsByWorkoutId, setCommentsByWorkoutId] = useState<Record<string, WorkoutCommentWithProfile[]>>({});
  const [commentCountByWorkoutId, setCommentCountByWorkoutId] = useState<Record<string, number>>({});
  const [selectedWorkoutForComments, setSelectedWorkoutForComments] = useState<WorkoutFeedItem | null>(null);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [currentCommentAuthor, setCurrentCommentAuthor] = useState<CommentAuthorProfile | null>(null);
  const trophyCardRefsByExerciseId = useRef<Record<string, ViewShot | null>>({});
  const [sharingExerciseId, setSharingExerciseId] = useState<string | null>(null);

  const targetUserId = useMemo(() => {
    return profile?.id ?? authUserId;
  }, [authUserId, profile?.id]);

  const displayName = useMemo(() => {
    const profileName = profile?.full_name?.trim() || profile?.username?.trim() || '';
    const emailName = email.split('@')[0] ?? '';

    return profileName || emailName || 'Atleta';
  }, [email, profile?.full_name, profile?.username]);

  const usernameHandle = useMemo(() => {
    if (profile?.username?.trim()) {
      return `@${profile.username}`;
    }

    return '@atleta';
  }, [profile?.username]);

  const initials = useMemo(() => initialsFromName(displayName), [displayName]);

  const latestWeightEntry = weightHistory[0] ?? null;
  const previousWeightEntry = weightHistory[1] ?? null;
  const weightTrend = useMemo(
    () => getWeightTrend(latestWeightEntry, previousWeightEntry),
    [latestWeightEntry, previousWeightEntry]
  );

  const loadUserHistoryPage = useCallback(async (userId: string, pageToLoad: number, mode: 'reset' | 'append') => {
    if (mode === 'reset') {
      setHistoryError(null);
    }

    try {
      const data = await getUserWorkouts(userId, pageToLoad, HISTORY_PAGE_SIZE);

      if (mode === 'reset') {
        setWorkouts(data);
        setCurrentPage(0);
        setHasMore(data.length === HISTORY_PAGE_SIZE);

        setOptimisticLikeState((currentState) => {
          const validWorkoutIds = new Set(data.map((item) => item.id));
          const nextState: Record<string, FeedLikeInteractionState> = {};

          for (const [workoutId, state] of Object.entries(currentState)) {
            if (validWorkoutIds.has(workoutId)) {
              nextState[workoutId] = state;
            }
          }

          return nextState;
        });

        setCommentsByWorkoutId((currentState) => {
          const validWorkoutIds = new Set(data.map((item) => item.id));
          const nextState: Record<string, WorkoutCommentWithProfile[]> = {};

          for (const [workoutId, state] of Object.entries(currentState)) {
            if (validWorkoutIds.has(workoutId)) {
              nextState[workoutId] = state;
            }
          }

          return nextState;
        });

        setCommentCountByWorkoutId((currentState) => {
          const validWorkoutIds = new Set(data.map((item) => item.id));
          const nextState: Record<string, number> = {};

          for (const [workoutId, state] of Object.entries(currentState)) {
            if (validWorkoutIds.has(workoutId)) {
              nextState[workoutId] = state;
            }
          }

          return nextState;
        });

        return;
      }

      if (data.length === 0) {
        setHasMore(false);
        return;
      }

      setWorkouts((currentValue) => {
        const byId = new Map<string, WorkoutFeedItem>();

        for (const item of currentValue) {
          byId.set(item.id, item);
        }

        for (const item of data) {
          byId.set(item.id, item);
        }

        return [...byId.values()];
      });

      setCurrentPage(pageToLoad);
      setHasMore(data.length === HISTORY_PAGE_SIZE);
    } catch (error) {
      setHistoryError(getErrorMessage(error));
    }
  }, []);

  const loadPerformanceData = useCallback(async () => {
    setIsLoadingPerformance(true);
    setPerformanceError(null);

    try {
      const [weightEntries, personalRecords, weeklyStreak] = await Promise.all([
        getWeightHistory(),
        getAllTimePRs(),
        getCurrentWorkoutStreak(),
      ]);

      setWeightHistory(weightEntries);
      setAllTimePrs(personalRecords);
      setCurrentWorkoutStreak(weeklyStreak);
    } catch (error) {
      setPerformanceError(getErrorMessage(error));
      setCurrentWorkoutStreak(0);
    } finally {
      setIsLoadingPerformance(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    setIsLoadingPerformance(true);
    setProfileError(null);
    setHistoryError(null);
    setPerformanceError(null);

    try {
      const [{ data: authData }, profileData] = await Promise.all([supabase.auth.getUser(), getProfile()]);

      const resolvedAuthUserId = authData.user?.id ?? null;
      const resolvedUserId = profileData.id ?? resolvedAuthUserId;

      setAuthUserId(resolvedAuthUserId);
      setEmail(authData.user?.email ?? '');
      setProfile(profileData);

      if (!resolvedUserId) {
        throw new Error('ID do utilizador autenticado nao encontrado.');
      }

      await Promise.all([loadUserHistoryPage(resolvedUserId, 0, 'reset'), loadPerformanceData()]);
    } catch (error) {
      setProfileError(getErrorMessage(error));
    } finally {
      setIsBootstrapping(false);
    }
  }, [loadPerformanceData, loadUserHistoryPage]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const refreshProfileCard = useCallback(async () => {
    try {
      const profileData = await getProfile();
      setProfile(profileData);
      setProfileError(null);
    } catch (error) {
      setProfileError(getErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshProfileCard();
    }, [refreshProfileCard])
  );

  const onRefresh = useCallback(async () => {
    if (!targetUserId) {
      return;
    }

    setIsRefreshing(true);
    await Promise.all([loadUserHistoryPage(targetUserId, 0, 'reset'), loadPerformanceData()]);
    setIsRefreshing(false);
  }, [loadPerformanceData, loadUserHistoryPage, targetUserId]);

  const onEndReached = useCallback(async () => {
    if (!targetUserId || isBootstrapping || isRefreshing || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      await loadUserHistoryPage(targetUserId, currentPage + 1, 'append');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isBootstrapping, isLoadingMore, isRefreshing, loadUserHistoryPage, targetUserId]);

  const ensureCurrentCommentAuthor = useCallback(async (): Promise<CommentAuthorProfile | null> => {
    if (currentCommentAuthor) {
      return currentCommentAuthor;
    }

    try {
      const profileData = await getCurrentCommentAuthorProfile();
      setCurrentCommentAuthor(profileData);
      return profileData;
    } catch {
      return null;
    }
  }, [currentCommentAuthor]);

  const loadCommentsForWorkout = useCallback(async (workoutId: string) => {
    setCommentsError(null);
    setIsCommentsLoading(true);

    try {
      const comments = await getWorkoutComments(workoutId);

      setCommentsByWorkoutId((currentState) => ({
        ...currentState,
        [workoutId]: comments,
      }));

      setCommentCountByWorkoutId((currentState) => ({
        ...currentState,
        [workoutId]: comments.length,
      }));
    } catch (error) {
      setCommentsError(getErrorMessage(error));
    } finally {
      setIsCommentsLoading(false);
    }
  }, []);

  const handleOpenStats = useCallback(() => {
    router.push('/(tabs)/stats' as any);
  }, []);

  const handleOpenFriends = useCallback(() => {
    router.push('/(tabs)/social' as any);
  }, []);

  const handleEditProfile = useCallback(() => {
    router.push('/(tabs)/profile/edit' as any);
  }, []);

  const handleOpenSettings = useCallback(() => {
    router.push('/(tabs)/profile/settings' as any);
  }, []);

  const handleStartFreeWorkout = useCallback(() => {
    router.push('/workout/active' as any);
  }, []);

  const openCommentsModal = useCallback(
    (workout: WorkoutFeedItem) => {
      setSelectedWorkoutForComments(workout);
      setCommentInputValue('');
      setCommentsError(null);
      void ensureCurrentCommentAuthor();
      void loadCommentsForWorkout(workout.id);
    },
    [ensureCurrentCommentAuthor, loadCommentsForWorkout]
  );

  const closeCommentsModal = useCallback(() => {
    setSelectedWorkoutForComments(null);
    setCommentInputValue('');
    setCommentsError(null);
  }, []);

  const sendComment = useCallback(async () => {
    if (!selectedWorkoutForComments || isSendingComment) {
      return;
    }

    const workoutId = selectedWorkoutForComments.id;
    const trimmedComment = commentInputValue.trim();

    if (!trimmedComment) {
      return;
    }

    const author = currentCommentAuthor;
    const optimisticCommentId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticComment: WorkoutCommentWithProfile = {
      id: optimisticCommentId,
      workout_id: workoutId,
      user_id: author?.id ?? 'optimistic-author',
      content: trimmedComment,
      created_at: new Date().toISOString(),
      profile: author,
    };

    setCommentInputValue('');
    setIsSendingComment(true);

    setCommentsByWorkoutId((currentState) => {
      const currentComments = currentState[workoutId] ?? [];

      return {
        ...currentState,
        [workoutId]: [...currentComments, optimisticComment],
      };
    });

    setCommentCountByWorkoutId((currentState) => {
      const baseCount = currentState[workoutId] ?? selectedWorkoutForComments.comments_count;

      return {
        ...currentState,
        [workoutId]: baseCount + 1,
      };
    });

    try {
      const savedComment = await addComment(workoutId, trimmedComment);

      setCommentsByWorkoutId((currentState) => {
        const currentComments = currentState[workoutId] ?? [];

        return {
          ...currentState,
          [workoutId]: currentComments.map((comment) => {
            if (comment.id !== optimisticCommentId) {
              return comment;
            }

            return {
              id: savedComment.id,
              workout_id: savedComment.workout_id,
              user_id: savedComment.user_id,
              content: savedComment.content,
              created_at: savedComment.created_at,
              profile: comment.profile,
            };
          }),
        };
      });

      void loadCommentsForWorkout(workoutId);
      void ensureCurrentCommentAuthor();
    } catch (error) {
      setCommentsByWorkoutId((currentState) => {
        const currentComments = currentState[workoutId] ?? [];

        return {
          ...currentState,
          [workoutId]: currentComments.filter((comment) => comment.id !== optimisticCommentId),
        };
      });

      setCommentCountByWorkoutId((currentState) => {
        const baseCount = currentState[workoutId] ?? selectedWorkoutForComments.comments_count + 1;

        return {
          ...currentState,
          [workoutId]: Math.max(0, baseCount - 1),
        };
      });

      setCommentInputValue(trimmedComment);
      Alert.alert('Nao foi possivel adicionar o comentario', getErrorMessage(error));
    } finally {
      setIsSendingComment(false);
    }
  }, [
    commentInputValue,
    currentCommentAuthor,
    ensureCurrentCommentAuthor,
    isSendingComment,
    loadCommentsForWorkout,
    selectedWorkoutForComments,
  ]);

  const handleToggleLike = useCallback(async (workout: WorkoutFeedItem) => {
    let previousState: FeedLikeInteractionState | undefined;
    let optimisticState: FeedLikeInteractionState | null = null;

    setOptimisticLikeState((currentState) => {
      previousState = currentState[workout.id];

      if (previousState?.isPending) {
        return currentState;
      }

      const currentHasLiked = previousState?.hasLiked ?? workout.has_liked;
      const currentLikesCount = previousState?.likesCount ?? workout.likes_count;

      optimisticState = {
        hasLiked: !currentHasLiked,
        likesCount: Math.max(0, currentLikesCount + (!currentHasLiked ? 1 : -1)),
        isPending: true,
      };

      return {
        ...currentState,
        [workout.id]: optimisticState,
      };
    });

    if (!optimisticState) {
      return;
    }

    const optimisticSnapshot = optimisticState;

    try {
      const result = await toggleLike(workout.id);

      setOptimisticLikeState((currentState) => {
        const existingState = currentState[workout.id] ?? optimisticSnapshot;
        let resolvedLikesCount = existingState.likesCount;

        if (result.liked !== existingState.hasLiked) {
          resolvedLikesCount = Math.max(0, existingState.likesCount + (result.liked ? 1 : -1));
        }

        return {
          ...currentState,
          [workout.id]: {
            hasLiked: result.liked,
            likesCount: resolvedLikesCount,
            isPending: false,
          },
        };
      });
    } catch (error) {
      setOptimisticLikeState((currentState) => {
        const nextState = { ...currentState };

        if (previousState) {
          nextState[workout.id] = {
            ...previousState,
            isPending: false,
          };
        } else {
          delete nextState[workout.id];
        }

        return nextState;
      });

      Alert.alert('Nao foi possivel atualizar o gosto', getErrorMessage(error));
    }
  }, []);

  const openWeightModal = useCallback(() => {
    const initialValue = latestWeightEntry ? formatWeightKg(latestWeightEntry.weight) : '';
    setWeightInput(initialValue === '--' ? '' : initialValue);
    setIsWeightModalVisible(true);
  }, [latestWeightEntry]);

  const closeWeightModal = useCallback(() => {
    if (isSavingWeight) {
      return;
    }

    setIsWeightModalVisible(false);
    setWeightInput('');
  }, [isSavingWeight]);

  const handleSaveWeight = useCallback(async () => {
    if (isSavingWeight) {
      return;
    }

    const parsedValue = toSafeNumber(weightInput, {
      min: 0,
      max: 500,
      decimals: 2,
    });

    if (parsedValue === null || parsedValue <= 0) {
      Alert.alert('Validacao', 'Introduz um peso valido em kg.');
      return;
    }

    setIsSavingWeight(true);

    try {
      await addWeight(parsedValue);
      const nextHistory = await getWeightHistory();
      setWeightHistory(nextHistory);
      setIsWeightModalVisible(false);
      setWeightInput('');
    } catch (error) {
      Alert.alert('Nao foi possivel guardar o peso', getErrorMessage(error));
    } finally {
      setIsSavingWeight(false);
    }
  }, [isSavingWeight, weightInput]);

  const handleShareTrophyCard = useCallback(
    async (pr: AllTimePR) => {
      if (sharingExerciseId) {
        return;
      }

      setSharingExerciseId(pr.exerciseId);

      try {
        const isSharingAvailable = await Sharing.isAvailableAsync();

        if (!isSharingAvailable) {
          Alert.alert('Partilha indisponivel', 'Este dispositivo nao consegue abrir o menu nativo de partilha nesta plataforma.');
          return;
        }

        const shotRef = trophyCardRefsByExerciseId.current[pr.exerciseId];

        if (!shotRef || typeof shotRef.capture !== 'function') {
          throw new Error('Nao foi possivel capturar este cartao de PR agora.');
        }

        const captureUri = await shotRef.capture();

        if (!captureUri) {
          throw new Error('Nao foi possivel capturar este cartao de PR agora.');
        }

        await Sharing.shareAsync(captureUri, {
          mimeType: 'image/png',
          dialogTitle: `${pr.exerciseName} PR`,
          UTI: 'public.png',
        });
      } catch (error) {
        Alert.alert('Nao foi possivel partilhar o cartao de PR', getErrorMessage(error));
      } finally {
        setSharingExerciseId(null);
      }
    },
    [sharingExerciseId, trophyCardRefsByExerciseId]
  );

  const headerComponent = useMemo(() => {
    return (
      <View style={styles.headerWrap}>
        {profileError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Nao foi possivel carregar o perfil</Text>
            <Text style={styles.errorText}>{profileError}</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={() => void bootstrap()}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroTopBar}>
            <TouchableOpacity style={styles.settingsButton} activeOpacity={0.88} onPress={handleOpenSettings}>
              <Ionicons name="settings-outline" size={18} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.avatarFrame}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initials}</Text>
              </View>
            )}
          </View>

          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.handle}>{usernameHandle}</Text>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionTile}
              activeOpacity={0.9}
              onPress={handleOpenStats}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="stats-chart-outline" size={18} color={palette.accent} />
              </View>
              <Text style={styles.quickActionTileText}>Estatisticas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTile}
              activeOpacity={0.9}
              onPress={handleOpenFriends}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="people-outline" size={18} color={palette.accent} />
              </View>
              <Text style={styles.quickActionTileText}>Amigos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTile}
              activeOpacity={0.9}
              onPress={handleEditProfile}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="create-outline" size={18} color={palette.accent} />
              </View>
              <Text style={styles.quickActionTileText}>Editar Perfil</Text>
            </TouchableOpacity>
          </View>
        </View>



        <View style={styles.bodyProgressCard}>
          <View style={styles.bodyProgressHeaderRow}>
            <View style={styles.bodyProgressHeaderTextWrap}>
              <Text style={styles.bodyProgressTitle}>Progresso corporal</Text>
              <Text style={styles.bodyProgressSubtitle}>Acompanha o teu peso e tendencia semanal.</Text>
            </View>

            <TouchableOpacity style={styles.weightAddButton} activeOpacity={0.88} onPress={openWeightModal}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.bodyWeightPrimaryRow}>
            <Text style={styles.bodyWeightValue}>
              {latestWeightEntry ? `${formatWeightKg(latestWeightEntry.weight)} kg` : '--'}
            </Text>
            {latestWeightEntry ? <Text style={styles.bodyWeightMeta}>{formatDateShort(latestWeightEntry.recorded_at)}</Text> : null}
          </View>

          <View style={styles.bodyTrendBadge}>
            <Ionicons
              name={
                weightTrend.trend === 'up'
                  ? 'trending-up-outline'
                  : weightTrend.trend === 'down'
                    ? 'trending-down-outline'
                    : 'remove-outline'
              }
              size={14}
              color={
                weightTrend.trend === 'up'
                  ? palette.error
                  : weightTrend.trend === 'down'
                    ? palette.success
                    : palette.textMuted
              }
            />
            <Text style={styles.bodyTrendText}>{weightTrend.deltaText}</Text>
          </View>
        </View>

        <View style={styles.hallWrap}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Sala de Trofeus</Text>
            <View style={styles.sectionPill}>
              <Text style={styles.sectionPillText}>Recordes pessoais</Text>
            </View>
          </View>

          {isLoadingPerformance ? (
            <SkeletonCard compact lines={3} />
          ) : performanceError ? (
            <View style={styles.historyErrorCard}>
              <Text style={styles.historyErrorTitle}>Nao foi possivel carregar o resumo de performance</Text>
              <Text style={styles.historyErrorText}>{performanceError}</Text>
            </View>
          ) : allTimePrs.length === 0 ? (
            <View style={styles.statusCardCompact}>
              <Text style={styles.statusTitle}>Sem trofeus ainda</Text>
              <Text style={styles.statusText}>Conclui mais treinos para desbloquear os teus cartoes de recorde.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={isWeb} contentContainerStyle={styles.trophyCarouselContent}>
              {allTimePrs.map((pr) => (
                <View key={pr.exerciseId} style={styles.trophyCardShell}>
                  <ViewShot
                    ref={(ref) => {
                      trophyCardRefsByExerciseId.current[pr.exerciseId] = ref;
                    }}
                    options={{ format: 'png', quality: 1, result: 'tmpfile' }}
                  >
                    <View style={styles.trophyCard}>
                      <View style={styles.trophyBadge}>
                        <Ionicons name="trophy" size={14} color="#FFFFFF" />
                      </View>

                      <Text style={styles.trophyExerciseName} numberOfLines={2}>
                        {pr.exerciseName}
                      </Text>
                      <Text style={styles.trophyValue}>{`${formatWeightKg(pr.maxWeight)} kg`}</Text>
                      <Text style={styles.trophyDate}>{formatDateShort(pr.achievedAt)}</Text>
                    </View>
                  </ViewShot>

                  <TouchableOpacity
                    style={styles.trophyShareButton}
                    activeOpacity={0.88}
                    onPress={() => void handleShareTrophyCard(pr)}
                    disabled={sharingExerciseId !== null}
                  >
                    {sharingExerciseId === pr.exerciseId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="share-social-outline" size={15} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Meus Treinos</Text>
          <View style={styles.sectionPill}>
            <Text style={styles.sectionPillText}>Histórico</Text>
          </View>
        </View>

        {historyError ? (
          <View style={styles.historyErrorCard}>
            <Text style={styles.historyErrorTitle}>Nao foi possivel carregar o historico de treinos</Text>
            <Text style={styles.historyErrorText}>{historyError}</Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    allTimePrs,
    bootstrap,
    displayName,
    handleEditProfile,
    handleOpenFriends,
    handleOpenSettings,
    handleOpenStats,
    historyError,
    initials,
    isLoadingPerformance,
    latestWeightEntry,
    currentWorkoutStreak,
    openWeightModal,
    performanceError,
    profile?.avatar_url,
    profileError,
    sharingExerciseId,
    usernameHandle,
    handleShareTrophyCard,
    weightTrend,
  ]);

  const emptyComponent = useMemo(() => {
    if (isBootstrapping) {
      return <SkeletonCard lines={3} />;
    }

    if (historyError) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Historico indisponivel"
          description={historyError}
          containerStyle={styles.statusCard}
          descriptionStyle={styles.statusText}
        />
      );
    }

    return (
      <EmptyState
        icon="barbell-outline"
        title="Sem treinos registados"
        description="Inicia um treino livre para desbloquear historico, recordes e consistencia semanal."
        actionLabel="Iniciar treino livre"
        onActionPress={handleStartFreeWorkout}
        containerStyle={styles.statusCard}
        descriptionStyle={styles.statusText}
      />
    );
  }, [handleStartFreeWorkout, historyError, isBootstrapping]);

  const selectedWorkoutComments = selectedWorkoutForComments
    ? commentsByWorkoutId[selectedWorkoutForComments.id] ?? []
    : [];

  const ModalWrapper = isWeb ? View : Modal;

  return (
    <>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const interactionState = optimisticLikeState[item.id];

          return (
            <WorkoutFeedCard
              workout={item}
              likeCount={interactionState?.likesCount ?? item.likes_count}
              commentsCount={commentCountByWorkoutId[item.id] ?? item.comments_count}
              hasLiked={interactionState?.hasLiked ?? item.has_liked}
              isLikePending={interactionState?.isPending ?? false}
              onToggleLike={() => void handleToggleLike(item)}
              onOpenComments={() => openCommentsModal(item)}
            />
          );
        }}
        style={styles.screen}
        contentContainerStyle={styles.content}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoadingWrap}>
              <ActivityIndicator size="small" color={palette.accent} />
            </View>
          ) : null
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => void onEndReached()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={palette.accent} />
        }
        showsVerticalScrollIndicator={false}
      />

      {(!isWeightModalVisible && isWeb) ? null : (
      <ModalWrapper
        {...(isWeb 
          ? { style: [StyleSheet.absoluteFill, { zIndex: 10000 }] } 
          : { visible: isWeightModalVisible, transparent: true, animationType: 'fade' as const, onRequestClose: closeWeightModal })}
      >
        <View style={[styles.quickLogBackdrop, isWeb && styles.quickLogBackdropWeb]}>
          <Pressable style={styles.quickLogDismissArea} onPress={closeWeightModal} />

          <View style={[styles.quickLogCard, isWeb && styles.quickLogCardWeb]}>
            <Text style={styles.quickLogTitle}>Registar peso</Text>
            <Text style={styles.quickLogSubtitle}>Regista o teu peso corporal de hoje em kg.</Text>

            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="Ex: 79.4"
              placeholderTextColor={palette.textMuted}
              style={styles.quickLogInput}
              editable={!isSavingWeight}
              maxLength={8}
            />

            <View style={styles.quickLogActionsRow}>
              <TouchableOpacity
                style={styles.quickLogCancelButton}
                activeOpacity={0.88}
                onPress={closeWeightModal}
                disabled={isSavingWeight}
              >
                <Text style={styles.quickLogCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLogSaveButton, isSavingWeight && styles.quickLogSaveButtonDisabled]}
                activeOpacity={0.88}
                onPress={() => void handleSaveWeight()}
                disabled={isSavingWeight}
              >
                {isSavingWeight ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.quickLogSaveText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ModalWrapper>
      )}

      <FeedCommentsModal
        visible={selectedWorkoutForComments !== null}
        workoutName={selectedWorkoutForComments?.name ?? 'Treino'}
        comments={selectedWorkoutComments}
        isLoading={isCommentsLoading}
        isSending={isSendingComment}
        errorMessage={commentsError}
        inputValue={commentInputValue}
        onChangeInput={setCommentInputValue}
        onClose={closeCommentsModal}
        onSend={() => void sendComment()}
        onRetry={() => {
          if (!selectedWorkoutForComments) {
            return;
          }

          void loadCommentsForWorkout(selectedWorkoutForComments.id);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  headerWrap: {
    marginBottom: 8,
  },
  errorCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  errorTitle: {
    color: palette.error,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  errorText: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  retryButton: {
    marginTop: 8,
    minHeight: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTopBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakHeroCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  streakKicker: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  streakHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    marginBottom: 2,
  },
  streakHeadline: {
    color: palette.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  streakSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  avatarFrame: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 4,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  avatarFallbackText: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '900',
  },
  displayName: {
    color: palette.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 0,
    letterSpacing: -0.9,
  },
  handle: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  quickActionsGrid: {
    width: '100%',
    flexDirection: 'row',
    columnGap: 10,
  },
  quickActionTile: {
    flex: 1,
    minHeight: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 8,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  quickActionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTileText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  bodyProgressCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  bodyProgressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    columnGap: 6,
  },
  bodyProgressHeaderTextWrap: {
    flex: 1,
  },
  bodyProgressTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 1,
  },
  bodyProgressSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  weightAddButton: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyWeightPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  bodyWeightValue: {
    color: palette.textPrimary,
    fontSize: 42,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  bodyWeightMeta: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  bodyTrendBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
  },
  bodyTrendText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  hallWrap: {
    marginBottom: 14,
  },
  statusCardCompact: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  skeletonCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    minHeight: 80,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    rowGap: 6,
  },
  skeletonCardCompact: {
    minHeight: 64,
  },
  skeletonLine: {
    height: 6,
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  skeletonLineWide: {
    width: '88%',
    alignSelf: 'center',
  },
  skeletonLineNarrow: {
    width: '64%',
    alignSelf: 'center',
  },
  trophyCarouselContent: {
    columnGap: 6,
    paddingRight: 2,
  },
  trophyCardShell: {
    position: 'relative',
  },
  trophyCard: {
    width: 138,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trophyBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: '#000000',
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginBottom: 6,
  },
  trophyExerciseName: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    minHeight: 28,
    marginBottom: 4,
  },
  trophyValue: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  trophyDate: {
    marginTop: 2,
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  trophyShareButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  sectionPill: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionPillText: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  historyErrorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  historyErrorTitle: {
    color: palette.error,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 3,
  },
  historyErrorText: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  statusCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statusTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 3,
    textAlign: 'center',
  },
  statusText: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },
  footerLoadingWrap: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: palette.overlay,
    paddingHorizontal: 12,
  },
  quickLogBackdropWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    left: 0,
    right: 0,
    alignSelf: 'center',
  },
  quickLogDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  quickLogCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  quickLogCardWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: CARD_BG,
  },
  quickLogTitle: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: -0.8,
  },
  quickLogSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  quickLogInput: {
    minHeight: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    color: palette.textPrimary,
    paddingHorizontal: 10,
    fontSize: 20,
    fontWeight: '900',
  },
  quickLogActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    columnGap: 6,
  },
  quickLogCancelButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogCancelText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  quickLogSaveButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogSaveButtonDisabled: {
    opacity: 0.75,
  },
  quickLogSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
