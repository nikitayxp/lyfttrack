import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import { WorkoutFeedCard } from '@/components/feed/WorkoutFeedCard';
import { getProfile, type ProfileRow } from '@/services/profileService';
import { addWeight, getWeightHistory, type BodyMeasurementEntry } from '@/services/measurementService';
import { getAllTimePRs, getCurrentWorkoutStreak, type AllTimePR } from '@/services/statsService';
import { supabase } from '@/services/supabase';
import { getErrorMessage, getUserWorkouts, type WorkoutFeedItem } from '@/services/workoutService';

const palette = Colors.dark;
const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';
const HISTORY_PAGE_SIZE = 20;
const TROPHY_ACCENT = '#FACC15';
const TROPHY_NEON = '#F59E0B';

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

  return new Date(timestamp).toLocaleDateString('en-US', {
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
    return { trend: null, deltaText: 'Need one more entry for trend' };
  }

  const delta = Number((latest.weight_kg - previous.weight_kg).toFixed(1));

  if (!Number.isFinite(delta) || delta === 0) {
    return {
      trend: 'flat',
      deltaText: 'Stable vs previous entry',
    };
  }

  if (delta > 0) {
    return {
      trend: 'up',
      deltaText: `+${formatWeightKg(Math.abs(delta))} kg vs previous`,
    };
  }

  return {
    trend: 'down',
    deltaText: `-${formatWeightKg(Math.abs(delta))} kg vs previous`,
  };
}

export default function ProfileScreen() {
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

  const targetUserId = useMemo(() => {
    return profile?.id ?? authUserId;
  }, [authUserId, profile?.id]);

  const displayName = useMemo(() => {
    const profileName = profile?.full_name?.trim() || profile?.username?.trim() || '';
    const emailName = email.split('@')[0] ?? '';

    return profileName || emailName || 'Athlete';
  }, [email, profile?.full_name, profile?.username]);

  const usernameHandle = useMemo(() => {
    if (profile?.username?.trim()) {
      return `@${profile.username}`;
    }

    return '@athlete';
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
        throw new Error('Authenticated user id not found.');
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

  function handleEditProfile() {
    Alert.alert('Edit Profile', 'Profile editing tools will be connected in the next step.');
  }

  function handleSettings() {
    Alert.alert('Settings', 'Settings panel will be connected in the next step.');
  }

  const openWeightModal = useCallback(() => {
    const initialValue = latestWeightEntry ? formatWeightKg(latestWeightEntry.weight_kg) : '';
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

    const normalizedInput = weightInput.replace(',', '.').trim();
    const parsedValue = Number(normalizedInput);

    if (!normalizedInput || !Number.isFinite(parsedValue) || parsedValue <= 0) {
      Alert.alert('Validation', 'Please enter a valid weight in kg.');
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
      Alert.alert('Unable to save weight', getErrorMessage(error));
    } finally {
      setIsSavingWeight(false);
    }
  }, [isSavingWeight, weightInput]);

  const headerComponent = useMemo(() => {
    return (
      <View style={styles.headerWrap}>
        {profileError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load profile</Text>
            <Text style={styles.errorText}>{profileError}</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={() => void bootstrap()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.heroCard}>
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

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.9} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryActionButton} activeOpacity={0.9} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={16} color={palette.textPrimary} />
              <Text style={styles.secondaryActionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.streakHeroCard}>
          <Text style={styles.streakKicker}>Consistency Engine</Text>
          <Text style={styles.streakHeadline}>{`🔥 ${currentWorkoutStreak} Week Streak!`}</Text>
          <Text style={styles.streakSubtitle}>
            {currentWorkoutStreak > 0
              ? 'You have trained every week in your active streak window.'
              : 'Complete one workout this week to ignite your streak.'}
          </Text>
        </View>

        <View style={styles.bodyProgressCard}>
          <View style={styles.bodyProgressHeaderRow}>
            <View style={styles.bodyProgressHeaderTextWrap}>
              <Text style={styles.bodyProgressTitle}>Body Progress</Text>
              <Text style={styles.bodyProgressSubtitle}>Track your bodyweight and weekly trend.</Text>
            </View>

            <TouchableOpacity style={styles.weightAddButton} activeOpacity={0.88} onPress={openWeightModal}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.bodyWeightPrimaryRow}>
            <Text style={styles.bodyWeightValue}>
              {latestWeightEntry ? `${formatWeightKg(latestWeightEntry.weight_kg)} kg` : '--'}
            </Text>
            {latestWeightEntry ? <Text style={styles.bodyWeightMeta}>{formatDateShort(latestWeightEntry.measured_at)}</Text> : null}
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
                  ? '#F87171'
                  : weightTrend.trend === 'down'
                    ? '#22C55E'
                    : '#CBD5E1'
              }
            />
            <Text style={styles.bodyTrendText}>{weightTrend.deltaText}</Text>
          </View>
        </View>

        <View style={styles.hallWrap}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Sala de Trofeus</Text>
            <View style={styles.sectionPill}>
              <Text style={styles.sectionPillText}>PR Hall of Fame</Text>
            </View>
          </View>

          {isLoadingPerformance ? (
            <View style={styles.statusCardCompact}>
              <ActivityIndicator size="small" color={TROPHY_NEON} />
              <Text style={styles.statusText}>Loading your all-time PR records...</Text>
            </View>
          ) : performanceError ? (
            <View style={styles.historyErrorCard}>
              <Text style={styles.historyErrorTitle}>Unable to load performance insights</Text>
              <Text style={styles.historyErrorText}>{performanceError}</Text>
            </View>
          ) : allTimePrs.length === 0 ? (
            <View style={styles.statusCardCompact}>
              <Text style={styles.statusTitle}>No trophies yet</Text>
              <Text style={styles.statusText}>Finish a few workouts to unlock your golden PR cards.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trophyCarouselContent}>
              {allTimePrs.map((pr) => (
                <View key={pr.exerciseId} style={styles.trophyCard}>
                  <View style={styles.trophyBadge}>
                    <Ionicons name="trophy" size={14} color="#111827" />
                  </View>

                  <Text style={styles.trophyExerciseName} numberOfLines={2}>
                    {pr.exerciseName}
                  </Text>
                  <Text style={styles.trophyValue}>{`${formatWeightKg(pr.maxWeight)} kg`}</Text>
                  <Text style={styles.trophyDate}>{formatDateShort(pr.achievedAt)}</Text>
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
            <Text style={styles.historyErrorTitle}>Unable to load workout history</Text>
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
    handleSettings,
    historyError,
    initials,
    isLoadingPerformance,
    latestWeightEntry,
    currentWorkoutStreak,
    openWeightModal,
    performanceError,
    profile?.avatar_url,
    profileError,
    usernameHandle,
    weightTrend,
  ]);

  const emptyComponent = useMemo(() => {
    if (isBootstrapping) {
      return (
        <View style={styles.statusCard}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>Loading workout history...</Text>
        </View>
      );
    }

    if (historyError) {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>History unavailable</Text>
          <Text style={styles.statusText}>{historyError}</Text>
        </View>
      );
    }

    return (
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>No workouts yet</Text>
        <Text style={styles.statusText}>Start training and your full personal history will appear here.</Text>
      </View>
    );
  }, [historyError, isBootstrapping]);

  return (
    <>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <WorkoutFeedCard
            workout={item}
            likeCount={item.likes_count}
            commentsCount={item.comments_count}
            hasLiked={item.has_liked}
            disableInteractions
          />
        )}
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

      <Modal visible={isWeightModalVisible} transparent animationType="fade" onRequestClose={closeWeightModal}>
        <View style={styles.quickLogBackdrop}>
          <Pressable style={styles.quickLogDismissArea} onPress={closeWeightModal} />

          <View style={styles.quickLogCard}>
            <Text style={styles.quickLogTitle}>Quick Weight Log</Text>
            <Text style={styles.quickLogSubtitle}>Log today&apos;s bodyweight in kg.</Text>

            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="Ex: 79.4"
              placeholderTextColor="#6B7280"
              style={styles.quickLogInput}
              editable={!isSavingWeight}
            />

            <View style={styles.quickLogActionsRow}>
              <TouchableOpacity
                style={styles.quickLogCancelButton}
                activeOpacity={0.88}
                onPress={closeWeightModal}
                disabled={isSavingWeight}
              >
                <Text style={styles.quickLogCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLogSaveButton, isSavingWeight && styles.quickLogSaveButtonDisabled]}
                activeOpacity={0.88}
                onPress={() => void handleSaveWeight()}
                disabled={isSavingWeight}
              >
                {isSavingWeight ? (
                  <ActivityIndicator size="small" color="#111827" />
                ) : (
                  <Text style={styles.quickLogSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 34,
  },
  headerWrap: {
    marginBottom: 4,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#2A1118',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  errorTitle: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 10,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  streakHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EA580C',
    backgroundColor: '#30140A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#FB923C',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  streakKicker: {
    color: '#FDBA74',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    marginBottom: 6,
  },
  streakHeadline: {
    color: '#FFEDD5',
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  streakSubtitle: {
    color: '#FED7AA',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  avatarFrame: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 3,
    borderColor: '#3B82F6',
    backgroundColor: '#122744',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12335E',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    marginBottom: 4,
  },
  handle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    columnGap: 10,
  },
  primaryActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  bodyProgressCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2B3342',
    backgroundColor: '#0D1624',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  bodyProgressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    columnGap: 8,
  },
  bodyProgressHeaderTextWrap: {
    flex: 1,
  },
  bodyProgressTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  bodyProgressSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  weightAddButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#1D4ED8',
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
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bodyWeightMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
  },
  bodyTrendBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111B2B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  bodyTrendText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  hallWrap: {
    marginBottom: 12,
  },
  statusCardCompact: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  trophyCarouselContent: {
    columnGap: 10,
    paddingRight: 4,
  },
  trophyCard: {
    width: 170,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A16207',
    backgroundColor: '#1F1700',
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.26,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  trophyBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: TROPHY_ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 10,
  },
  trophyExerciseName: {
    color: '#FDE68A',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    minHeight: 40,
    marginBottom: 8,
  },
  trophyValue: {
    color: '#FEF08A',
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  trophyDate: {
    marginTop: 4,
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActionText: {
    color: '#E5EDF9',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTitleRow: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  historyErrorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#2A1118',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  historyErrorTitle: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyErrorText: {
    color: '#FECACA',
    fontSize: 12,
    lineHeight: 18,
  },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  statusText: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  footerLoadingWrap: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    paddingHorizontal: 18,
  },
  quickLogDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  quickLogCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1320',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  quickLogTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  quickLogSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  quickLogInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
  },
  quickLogActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    columnGap: 10,
  },
  quickLogCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogCancelText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  quickLogSaveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TROPHY_NEON,
    backgroundColor: TROPHY_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogSaveButtonDisabled: {
    opacity: 0.75,
  },
  quickLogSaveText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
});
