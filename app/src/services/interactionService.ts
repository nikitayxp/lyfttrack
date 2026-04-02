import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import type { Tables, TablesInsert } from '@/types/database';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';

export type WorkoutLikeRow = Tables<'workout_likes'>;
export type WorkoutCommentRow = Tables<'workout_comments'>;
export type CommentAuthorProfile = Pick<Tables<'profiles'>, 'id' | 'username' | 'full_name' | 'avatar_url'>;

export type WorkoutCommentWithProfile = Pick<
  WorkoutCommentRow,
  'id' | 'workout_id' | 'user_id' | 'content' | 'created_at'
> & {
  profile: CommentAuthorProfile | null;
};

export type ToggleLikeResult = {
  workoutId: string;
  liked: boolean;
};

type RawWorkoutCommentWithProfile = Pick<
  WorkoutCommentRow,
  'id' | 'workout_id' | 'user_id' | 'content' | 'created_at'
> & {
  profiles: CommentAuthorProfile | CommentAuthorProfile[] | null;
};

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCommentContent(value: string): string {
  const trimmed = sanitizeText(value, {
    maxLength: INPUT_LIMITS.commentMax,
    allowEmpty: false,
  });

  if (!trimmed || trimmed.length < 1) {
    throw new Error('Comment cannot be empty.');
  }

  return trimmed;
}

function toErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return null;
}

function normalizeJoinedProfile(
  value: CommentAuthorProfile | CommentAuthorProfile[] | null
): CommentAuthorProfile | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function getCurrentCommentAuthorProfile(): Promise<CommentAuthorProfile> {
  const user = await getAuthenticatedUserOrThrow();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load current profile for comments: ${profileError.message}`);
  }

  if (!profile) {
    throw new Error('Current profile not found.');
  }

  return profile;
}

export async function getWorkoutComments(workoutId: string): Promise<WorkoutCommentWithProfile[]> {
  const normalizedWorkoutId = normalizeOptionalId(workoutId);

  if (!normalizedWorkoutId) {
    throw new Error('Workout id is required.');
  }

  const { data: comments, error: commentsError } = await supabase
    .from('workout_comments')
    .select('id, workout_id, user_id, content, created_at, profiles(id, username, full_name, avatar_url)')
    .eq('workout_id', normalizedWorkoutId)
    .order('created_at', { ascending: true });

  if (commentsError) {
    throw new Error(`Unable to load workout comments: ${commentsError.message}`);
  }

  return (comments as RawWorkoutCommentWithProfile[] | null | undefined)?.map((row) => ({
    id: row.id,
    workout_id: row.workout_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    profile: normalizeJoinedProfile(row.profiles),
  })) ?? [];
}

export async function toggleLike(workoutId: string): Promise<ToggleLikeResult> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedWorkoutId = normalizeOptionalId(workoutId);

  if (!normalizedWorkoutId) {
    throw new Error('Workout id is required.');
  }

  const { data: existingLike, error: existingLikeError } = await supabase
    .from('workout_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('workout_id', normalizedWorkoutId)
    .maybeSingle();

  if (existingLikeError) {
    throw new Error(`Unable to inspect like status: ${existingLikeError.message}`);
  }

  if (existingLike) {
    const { error: deleteError } = await supabase
      .from('workout_likes')
      .delete()
      .eq('id', existingLike.id)
      .eq('user_id', user.id);

    if (deleteError) {
      throw new Error(`Unable to remove like: ${deleteError.message}`);
    }

    return {
      workoutId: normalizedWorkoutId,
      liked: false,
    };
  }

  const insertRow: TablesInsert<'workout_likes'> = {
    user_id: user.id,
    workout_id: normalizedWorkoutId,
  };

  const { error: insertError } = await supabase.from('workout_likes').insert(insertRow);

  if (insertError) {
    const code = toErrorCode(insertError);

    if (code === '23505') {
      return {
        workoutId: normalizedWorkoutId,
        liked: true,
      };
    }

    throw new Error(`Unable to add like: ${insertError.message}`);
  }

  return {
    workoutId: normalizedWorkoutId,
    liked: true,
  };
}

export async function addComment(workoutId: string, content: string): Promise<WorkoutCommentRow> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedWorkoutId = normalizeOptionalId(workoutId);

  if (!normalizedWorkoutId) {
    throw new Error('Workout id is required.');
  }

  const normalizedContent = normalizeCommentContent(content);

  const insertRow: TablesInsert<'workout_comments'> = {
    workout_id: normalizedWorkoutId,
    user_id: user.id,
    content: normalizedContent,
  };

  const { data: comment, error: commentError } = await supabase
    .from('workout_comments')
    .insert(insertRow)
    .select('*')
    .single();

  if (commentError || !comment) {
    throw new Error(`Unable to add comment: ${commentError?.message ?? 'Unknown error'}`);
  }

  return comment;
}
