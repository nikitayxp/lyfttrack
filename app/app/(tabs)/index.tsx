import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import {
  addComment,
  getCurrentCommentAuthorProfile,
  getWorkoutComments,
  toggleLike,
  type CommentAuthorProfile,
  type WorkoutCommentWithProfile,
} from '@/services/interactionService';
import { getErrorMessage, getFeedWorkouts, type WorkoutFeedItem } from '@/services/workoutService';
import { EmptyState } from '@/components/common/EmptyState';
import { FeedCommentsModal } from '@/components/feed/FeedCommentsModal';
import { WorkoutFeedCard } from '@/components/feed/WorkoutFeedCard';

const palette = Colors.dark;
const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.surface;
const FEED_PAGE_SIZE = 20;
const feedCardLayoutTransition = LinearTransition.springify().damping(16).stiffness(180);

type FeedLikeInteractionState = {
  hasLiked: boolean;
  likesCount: number;
  isPending: boolean;
};

export default function FeedScreen() {
  const { t } = useTranslation();

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
  const [animationEpoch, setAnimationEpoch] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimationEpoch((currentValue) => currentValue + 1);
    }, [])
  );

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

  const openAthletesExplorer = useCallback(() => {
    router.push('/athletes' as any);
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

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFeedPage(0, 'reset');
    setIsRefreshing(false);
  }, [loadFeedPage]);

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
      Alert.alert(t('feed.commentPublishError'), getErrorMessage(error));
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
    t,
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

      Alert.alert(t('feed.likeUpdateError'), getErrorMessage(error));
    }
  }, [t]);

  const headerTitle = useMemo(() => {
    return (
      <Animated.View
        key={`feed-header-${animationEpoch}`}
        style={styles.headerWrap}
        entering={FadeInUp.duration(320)}
        layout={feedCardLayoutTransition}
      >
        <Text style={styles.title}>{t('feed.title')}</Text>
        <Text style={styles.subtitle}>{t('feed.subtitle')}</Text>

        <View style={styles.athletesHubCard}>
          <View style={styles.athletesHubHeader}>
            <View style={styles.athletesHubIconWrap}>
              <Ionicons name="people-outline" size={16} color={palette.accent} />
            </View>

            <View style={styles.athletesHubTextWrap}>
              <Text style={styles.athletesHubTitle}>{t('feed.exploreAthletes')}</Text>
              <Text style={styles.athletesHubDescription}>{t('social.subtitle')}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.athletesHubActionButton} activeOpacity={ACTIVE_OPACITY} onPress={openAthletesExplorer}>
            <Text style={styles.athletesHubActionText}>{t('feed.exploreAthletes')}</Text>
            <Ionicons name="arrow-forward" size={15} color={palette.chipTextSelected} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }, [animationEpoch, openAthletesExplorer, t]);

  const emptyState = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.statusCard}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>{t('feed.loadingFeed')}</Text>
        </View>
      );
    }

    if (feedError) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title={t('feed.loadFeedErrorTitle')}
          description={feedError}
          actionLabel={t('common.retry')}
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
        title={t('feed.emptyTitle')}
        description={t('feed.emptyDescription')}
        actionLabel={t('feed.exploreAthletes')}
        onActionPress={openAthletesExplorer}
        containerStyle={styles.statusCard}
        descriptionStyle={styles.statusText}
      />
    );
  }, [feedError, isLoading, loadFeedPage, openAthletesExplorer, t]);

  const selectedWorkoutComments = selectedWorkoutForComments
    ? commentsByWorkoutId[selectedWorkoutForComments.id] ?? []
    : [];

  return (
    <>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const interactionState = optimisticLikeState[item.id];

          return (
            <Animated.View
              key={`${item.id}-${animationEpoch}`}
              entering={FadeInDown.delay(Math.min(index * 35, 260)).duration(300)}
              layout={feedCardLayoutTransition}
            >
              <WorkoutFeedCard
                workout={item}
                likeCount={interactionState?.likesCount ?? item.likes_count}
                commentsCount={commentCountByWorkoutId[item.id] ?? item.comments_count}
                hasLiked={interactionState?.hasLiked ?? item.has_liked}
                isLikePending={interactionState?.isPending ?? false}
                onToggleLike={() => void handleToggleLike(item)}
                onOpenComments={() => openCommentsModal(item)}
              />
            </Animated.View>
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
        workoutName={selectedWorkoutForComments?.name ?? t('workout.title')}
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
  athletesHubCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  athletesHubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    columnGap: 10,
  },
  athletesHubIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.accentSoft,
    backgroundColor: '#0A1A2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  athletesHubTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  athletesHubTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  athletesHubDescription: {
    color: palette.labelMuted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  athletesHubActionButton: {
    minHeight: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  athletesHubActionText: {
    color: palette.chipTextSelected,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  statusCard: {
    backgroundColor: CARD_BG,
    borderRadius: Radius.button,
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
