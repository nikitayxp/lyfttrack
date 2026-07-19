import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import {
  getAllAthletes,
  searchUsers,
  sendFriendRequest,
  type SocialSearchResult,
} from '@/services/socialService';

const palette = Colors.dark;
const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.surface;

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

function openPublicProfile(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return;
  }

  router.push({
    pathname: '/(tabs)/profile/[id]' as any,
    params: { id: normalizedUserId },
  });
}

export default function AthletesScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [athletes, setAthletes] = useState<SocialSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const searchRequestRef = useRef(0);

  const hasSearchQuery = useMemo(() => query.trim().length >= 2, [query]);

  const toErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    return t('common.unknownError');
  }, [t]);

  const relationLabel = useCallback((relation: SocialSearchResult['relation']): string => {
    if (relation === 'friends') return t('social.relations.friends');
    if (relation === 'request_sent') return t('social.relations.pending');
    if (relation === 'request_received') return t('social.relations.requestedYou');
    return t('social.relations.add');
  }, [t]);

  const loadAthletes = useCallback(async (queryValue: string) => {
    const normalizedQuery = queryValue.trim();
    const requestId = ++searchRequestRef.current;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const rows = normalizedQuery.length >= 2
        ? await searchUsers(normalizedQuery)
        : await getAllAthletes();

      if (requestId !== searchRequestRef.current) {
        return;
      }

      setAthletes(rows);
    } catch (error) {
      if (requestId !== searchRequestRef.current) {
        return;
      }

      setAthletes([]);
      setErrorMessage(toErrorMessage(error));
    } finally {
      if (requestId === searchRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [toErrorMessage]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      void loadAthletes(normalizedQuery);
      return;
    }

    const timer = setTimeout(() => {
      void loadAthletes(normalizedQuery);
    }, 280);

    return () => clearTimeout(timer);
  }, [loadAthletes, query]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAthletes(query);
    setIsRefreshing(false);
  }, [loadAthletes, query]);

  const handleSendRequest = useCallback(async (userId: string) => {
    setSendingUserId(userId);

    try {
      await sendFriendRequest(userId);
      await loadAthletes(query);
      Alert.alert(t('social.success.requestSentTitle'), t('social.success.requestSentDescription'));
    } catch (error) {
      Alert.alert(t('social.errors.sendRequest'), toErrorMessage(error));
    } finally {
      setSendingUserId(null);
    }
  }, [loadAthletes, query, t, toErrorMessage]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void onRefresh()}
          tintColor={palette.accent}
        />
      }
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={ACTIVE_OPACITY} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={palette.textPrimary} />
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('feed.exploreAthletes')}</Text>
      <Text style={styles.subtitle}>{t('social.subtitle')}</Text>

      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={palette.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholder={t('feed.searchPlaceholder')}
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('feed.searchPlaceholder')}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              activeOpacity={ACTIVE_OPACITY}
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t('social.search.clear')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={palette.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {hasSearchQuery ? (
        <Text style={styles.resultsLabel}>{t('social.search.title')}</Text>
      ) : null}

      <View style={styles.listCard}>
        {isLoading ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.inlineStatusText}>
              {hasSearchQuery ? t('social.search.searching') : t('social.search.searchingAll')}
            </Text>
          </View>
        ) : errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : athletes.length === 0 ? (
          <Text style={styles.helperText}>
            {hasSearchQuery ? t('social.search.empty') : t('social.search.emptyAll')}
          </Text>
        ) : (
          athletes.map((athlete) => {
            const isActionable = athlete.relation === 'none';
            const isSending = sendingUserId === athlete.id;

            return (
              <View key={athlete.id} style={styles.athleteItem}>
                <TouchableOpacity
                  style={styles.userLinkArea}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => openPublicProfile(athlete.id)}
                >
                  {athlete.avatar_url ? (
                    <Image source={{ uri: athlete.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{initialsOf(athlete)}</Text>
                    </View>
                  )}

                  <View style={styles.userMetaWrap}>
                    <Text style={styles.userName}>{displayNameOf(athlete)}</Text>
                    <Text style={styles.userHandle}>@{athlete.username}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.userActionButton, !isActionable && styles.userActionButtonMuted]}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => void handleSendRequest(athlete.id)}
                  disabled={!isActionable || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={palette.textPrimary} />
                  ) : (
                    <Text style={styles.userActionText}>{relationLabel(athlete.relation)}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
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
    paddingTop: 14,
    paddingBottom: 36,
    rowGap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
  },
  backButtonText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  searchCard: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchRow: {
    minHeight: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.exerciseRowBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    columnGap: 8,
  },
  searchInput: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
  resultsLabel: {
    color: palette.labelMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  listCard: {
    backgroundColor: CARD_BG,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
    fontWeight: '600',
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
  athleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    columnGap: 10,
  },
  userLinkArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
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
    minWidth: 0,
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
    minHeight: 36,
    minWidth: 102,
    borderRadius: Radius.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  userActionButtonMuted: {
    backgroundColor: palette.border,
  },
  userActionText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
