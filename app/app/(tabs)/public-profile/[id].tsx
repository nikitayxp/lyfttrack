import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { WorkoutFeedCard } from '@/components/feed/WorkoutFeedCard';
import { getPublicProfileById, type PublicProfileView } from '@/services/profileService';
import { getErrorMessage, getUserWorkouts, type WorkoutFeedItem } from '@/services/workoutService';

const palette = Colors.dark;
const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';
const FEED_PAGE_SIZE = 20;

function readRouteId(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

function profileDisplayName(profile: PublicProfileView | null): string {
  if (!profile) {
    return 'Athlete';
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
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const profileId = useMemo(() => readRouteId(params.id), [params.id]);

  const [profile, setProfile] = useState<PublicProfileView | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      if (!profileId) {
        setError('Invalid profile id.');
        setProfile(null);
        setWorkouts([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      setError(null);

      try {
        const [profileData, workoutData] = await Promise.all([
          getPublicProfileById(profileId),
          getUserWorkouts(profileId, 0, FEED_PAGE_SIZE),
        ]);

        if (!profileData) {
          setProfile(null);
          setWorkouts([]);
          setError('Profile not found.');
          return;
        }

        setProfile(profileData);
        setWorkouts(workoutData);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
        setProfile(null);
        setWorkouts([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [profileId]
  );

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  const displayName = useMemo(() => profileDisplayName(profile), [profile]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadData('refresh')} tintColor={palette.accent} />}
    >
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Public Profile</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.statusCard}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>Loading profile...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.86} onPress={() => void loadData('initial')}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.profileCard}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsFromName(displayName)}</Text>
              </View>
            )}

            <Text style={styles.nameText}>{displayName}</Text>
            <Text style={styles.usernameText}>@{profile?.username}</Text>

            {profile?.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

            <View style={styles.metricChip}>
              <Ionicons name="barbell-outline" size={14} color={palette.accent} />
              <Text style={styles.metricChipText}>{`${workouts.length} recent workouts`}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Workout Feed</Text>
          </View>

          {workouts.length === 0 ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>No public workouts yet.</Text>
            </View>
          ) : (
            workouts.map((workout) => <WorkoutFeedCard key={workout.id} workout={workout} disableInteractions />)
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 30,
    rowGap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: CARD_BG,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 10,
  },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 10,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 24,
    fontWeight: '800',
  },
  nameText: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 3,
    textAlign: 'center',
  },
  usernameText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  bioText: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  statusCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: palette.accent,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
