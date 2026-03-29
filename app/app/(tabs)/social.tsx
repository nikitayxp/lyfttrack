import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import {
  acceptRequest,
  getFriends,
  getPendingRequests,
  rejectRequest,
  searchUsers,
  sendFriendRequest,
  type FriendListItem,
  type PendingFriendRequest,
  type SocialSearchResult,
} from '@/services/socialService';

const palette = Colors.dark;
const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

function displayNameOf(profile: {
  username: string;
  full_name: string | null;
}): string {
  return profile.full_name?.trim() || profile.username;
}

function initialsOf(profile: {
  username: string;
  full_name: string | null;
}): string {
  const source = displayNameOf(profile);

  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function relationLabel(relation: SocialSearchResult['relation']): string {
  if (relation === 'friends') return 'Friends';
  if (relation === 'request_sent') return 'Pending';
  if (relation === 'request_received') return 'Requested You';
  return 'Add';
}

function openPublicProfile(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return;
  }

  router.push({
    pathname: '/(tabs)/public-profile/[id]' as any,
    params: { id: normalizedUserId },
  });
}

export default function SocialScreen() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialSearchResult[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendListItem[]>([]);

  const [isLoadingSocial, setIsLoadingSocial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [searchError, setSearchError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const hasSearchQuery = useMemo(() => query.trim().length >= 2, [query]);

  const loadSocialState = useCallback(async () => {
    setSocialError(null);

    try {
      const [pending, friendList] = await Promise.all([getPendingRequests(), getFriends()]);
      setPendingRequests(pending);
      setFriends(friendList);
    } catch (error) {
      setSocialError(toErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      setIsLoadingSocial(true);
      await loadSocialState();
      setIsLoadingSocial(false);
    };

    void run();
  }, [loadSocialState]);

  const runSearch = useCallback(async (value: string) => {
    const normalizedValue = value.trim();

    if (normalizedValue.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await searchUsers(normalizedValue);
      setSearchResults(results);
    } catch (error) {
      setSearchError(toErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 320);

    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);

    await loadSocialState();

    if (query.trim().length >= 2) {
      await runSearch(query);
    }

    setIsRefreshing(false);
  }, [loadSocialState, query, runSearch]);

  const handleSendRequest = useCallback(
    async (userId: string) => {
      setSendingUserId(userId);

      try {
        await sendFriendRequest(userId);
        await Promise.all([loadSocialState(), runSearch(query)]);
      } catch (error) {
        Alert.alert('Unable to send request', toErrorMessage(error));
      } finally {
        setSendingUserId(null);
      }
    },
    [loadSocialState, query, runSearch]
  );

  const handleAccept = useCallback(
    async (requestId: string) => {
      setProcessingRequestId(requestId);

      try {
        await acceptRequest(requestId);
        await Promise.all([loadSocialState(), runSearch(query)]);
      } catch (error) {
        Alert.alert('Unable to accept request', toErrorMessage(error));
      } finally {
        setProcessingRequestId(null);
      }
    },
    [loadSocialState, query, runSearch]
  );

  const handleReject = useCallback(
    async (requestId: string) => {
      setProcessingRequestId(requestId);

      try {
        await rejectRequest(requestId);
        await Promise.all([loadSocialState(), runSearch(query)]);
      } catch (error) {
        Alert.alert('Unable to reject request', toErrorMessage(error));
      } finally {
        setProcessingRequestId(null);
      }
    },
    [loadSocialState, query, runSearch]
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refreshAll()} tintColor={palette.accent} />}
    >
      <Text style={styles.title}>Social</Text>
      <Text style={styles.subtitle}>Search athletes, accept requests and build your circle.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search by Username</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={palette.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholder="Type at least 2 characters"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {isSearching ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.inlineStatusText}>Searching...</Text>
          </View>
        ) : searchError ? (
          <Text style={styles.errorText}>{searchError}</Text>
        ) : !hasSearchQuery ? (
          <Text style={styles.helperText}>Start typing to discover users.</Text>
        ) : searchResults.length === 0 ? (
          <Text style={styles.helperText}>No users found for this username.</Text>
        ) : (
          searchResults.map((result) => {
            const relation = result.relation;
            const isActionable = relation === 'none';
            const isSending = sendingUserId === result.id;

            return (
              <View key={result.id} style={styles.searchItem}>
                <TouchableOpacity
                  style={styles.userLinkArea}
                  activeOpacity={0.86}
                  onPress={() => openPublicProfile(result.id)}
                >
                  {result.avatar_url ? (
                    <Image source={{ uri: result.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{initialsOf(result)}</Text>
                    </View>
                  )}

                  <View style={styles.userMetaWrap}>
                    <Text style={styles.userName}>{displayNameOf(result)}</Text>
                    <Text style={styles.userHandle}>@{result.username}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.userActionButton, !isActionable && styles.userActionButtonMuted]}
                  activeOpacity={0.88}
                  onPress={() => void handleSendRequest(result.id)}
                  disabled={!isActionable || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.userActionText}>{relationLabel(relation)}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardTitle}>Pending Requests</Text>
          <Text style={styles.countText}>{pendingRequests.length}</Text>
        </View>

        {isLoadingSocial ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.inlineStatusText}>Loading requests...</Text>
          </View>
        ) : socialError ? (
          <Text style={styles.errorText}>{socialError}</Text>
        ) : pendingRequests.length === 0 ? (
          <Text style={styles.helperText}>No pending requests right now.</Text>
        ) : (
          pendingRequests.map((request) => {
            const isProcessing = processingRequestId === request.id;
            const profile = request.fromProfile;
            const fallbackName = profile?.username ?? 'Unknown user';

            return (
              <View key={request.id} style={styles.requestItem}>
                <TouchableOpacity
                  style={styles.userLinkArea}
                  activeOpacity={0.86}
                  onPress={() => {
                    if (profile?.id) {
                      openPublicProfile(profile.id);
                    }
                  }}
                  disabled={!profile?.id}
                >
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {profile ? initialsOf(profile) : fallbackName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.userMetaWrap}>
                    <Text style={styles.userName}>{profile ? displayNameOf(profile) : fallbackName}</Text>
                    <Text style={styles.userHandle}>{profile ? `@${profile.username}` : 'Profile unavailable'}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.requestActionsWrap}>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.acceptButton]}
                    activeOpacity={0.88}
                    onPress={() => void handleAccept(request.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.requestButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.rejectButton]}
                    activeOpacity={0.88}
                    onPress={() => void handleReject(request.id)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.requestButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardTitle}>Friends</Text>
          <Text style={styles.countText}>{friends.length}</Text>
        </View>

        {isLoadingSocial ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.inlineStatusText}>Loading friends...</Text>
          </View>
        ) : friends.length === 0 ? (
          <Text style={styles.helperText}>When requests are accepted, friends appear here.</Text>
        ) : (
          friends.map((friend) => (
            <TouchableOpacity
              key={friend.friendshipId}
              style={styles.friendItem}
              activeOpacity={0.86}
              onPress={() => openPublicProfile(friend.profile.id)}
            >
              {friend.profile.avatar_url ? (
                <Image source={{ uri: friend.profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initialsOf(friend.profile)}</Text>
                </View>
              )}

              <View style={styles.userMetaWrap}>
                <Text style={styles.userName}>{displayNameOf(friend.profile)}</Text>
                <Text style={styles.userHandle}>@{friend.profile.username}</Text>
              </View>

              <Ionicons name="people-outline" size={18} color={palette.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
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
    rowGap: 14,
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
    marginBottom: 2,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  countText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  searchRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: '#0D1420',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    columnGap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: palette.error,
    fontSize: 13,
    lineHeight: 19,
  },
  inlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingVertical: 6,
  },
  inlineStatusText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  requestItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  userLinkArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  userMetaWrap: {
    flex: 1,
    paddingRight: 10,
  },
  userName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  userHandle: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  userActionButton: {
    minHeight: 34,
    minWidth: 78,
    borderRadius: 10,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  userActionButtonMuted: {
    backgroundColor: '#253041',
  },
  userActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  requestActionsWrap: {
    flexDirection: 'row',
    columnGap: 8,
  },
  requestButton: {
    minHeight: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  acceptButton: {
    backgroundColor: palette.accent,
  },
  rejectButton: {
    backgroundColor: '#374151',
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
