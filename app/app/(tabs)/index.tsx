import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import {
  addComment,
  getCurrentCommentAuthorProfile,
  getWorkoutComments,
  toggleLike,
  type CommentAuthorProfile,
  type WorkoutCommentWithProfile,
} from '@/services/interactionService';
import { getActiveUsers, type SocialSearchResult } from '@/services/socialService';
import { getErrorMessage, getFeedWorkouts, type WorkoutFeedItem } from '@/services/workoutService';
import { EmptyState } from '@/components/common/EmptyState';
import { FeedCommentsModal } from '@/components/feed/FeedCommentsModal';
import { WorkoutFeedCard } from '@/components/feed/WorkoutFeedCard';

const palette = Colors.dark;
const SCREEN_BG = '#000000';
const CARD_BG = '#111111';
const FEED_PAGE_SIZE = 20;
const ACTIVE_USERS_SEARCH_LIMIT = 40;

type FeedLikeInteractionState = {
  hasLiked: boolean;
  likesCount: number;
  isPending: boolean;
};

function displayNameOf(profile: SocialSearchResult): string {
  return profile.full_name?.trim() || profile.username;
}

function initialsOf(profile: SocialSearchResult): string {
  return displayNameOf(profile)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function relationLabel(relation: SocialSearchResult['relation']): string {
  if (relation === 'friends') return 'Amigos';
  if (relation === 'request_sent') return 'Enviado';
  if (relation === 'request_received') return 'Recebido';
  return 'Atleta';
}

export default function FeedScreen() {
  const searchInputRef = useRef<TextInput | null>(null);
  const athleteSearchRequestRef = useRef(0);

  const [workouts, setWorkouts] = useState<WorkoutFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [optimisticLikeState, setOptimisticLikeState] = useState<Record<string, FeedLikeInteractionState>>({});
  const [commentsByWorkoutId, setCommentsByWorkoutId] = useState<Record<string, WorkoutCommentWithProfile[]>>({});
  const [commentCountByWorkoutId, setCommentCountByWorkoutId] = useState<Record<string, number>>({});
  const [selectedWorkoutForComments, setSelectedWorkoutForComments] = useState<WorkoutFeedItem | null>(null);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [currentCommentAuthor, setCurrentCommentAuthor] = useState<CommentAuthorProfile | null>(null);
  const [athleteQuery, setAthleteQuery] = useState('');
  const [activeUsers, setActiveUsers] = useState<SocialSearchResult[]>([]);
  const [isLoadingActiveUsers, setIsLoadingActiveUsers] = useState(false);
  const [activeUsersError, setActiveUsersError] = useState<string | null>(null);

  const loadFeedPage = useCallback(async (pageToLoad: number, mode: 'reset' | 'append') => {
    if (mode === 'reset') {
      setFeedError(null);
    }

    try {
      const data = await getFeedWorkouts(pageToLoad, FEED_PAGE_SIZE);

      if (mode === 'reset') {
        setWorkouts(data);
        setCurrentPage(0);
        setHasMore(data.length === FEED_PAGE_SIZE);

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

      setWorkouts((currentState) => {
        const byWorkoutId = new Map<string, WorkoutFeedItem>();

        for (const workout of currentState) {
          byWorkoutId.set(workout.id, workout);
        }

        for (const workout of data) {
          byWorkoutId.set(workout.id, workout);
        }

        return [...byWorkoutId.values()];
      });

      setCurrentPage(pageToLoad);
      setHasMore(data.length === FEED_PAGE_SIZE);
    } catch (error) {
      setFeedError(getErrorMessage(error));
    }
  }, []);

  const loadActiveUsers = useCallback(async (queryValue: string) => {
    const normalizedQuery = queryValue.trim();

    if (normalizedQuery.length === 0) {
      athleteSearchRequestRef.current += 1;
      setActiveUsers([]);
      setActiveUsersError(null);
      setIsLoadingActiveUsers(false);
      return;
    }

    const requestId = ++athleteSearchRequestRef.current;

    setIsLoadingActiveUsers(true);
    setActiveUsersError(null);

    try {
      const users = await getActiveUsers(normalizedQuery, ACTIVE_USERS_SEARCH_LIMIT);

      if (requestId !== athleteSearchRequestRef.current) {
        return;
      }

      setActiveUsers(users);
    } catch (error) {
      if (requestId !== athleteSearchRequestRef.current) {
        return;
      }

      setActiveUsers([]);
      setActiveUsersError(getErrorMessage(error));
    } finally {
      if (requestId === athleteSearchRequestRef.current) {
        setIsLoadingActiveUsers(false);
      }
    }
  }, []);

  const openPublicProfile = useCallback((userId: string) => {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      return;
    }

    router.push({
      pathname: '/(tabs)/profile/[id]' as any,
      params: { id: normalizedUserId },
    });
  }, []);

  const focusAthleteSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const ensureCurrentCommentAuthor = useCallback(async (): Promise<CommentAuthorProfile | null> => {
    if (currentCommentAuthor) {
      return currentCommentAuthor;
    }

    try {
      const profile = await getCurrentCommentAuthorProfile();
      setCurrentCommentAuthor(profile);
      return profile;
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

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      await loadFeedPage(0, 'reset');
      setIsLoading(false);
    };

    void run();
  }, [loadFeedPage]);

  useEffect(() => {
    const normalizedQuery = athleteQuery.trim();

    if (normalizedQuery.length === 0) {
      athleteSearchRequestRef.current += 1;
      setActiveUsers([]);
      setActiveUsersError(null);
      setIsLoadingActiveUsers(false);
      return;
    }

    const timer = setTimeout(() => {
      void loadActiveUsers(normalizedQuery);
    }, 260);

    return () => clearTimeout(timer);
  }, [athleteQuery, loadActiveUsers]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadFeedPage(0, 'reset'),
      athleteQuery.trim().length > 0 ? loadActiveUsers(athleteQuery) : Promise.resolve(),
    ]);
    setIsRefreshing(false);
  }, [athleteQuery, loadActiveUsers, loadFeedPage]);

  const onEndReached = useCallback(async () => {
    if (isLoading || isRefreshing || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      await loadFeedPage(currentPage + 1, 'append');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isLoading, isLoadingMore, isRefreshing, loadFeedPage]);

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
      Alert.alert('Nao foi possivel publicar o comentario', getErrorMessage(error));
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

  const headerTitle = useMemo(() => {
    const hasAthleteQuery = athleteQuery.trim().length > 0;

    return (
      <View style={styles.headerWrap}>
        <Text style={styles.title}>FEED DE TREINO</Text>
        <Text style={styles.subtitle}>As tuas ultimas sessoes e os treinos da tua rede.</Text>

        <View style={styles.athleteSearchCard}>
          <View style={styles.athleteSearchInputWrap}>
            <Ionicons name="search-outline" size={16} color={palette.textMuted} />
            <TextInput
              ref={searchInputRef}
              value={athleteQuery}
              onChangeText={setAthleteQuery}
              style={styles.athleteSearchInput}
              placeholder="Pesquisar atletas..."
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {hasAthleteQuery ? isLoadingActiveUsers ? (
            <View style={styles.athleteStatusRow}>
              <ActivityIndicator size="small" color={palette.accent} />
              <Text style={styles.athleteStatusText}>A pesquisar atletas...</Text>
            </View>
          ) : activeUsersError ? (
            <View style={styles.athleteStatusRow}>
              <Text style={styles.athleteErrorText}>{activeUsersError}</Text>
            </View>
          ) : activeUsers.length === 0 ? (
            <View style={styles.athleteStatusRow}>
              <Text style={styles.athleteStatusText}>Sem resultados para esta pesquisa.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.athleteRailContent}
            >
              {activeUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.athleteRailItem}
                  activeOpacity={0.88}
                  onPress={() => openPublicProfile(user.id)}
                >
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.athleteAvatar} />
                  ) : (
                    <View style={styles.athleteAvatarFallback}>
                      <Text style={styles.athleteAvatarFallbackText}>{initialsOf(user)}</Text>
                    </View>
                  )}

                  <View style={styles.athleteMetaWrap}>
                    <Text style={styles.athleteName} numberOfLines={1}>
                      {displayNameOf(user)}
                    </Text>
                    <Text style={styles.athleteHandle} numberOfLines={1}>
                      @{user.username}
                    </Text>
                  </View>

                  <View style={styles.relationPill}>
                    <Text style={styles.relationPillText}>{relationLabel(user.relation)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    );
  }, [activeUsers, activeUsersError, athleteQuery, isLoadingActiveUsers, openPublicProfile]);

  const emptyState = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.statusCard}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>A carregar feed...</Text>
        </View>
      );
    }

    if (feedError) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Nao foi possivel carregar o feed"
          description={feedError}
          actionLabel="Tentar novamente"
          onActionPress={() => {
            void loadFeedPage(0, 'reset');
          }}
          containerStyle={styles.statusCard}
          descriptionStyle={styles.statusText}
        />
      );
    }

    return (
      <EmptyState
        icon="trophy-outline"
        title="Feed vazio por enquanto"
        description="Segue atletas e amigos para encontrares novos treinos e manteres a motivacao diária."
        actionLabel="Explorar atletas"
        onActionPress={focusAthleteSearch}
        containerStyle={styles.statusCard}
        descriptionStyle={styles.statusText}
      />
    );
  }, [feedError, focusAthleteSearch, isLoading, loadFeedPage]);

  const selectedWorkoutComments = selectedWorkoutForComments
    ? commentsByWorkoutId[selectedWorkoutForComments.id] ?? []
    : [];

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
        ListHeaderComponent={headerTitle}
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoadingWrap}>
              <ActivityIndicator size="small" color={palette.accent} />
            </View>
          ) : null
        }
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => void onEndReached()}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor={palette.accent}
          />
        }
      />

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
    paddingTop: 20,
    paddingBottom: 28,
  },
  headerWrap: {
    marginBottom: 12,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 10,
  },
  athleteSearchCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  athleteSearchInputWrap: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  athleteSearchInput: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 8,
  },
  athleteStatusRow: {
    marginTop: 8,
    minHeight: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  athleteStatusText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  athleteErrorText: {
    color: palette.error,
    fontSize: 12,
    fontWeight: '800',
  },
  athleteRailContent: {
    marginTop: 8,
    columnGap: 6,
    paddingRight: 2,
  },
  athleteRailItem: {
    width: 184,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  athleteAvatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  athleteAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  athleteAvatarFallbackText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  athleteMetaWrap: {
    flex: 1,
    minWidth: 0,
  },
  athleteName: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  athleteHandle: {
    marginTop: 1,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  relationPill: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  relationPillText: {
    color: palette.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  footerLoadingWrap: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
