import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
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
const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';
const FEED_PAGE_SIZE = 20;

type FeedLikeInteractionState = {
  hasLiked: boolean;
  likesCount: number;
  isPending: boolean;
};

export default function FeedScreen() {
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

  const handleOpenFriends = useCallback(() => {
    router.push('/(tabs)/social' as any);
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
      Alert.alert('Unable to add comment', getErrorMessage(error));
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

      Alert.alert('Unable to update like', getErrorMessage(error));
    }
  }, []);

  const headerTitle = useMemo(() => {
    return (
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Global Feed</Text>
        <Text style={styles.subtitle}>Your workouts and your friends&apos; latest sessions.</Text>
      </View>
    );
  }, []);

  const emptyState = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.statusCard}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>Loading feed...</Text>
        </View>
      );
    }

    if (feedError) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Unable to load feed"
          description={feedError}
          actionLabel="Retry"
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
        icon="people-outline"
        title="Feed vazio por enquanto"
        description="Siga atletas e amigos para descobrir treinos e ganhar motivacao diaria."
        actionLabel="Procurar Amigos"
        onActionPress={handleOpenFriends}
        containerStyle={styles.statusCard}
        descriptionStyle={styles.statusText}
      />
    );
  }, [feedError, handleOpenFriends, isLoading, loadFeedPage]);

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
        workoutName={selectedWorkoutForComments?.name ?? 'Workout'}
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerWrap: {
    marginBottom: 16,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  authorTextWrap: {
    flex: 1,
  },
  authorName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  authorMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  durationText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  workoutName: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  workoutNotes: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#253041',
    marginHorizontal: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 6,
  },
  exerciseChip: {
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '80%',
  },
  exerciseChipText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  moreChip: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  moreChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  interactionRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#253041',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  interactionButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
  },
  interactionButtonStatic: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
  },
  likeButtonActive: {
    borderColor: '#EF4444',
    backgroundColor: '#2A1118',
  },
  interactionText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  likeTextActive: {
    color: '#EF4444',
  },
  statusCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
  footerLoadingWrap: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
