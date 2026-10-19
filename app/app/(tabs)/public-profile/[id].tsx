import { useWorkoutComments } from '@/hooks/useWorkoutComments';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/common/BackButton';
import { goBack } from '@/utils/navigation';
import { useWorkoutContext } from '@/context/WorkoutContext';
import { getTabBarHeight, MINIMIZED_WORKOUT_BAR_HEIGHT, MINIMIZED_WORKOUT_BAR_GAP } from '@/constants/tabBar';
import { useAthleteHistory } from '@/hooks/useAthleteHistory';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import { HistoryJumpBar } from '@/components/history/HistoryJumpBar';
import { EmptyState } from '@/components/common/EmptyState';
import { FeedCommentsModal } from '@/components/feed/FeedCommentsModal';
import { WorkoutFeedCard } from '@/components/feed/WorkoutFeedCard';
import {
  addComment,
  getCurrentCommentAuthorProfile,
  toggleLike,
  type CommentAuthorProfile,
  type WorkoutCommentWithProfile,
} from '@/services/interactionService';
import { FriendActions } from '@/components/social/FriendActions';
import { type PublicProfileView } from '@/services/profileService';
import {
  acceptRequest,
  getRelationWithUser,
  rejectRequest,
  removeFriend,
  sendFriendRequest,
  type UserRelation,
} from '@/services/socialService';
import { getErrorMessage, type WorkoutFeedItem } from '@/services/workoutService';
import { useAppToast } from '@/context/ToastContext';
import { confirmAction } from '@/utils/confirmAction';
import { showAlert } from '@/utils/showAlert';

const palette = Colors.dark;
const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.surface;

// Screens that open a public profile, and where "back" should return to.
const PROFILE_ORIGIN_ROUTES: Record<string, string> = {
  athletes: '/athletes',
  social: '/social',
};

type FeedLikeInteractionState = {
  hasLiked: boolean;
  likesCount: number;
  isPending: boolean;
};

function readRouteId(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

function profileDisplayName(profile: PublicProfileView | null, fallbackLabel: string): string {
  if (!profile) {
    return fallbackLabel;
  }

  return profile.full_name?.trim() || profile.username;
}

function initialsFromName(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function PublicProfileScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useAppToast();
  const params = useLocalSearchParams<{ id?: string | string[]; from?: string | string[] }>();
  const profileId = useMemo(() => readRouteId(params.id), [params.id]);
  const activeProfile = useRef({ id: profileId });
  if (activeProfile.current.id !== profileId) activeProfile.current = { id: profileId };
  const openedFrom = useMemo(() => readRouteId(params.from), [params.from]);

  const handleBack = useCallback(() => {
    const origin = openedFrom ? PROFILE_ORIGIN_ROUTES[openedFrom] : undefined;
    goBack(origin ?? '/(tabs)');
  }, [openedFrom]);

  const [historySearchInput, setHistorySearchInput] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPeriodKey, setHistoryPeriodKey] = useState<string | null>(null);
  const {
    profile,
    workouts,
    historyMonths,
    hasSummary,
    summaryError,
    isLoadingProfile,
    isLoadingHistory,
    isRefreshing,
    error,
    historyError,
    hasMore,
    refresh,
    retryHistory,
    loadMore,
  } = useAthleteHistory(profileId, { periodKey: historyPeriodKey, search: historySearch });
  const insets = useSafeAreaInsets();
  const { hasActiveWorkout } = useWorkoutContext();
  const bottomPadding =
    getTabBarHeight(Platform.OS === 'web', insets.bottom) +
    24 +
    (hasActiveWorkout ? MINIMIZED_WORKOUT_BAR_HEIGHT + MINIMIZED_WORKOUT_BAR_GAP : 0);
  const [optimisticLikeState, setOptimisticLikeState] = useState<Record<string, FeedLikeInteractionState>>(
    {},
  );
  const { commentsByWorkoutId, setCommentsByWorkoutId, commentCountByWorkoutId, setCommentCountByWorkoutId, hasMoreCommentsByWorkoutId, isCommentsLoading, isLoadingMoreComments, commentsError, setCommentsError, loadCommentsForWorkout } = useWorkoutComments();
  const [selectedWorkoutForComments, setSelectedWorkoutForComments] = useState<WorkoutFeedItem | null>(null);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [currentCommentAuthor, setCurrentCommentAuthor] = useState<CommentAuthorProfile | null>(null);
  const [relation, setRelation] = useState<UserRelation | null>(null);
  const [isRelationBusy, setIsRelationBusy] = useState(false);
  const isRestrictedProfile = Boolean(
    profile &&
      profile.visibility !== 'public' &&
      relation?.relation !== 'self' &&
      !(profile.visibility === 'friends' && relation?.relation === 'friends'),
  );

  useEffect(() => {
    let current = true;
    setRelation(null);
    setIsRelationBusy(false);
    if (profileId)
      void getRelationWithUser(profileId)
        .then((value) => {
          if (current) setRelation(value);
        })
        .catch(() => {
          if (current) setRelation(null);
        });
    return () => {
      current = false;
    };
  }, [profileId]);

  useEffect(() => {
    const handle = setTimeout(() => setHistorySearch(historySearchInput.trim()), 250);
    return () => clearTimeout(handle);
  }, [historySearchInput]);

  useEffect(() => {
    setHistorySearchInput('');
    setHistorySearch('');
    setHistoryPeriodKey(null);
    setSelectedWorkoutForComments(null);
    setOptimisticLikeState({});
    setCommentsByWorkoutId({});
    setCommentCountByWorkoutId({});
  }, [profileId, setCommentsByWorkoutId, setCommentCountByWorkoutId]);

  const runRelationAction = useCallback(
    async (action: () => Promise<void>, errorTitleKey: string) => {
      if (!profileId || isRelationBusy) {
        return;
      }

      setIsRelationBusy(true);
      const actionProfile = activeProfile.current;
      const isCurrent = () => activeProfile.current === actionProfile;

      try {
        await action();
        if (!isCurrent()) return;
        const nextRelation = await getRelationWithUser(profileId);
        if (!isCurrent()) return;
        setRelation(nextRelation);
        await refresh();
      } catch (actionError) {
        if (isCurrent()) showAlert(showToast, t(errorTitleKey), getErrorMessage(actionError), 'error');
      } finally {
        if (isCurrent()) setIsRelationBusy(false);
      }
    },
    [isRelationBusy, profileId, refresh, showToast, t],
  );

  const handleAddFriend = useCallback(() => {
    void runRelationAction(async () => {
      await sendFriendRequest(profileId as string);
    }, 'social.errors.sendRequest');
  }, [profileId, runRelationAction]);

  const handleAcceptRequest = useCallback(() => {
    const requestId = relation?.requestId;

    if (!requestId) {
      return;
    }

    void runRelationAction(async () => {
      await acceptRequest(requestId);
    }, 'social.errors.acceptRequest');
  }, [relation?.requestId, runRelationAction]);

  const handleRejectRequest = useCallback(() => {
    const requestId = relation?.requestId;

    if (!requestId) {
      return;
    }

    void runRelationAction(async () => {
      await rejectRequest(requestId);
    }, 'social.errors.rejectRequest');
  }, [relation?.requestId, runRelationAction]);

  const handleRemoveFriend = useCallback(() => {
    void (async () => {
      const confirmed = await confirmAction({
        title: t('social.actions.removeConfirmTitle'),
        description: t('social.actions.removeConfirmDescription'),
        confirmLabel: t('social.actions.removeFriend'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      });

      if (!confirmed) {
        return;
      }

      await runRelationAction(async () => {
        await removeFriend(profileId as string);
      }, 'social.errors.removeFriend');
    })();
  }, [profileId, runRelationAction, t]);

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



  const openCommentsModal = useCallback(
    (workout: WorkoutFeedItem) => {
      setSelectedWorkoutForComments(workout);
      setCommentInputValue('');
      setCommentsError(null);
      void ensureCurrentCommentAuthor();
      void loadCommentsForWorkout(workout.id);
    },
    [ensureCurrentCommentAuthor, loadCommentsForWorkout, setCommentsError],
  );

  const closeCommentsModal = useCallback(() => {
    setSelectedWorkoutForComments(null);
    setCommentInputValue('');
    setCommentsError(null);
  }, [setCommentsError]);

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

      void ensureCurrentCommentAuthor();
    } catch (sendError) {
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
      showAlert(showToast, t('publicProfile.commentPublishError'), getErrorMessage(sendError), 'error');
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
    showToast,
    t,
    setCommentsByWorkoutId,
    setCommentCountByWorkoutId,
  ]);

  const handleToggleLike = useCallback(
    async (workout: WorkoutFeedItem) => {
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
      } catch (toggleError) {
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

        showAlert(showToast, t('publicProfile.likeUpdateError'), getErrorMessage(toggleError), 'error');
      }
    },
    [showToast, t],
  );

  const displayName = useMemo(
    () => profileDisplayName(profile, t('publicProfile.athleteFallback')),
    [profile, t],
  );

  const selectedWorkoutComments = selectedWorkoutForComments
    ? (commentsByWorkoutId[selectedWorkoutForComments.id] ?? [])
    : [];

  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-GB' : 'pt-PT';
  const totalWorkouts = historyMonths.reduce((total, month) => total + month.count, 0);
  const firstMonth = historyMonths[historyMonths.length - 1];
  const firstMonthLabel = firstMonth
    ? new Date(firstMonth.year, firstMonth.month - 1, 1).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
      })
    : null;
  const profileReady = !isLoadingProfile && !error && profile !== null;

  return (
    <>
      <FlatList
        data={profileReady && !isRestrictedProfile ? workouts : []}
        keyExtractor={(item) => item.id}
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={palette.accent}
          />
        }
        renderItem={({ item }) => {
          const interaction = optimisticLikeState[item.id];
          return (
            <WorkoutFeedCard
              workout={item}
              variant="history"
              likeCount={interaction?.likesCount ?? item.likes_count}
              commentsCount={commentCountByWorkoutId[item.id] ?? item.comments_count}
              hasLiked={interaction?.hasLiked ?? item.has_liked}
              isLikePending={interaction?.isPending ?? false}
              onToggleLike={() => void handleToggleLike(item)}
              onOpenComments={() => openCommentsModal(item)}
            />
          );
        }}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <BackButton onPress={handleBack} />
              <Text style={styles.title}>{t('publicProfile.title')}</Text>
              <View style={styles.backButtonPlaceholder} />
            </View>
            {isLoadingProfile ? (
              <View style={styles.statusCard}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.statusText}>{t('publicProfile.loadingProfile')}</Text>
              </View>
            ) : !profileReady ? (
              <View style={styles.statusCard}>
                <Text style={styles.errorText}>
                  {error ?? t(profileId ? 'publicProfile.notFound' : 'publicProfile.invalidId')}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => void refresh()}
                >
                  <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.profileCard}>
                  <View style={styles.identityRow}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>{initialsFromName(displayName)}</Text>
                      </View>
                    )}
                    <View style={styles.identityText}>
                      <Text style={styles.nameText}>{displayName}</Text>
                      <Text style={styles.usernameText}>@{profile?.username}</Text>
                      <View style={styles.visibility}>
                        <Ionicons
                          name={profile?.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'}
                          size={12}
                          color={palette.accentLight}
                        />
                        <Text style={styles.visibilityText}>
                          {t(`publicProfile.visibility.${profile?.visibility ?? 'private'}`)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {profile?.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}
                  {!isRestrictedProfile && hasSummary ? (
                    <>
                      <View style={styles.profileMetrics}>
                        <View style={styles.profileMetric}>
                          <Text style={styles.profileMetricValue}>
                            {totalWorkouts.toLocaleString(locale)}
                          </Text>
                          <Text style={styles.profileMetricLabel}>{t('publicProfile.totalSessions')}</Text>
                        </View>
                        <View style={styles.profileMetric}>
                          <Text style={styles.profileMetricValue}>{historyMonths.length}</Text>
                          <Text style={styles.profileMetricLabel}>{t('publicProfile.activeMonths')}</Text>
                        </View>
                      </View>
                      {firstMonthLabel ? (
                        <Text style={styles.historySince}>
                          {t('publicProfile.historySince', { date: firstMonthLabel })}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                  {summaryError && !isRestrictedProfile ? (
                    <View style={styles.statusCard}>
                      <Text style={styles.statusText}>{t('publicProfile.summaryUnavailable')}</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.loadMore}
                        onPress={() => void refresh()}
                      >
                        <Text style={styles.loadMoreText}>{t('common.retry')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {relation && relation.relation !== 'self' ? (
                    <View style={styles.friendActionsWrap}>
                      <FriendActions
                        relation={relation.relation}
                        isBusy={isRelationBusy}
                        onAdd={handleAddFriend}
                        onAccept={handleAcceptRequest}
                        onReject={handleRejectRequest}
                        onRemove={handleRemoveFriend}
                      />
                    </View>
                  ) : null}
                </View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('publicProfile.workoutsSectionTitle')}</Text>
                </View>
                {!isRestrictedProfile ? (
                  <HistoryJumpBar
                    months={historyMonths}
                    selectedPeriodKey={historyPeriodKey}
                    onSelectPeriod={setHistoryPeriodKey}
                    query={historySearchInput}
                    onChangeQuery={setHistorySearchInput}
                    searchPlaceholder={t('historyJump.searchPlaceholder')}
                    allLabel={t('historyJump.all')}
                    locale={locale}
                  />
                ) : (
                  <EmptyState
                    icon="lock-closed-outline"
                    title={t('publicProfile.restrictedTitle')}
                    description={t(
                      profile?.visibility === 'private'
                        ? 'publicProfile.privateDescription'
                        : 'publicProfile.restrictedDescription',
                    )}
                    containerStyle={styles.statusCard}
                  />
                )}
              </>
            )}
          </>
        }
        ListEmptyComponent={
          profileReady && !isRestrictedProfile && !isLoadingHistory && !historyError ? (
            <EmptyState
              icon={historyPeriodKey || historySearch ? 'search-outline' : 'barbell-outline'}
              title={t(
                historyPeriodKey || historySearch
                  ? 'historyJump.noResultsTitle'
                  : 'publicProfile.noPublicWorkoutsTitle',
              )}
              description={t(
                historyPeriodKey || historySearch
                  ? 'historyJump.noResultsDescription'
                  : 'publicProfile.noPublicWorkoutsDescription',
              )}
              containerStyle={styles.statusCard}
            />
          ) : null
        }
        ListFooterComponent={
          profileReady && !isRestrictedProfile ? (
            <View style={styles.footer}>
              {isLoadingHistory ? (
                <View style={styles.statusCard}>
                  <ActivityIndicator color={palette.accent} />
                  <Text style={styles.statusText}>{t('common.loading')}</Text>
                </View>
              ) : historyError ? (
                <View style={styles.statusCard}>
                  <Text style={styles.errorText}>{historyError}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.loadMore}
                    onPress={() => void retryHistory()}
                  >
                    <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : hasMore ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.loadMore}
                  onPress={() => void loadMore()}
                >
                  <Text style={styles.loadMoreText}>{t('historyJump.loadMore')}</Text>
                  <Ionicons name="arrow-down" size={17} color={palette.accentLight} />
                </TouchableOpacity>
              ) : workouts.length > 0 ? (
                <Text style={styles.statusText}>{t('historyJump.endOfHistory')}</Text>
              ) : null}
            </View>
          ) : null
        }
      />

      <FeedCommentsModal
        hasMore={Boolean(selectedWorkoutForComments && hasMoreCommentsByWorkoutId[selectedWorkoutForComments.id])}
        isLoadingMore={isLoadingMoreComments}
        onLoadMore={() => { if (selectedWorkoutForComments) void loadCommentsForWorkout(selectedWorkoutForComments.id, true); }}
        visible={selectedWorkoutForComments !== null}
        workoutName={selectedWorkoutForComments?.name ?? t('publicProfile.workoutFallback')}
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
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1, minWidth: 0 },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  visibilityText: { color: palette.accentLight, fontSize: 11, fontWeight: '600' },
  profileMetrics: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: palette.border,
    marginTop: 18,
    paddingTop: 14,
    gap: 12,
  },
  profileMetric: { flex: 1, minWidth: 0, gap: 4 },
  profileMetricValue: {
    color: palette.textPrimary,
    fontSize: 25,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  profileMetricLabel: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  historySince: { color: palette.textMuted, fontSize: 12, marginTop: 14 },
  footer: { paddingVertical: 12 },
  loadMore: {
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  loadMoreText: { color: palette.accentLight, fontWeight: '700', fontSize: 14 },
  profileCard: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 30,
    fontWeight: '900',
  },
  nameText: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 3,
    letterSpacing: -0.5,
  },
  usernameText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  bioText: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 4,
  },
  friendActionsWrap: {
    alignSelf: 'stretch',
    marginTop: 14,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metricChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  statusCard: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    rowGap: 8,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: palette.error,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 34,
    borderRadius: Radius.sm,
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
