import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import type { Tables, TablesInsert } from '@/types/database';

export type ProfileRow = Tables<'profiles'>;
export type FriendRequestRow = Tables<'friend_requests'>;
export type FriendRow = Tables<'friends'>;

export type SocialProfile = Pick<ProfileRow, 'id' | 'username' | 'full_name' | 'avatar_url'>;

export type SocialSearchResult = SocialProfile & {
  relation: 'none' | 'friends' | 'request_sent' | 'request_received';
};

type SocialRelation = SocialSearchResult['relation'];

export type PendingFriendRequest = Pick<
  FriendRequestRow,
  'id' | 'from_user_id' | 'to_user_id' | 'status' | 'created_at'
> & {
  fromProfile: SocialProfile | null;
};

export type FriendListItem = {
  friendshipId: string;
  createdAt: string;
  profile: SocialProfile;
};

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSearchTerm(value: string): string {
  return value
    .trim()
    .replace(/[%_]/g, '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeUuidSortKey(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, '');
}

function sortCanonicalPair(userAId: string, userBId: string): { user_low_id: string; user_high_id: string } {
  const normalizedA = normalizeOptionalId(userAId);
  const normalizedB = normalizeOptionalId(userBId);

  if (!normalizedA || !normalizedB) {
    throw new Error('Both user ids are required to build a friendship pair.');
  }

  const keyA = normalizeUuidSortKey(normalizedA);
  const keyB = normalizeUuidSortKey(normalizedB);

  if (keyA === keyB) {
    throw new Error('Cannot create friendship pair with identical users.');
  }

  if (keyA < keyB) {
    return {
      user_low_id: normalizedA,
      user_high_id: normalizedB,
    };
  }

  return {
    user_low_id: normalizedB,
    user_high_id: normalizedA,
  };
}

function inFilterList(ids: string[]): string {
  const normalized = ids.map((id) => id.trim()).filter(Boolean);
  return `(${normalized.join(',')})`;
}

function normalizeResultLimit(value: number | null | undefined, fallback: number, max = 120): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.trunc(value)));
}

async function getActiveUserIdsByRecentWorkouts(currentUserId: string): Promise<string[]> {
  const pageSize = 500;
  const maxRowsToScan = 5000;
  const orderedActiveUserIds: string[] = [];
  const seenUserIds = new Set<string>();

  for (let from = 0; from < maxRowsToScan; from += pageSize) {
    const to = from + pageSize - 1;

    const { data: workoutRows, error: workoutError } = await supabase
      .from('workouts')
      .select('user_id, start_time')
      .neq('user_id', currentUserId)
      .not('end_time', 'is', null)
      .order('start_time', { ascending: false })
      .range(from, to);

    if (workoutError) {
      throw new Error(`Unable to load active users: ${workoutError.message}`);
    }

    if (!workoutRows || workoutRows.length === 0) {
      break;
    }

    for (const row of workoutRows) {
      const candidateUserId = normalizeOptionalId(row.user_id);

      if (!candidateUserId || seenUserIds.has(candidateUserId)) {
        continue;
      }

      seenUserIds.add(candidateUserId);
      orderedActiveUserIds.push(candidateUserId);
    }

    if (workoutRows.length < pageSize) {
      break;
    }
  }

  return orderedActiveUserIds;
}

async function getRelationsByUserIds(currentUserId: string, candidateIds: string[]): Promise<Map<string, SocialRelation>> {
  const normalizedCandidateIds = [...new Set(candidateIds.map((id) => id.trim()).filter(Boolean))];

  if (normalizedCandidateIds.length === 0) {
    return new Map();
  }

  const candidateIdsList = inFilterList(normalizedCandidateIds);

  const { data: friends, error: friendsError } = await supabase
    .from('friends')
    .select('user_low_id, user_high_id')
    .or(
      `and(user_low_id.eq.${currentUserId},user_high_id.in.${candidateIdsList}),and(user_high_id.eq.${currentUserId},user_low_id.in.${candidateIdsList})`
    );

  if (friendsError) {
    throw new Error(`Unable to check friendships: ${friendsError.message}`);
  }

  const { data: pendingRequests, error: pendingError } = await supabase
    .from('friend_requests')
    .select('from_user_id, to_user_id')
    .eq('status', 'pending')
    .or(
      `and(from_user_id.eq.${currentUserId},to_user_id.in.${candidateIdsList}),and(to_user_id.eq.${currentUserId},from_user_id.in.${candidateIdsList})`
    );

  if (pendingError) {
    throw new Error(`Unable to check pending friend requests: ${pendingError.message}`);
  }

  const relationByUserId = new Map<string, SocialRelation>();

  for (const link of friends ?? []) {
    const otherId = link.user_low_id === currentUserId ? link.user_high_id : link.user_low_id;
    relationByUserId.set(otherId, 'friends');
  }

  for (const request of pendingRequests ?? []) {
    const otherId = request.from_user_id === currentUserId ? request.to_user_id : request.from_user_id;

    if (relationByUserId.get(otherId) === 'friends') {
      continue;
    }

    relationByUserId.set(otherId, request.from_user_id === currentUserId ? 'request_sent' : 'request_received');
  }

  return relationByUserId;
}

async function getProfilesByIds(ids: string[]): Promise<Map<string, SocialProfile>> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(`Unable to load profile data: ${error.message}`);
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
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

export async function searchUsers(query: string): Promise<SocialSearchResult[]> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedQuery = normalizeSearchTerm(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const pattern = `%${normalizedQuery}%`;

  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
    .neq('id', user.id)
    .order('username', { ascending: true })
    .limit(20);

  if (usersError) {
    throw new Error(`Unable to search users: ${usersError.message}`);
  }

  const candidates = users ?? [];

  if (candidates.length === 0) {
    return [];
  }

  const relationByUserId = await getRelationsByUserIds(
    user.id,
    candidates.map((candidate) => candidate.id)
  );

  return candidates.map((candidate) => ({
    ...candidate,
    relation: relationByUserId.get(candidate.id) ?? 'none',
  }));
}

export async function getActiveUsers(query = '', limit: number | null = null): Promise<SocialSearchResult[]> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedQuery = normalizeSearchTerm(query);

  if (normalizedQuery.length === 0) {
    return [];
  }

  const safeLimit = limit === null ? null : normalizeResultLimit(limit, 60);
  const pattern = `%${normalizedQuery}%`;

  let profilesQuery = supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .neq('id', user.id)
    .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
    .order('username', { ascending: true });

  if (safeLimit !== null) {
    profilesQuery = profilesQuery.limit(safeLimit);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError) {
    throw new Error(`Unable to load active user profiles: ${profilesError.message}`);
  }

  const candidates = profiles ?? [];

  if (candidates.length === 0) {
    return [];
  }

  const relationByUserId = await getRelationsByUserIds(
    user.id,
    candidates.map((candidate) => candidate.id)
  );

  const results = candidates.map((candidate) => ({
    ...candidate,
    relation: relationByUserId.get(candidate.id) ?? 'none',
  }));

  const recentActiveUserIds = await getActiveUserIdsByRecentWorkouts(user.id);

  if (recentActiveUserIds.length === 0) {
    return results;
  }

  const recentIndexByUserId = new Map(recentActiveUserIds.map((id, index) => [id, index]));

  return results.sort((a, b) => {
    const aIndex = recentIndexByUserId.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = recentIndexByUserId.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.username.localeCompare(b.username);
  });
}

export async function getAllAthletes(limit: number | null = null): Promise<SocialSearchResult[]> {
  const user = await getAuthenticatedUserOrThrow();
  const safeLimit = normalizeResultLimit(limit, 120);

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .neq('id', user.id)
    .order('username', { ascending: true })
    .limit(safeLimit);

  if (profilesError) {
    throw new Error(`Unable to load athletes: ${profilesError.message}`);
  }

  const candidates = profiles ?? [];

  if (candidates.length === 0) {
    return [];
  }

  const relationByUserId = await getRelationsByUserIds(
    user.id,
    candidates.map((candidate) => candidate.id)
  );

  const results = candidates.map((candidate) => ({
    ...candidate,
    relation: relationByUserId.get(candidate.id) ?? 'none',
  }));

  const recentActiveUserIds = await getActiveUserIdsByRecentWorkouts(user.id);

  if (recentActiveUserIds.length === 0) {
    return results;
  }

  const recentIndexByUserId = new Map(recentActiveUserIds.map((id, index) => [id, index]));

  return results.sort((a, b) => {
    const aIndex = recentIndexByUserId.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = recentIndexByUserId.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.username.localeCompare(b.username);
  });
}

export async function sendFriendRequest(userId: string): Promise<FriendRequestRow> {
  const user = await getAuthenticatedUserOrThrow();
  const targetUserId = normalizeOptionalId(userId);

  if (!targetUserId) {
    throw new Error('Target user id is required.');
  }

  if (targetUserId === user.id) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  const pair = sortCanonicalPair(user.id, targetUserId);

  const { data: existingFriend, error: existingFriendError } = await supabase
    .from('friends')
    .select('id')
    .eq('user_low_id', pair.user_low_id)
    .eq('user_high_id', pair.user_high_id)
    .maybeSingle();

  if (existingFriendError) {
    throw new Error(`Unable to validate friendship status: ${existingFriendError.message}`);
  }

  if (existingFriend) {
    throw new Error('You are already friends with this user.');
  }

  const { data: existingPending, error: existingPendingError } = await supabase
    .from('friend_requests')
    .select('id, from_user_id, to_user_id')
    .eq('status', 'pending')
    .or(
      `and(from_user_id.eq.${pair.user_low_id},to_user_id.eq.${pair.user_high_id}),and(from_user_id.eq.${pair.user_high_id},to_user_id.eq.${pair.user_low_id})`
    )
    .maybeSingle();

  if (existingPendingError) {
    throw new Error(`Unable to validate pending requests: ${existingPendingError.message}`);
  }

  if (existingPending) {
    if (existingPending.from_user_id === user.id) {
      throw new Error('You already sent a pending friend request to this user.');
    }

    throw new Error('This user has already sent you a friend request.');
  }

  const insertRow: TablesInsert<'friend_requests'> = {
    from_user_id: user.id,
    to_user_id: targetUserId,
    status: 'pending',
  };

  const { data: request, error: insertError } = await supabase
    .from('friend_requests')
    .insert(insertRow)
    .select('*')
    .single();

  if (insertError || !request) {
    const code = toErrorCode(insertError);

    if (code === '23505') {
      throw new Error('A pending friend request already exists between these users.');
    }

    throw new Error(`Unable to send friend request: ${insertError?.message ?? 'Unknown error'}`);
  }

  return request;
}

export async function getPendingRequests(): Promise<PendingFriendRequest[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data: requests, error: requestsError } = await supabase
    .from('friend_requests')
    .select('id, from_user_id, to_user_id, status, created_at')
    .eq('to_user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (requestsError) {
    throw new Error(`Unable to load pending requests: ${requestsError.message}`);
  }

  const rows = requests ?? [];

  if (rows.length === 0) {
    return [];
  }

  const profileById = await getProfilesByIds(rows.map((row) => row.from_user_id));

  return rows.map((row) => ({
    ...row,
    fromProfile: profileById.get(row.from_user_id) ?? null,
  }));
}

async function respondToPendingRequest(
  requestId: string,
  action: 'accepted' | 'rejected'
): Promise<FriendRequestRow> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedRequestId = normalizeOptionalId(requestId);

  if (!normalizedRequestId) {
    throw new Error('Request id is required.');
  }

  const { data: updatedRequest, error: rpcError } = await supabase
    .rpc('respond_to_friend_request', {
      p_request_id: normalizedRequestId,
      p_action: action,
    })
    .single();

  if (rpcError || !updatedRequest) {
    const normalizedMessage = (rpcError?.message ?? '').toLowerCase();

    if (normalizedMessage.includes('not found')) {
      throw new Error('Friend request not found.');
    }

    if (normalizedMessage.includes('no longer pending')) {
      throw new Error('This friend request is no longer pending.');
    }

    if (normalizedMessage.includes('authentication required')) {
      throw new Error('Authenticated user not found. Please log in again.');
    }

    const operationLabel = action === 'accepted' ? 'accept' : 'reject';
    throw new Error(`Unable to ${operationLabel} friend request: ${rpcError?.message ?? 'Unknown error'}`);
  }

  if (updatedRequest.to_user_id !== user.id) {
    throw new Error('Friend request not found.');
  }

  return updatedRequest;
}

export async function acceptRequest(requestId: string): Promise<FriendRequestRow> {
  return respondToPendingRequest(requestId, 'accepted');
}

export async function rejectRequest(requestId: string): Promise<FriendRequestRow> {
  return respondToPendingRequest(requestId, 'rejected');
}

export async function getFriends(): Promise<FriendListItem[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data: friendships, error: friendshipsError } = await supabase
    .from('friends')
    .select('id, user_low_id, user_high_id, created_at')
    .or(`user_low_id.eq.${user.id},user_high_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (friendshipsError) {
    throw new Error(`Unable to load friends: ${friendshipsError.message}`);
  }

  const links = friendships ?? [];

  if (links.length === 0) {
    return [];
  }

  const friendIds = links.map((link) => (link.user_low_id === user.id ? link.user_high_id : link.user_low_id));
  const profileById = await getProfilesByIds(friendIds);

  const result: FriendListItem[] = [];

  for (const link of links) {
    const friendId = link.user_low_id === user.id ? link.user_high_id : link.user_low_id;
    const profile = profileById.get(friendId);

    if (!profile) {
      continue;
    }

    result.push({
      friendshipId: link.id,
      createdAt: link.created_at,
      profile,
    });
  }

  return result;
}

export type LiveFriendWorkout = {
  userId: string;
  workoutId: string;
  startedAt: string;
  name: string | null;
};

/**
 * Returns any friends who currently have an in-progress workout
 * (a `workouts` row with `end_time IS NULL` created within the last 6 hours).
 * The 6h window prevents stale rows from a crash from showing up forever.
 */
export async function getLiveFriendWorkouts(): Promise<LiveFriendWorkout[]> {
  const friends = await getFriends();

  if (friends.length === 0) {
    return [];
  }

  const friendIds = friends.map((f) => f.profile.id);
  const sixHoursAgoIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('workouts')
    .select('id, user_id, name, start_time, end_time')
    .in('user_id', friendIds)
    .is('end_time', null)
    .gte('start_time', sixHoursAgoIso)
    .order('start_time', { ascending: false });

  if (error) {
    console.warn('[getLiveFriendWorkouts] failed', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    workoutId: row.id,
    startedAt: row.start_time,
    name: row.name,
  }));
}
