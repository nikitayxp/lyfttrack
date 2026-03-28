import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { getWorkoutStats, type WorkoutStats } from '@/services/workoutService';

const palette = Colors.dark;

function formatDisplayName(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase())
    .join(' ');
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg.toLocaleString()} kg`;
}

type SettingsItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
};

export default function ProfileScreen() {
  const [displayName, setDisplayName] = useState('Athlete');
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<WorkoutStats>({ totalWorkouts: 0, totalVolume: 0, totalSets: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      const metadata = (user?.user_metadata ?? {}) as {
        username?: string;
        full_name?: string;
      };

      const fromMetadata = metadata.full_name ?? metadata.username ?? '';
      const fromEmail = user?.email?.split('@')[0] ?? '';
      setDisplayName(formatDisplayName(fromMetadata || fromEmail || 'Athlete'));
      setEmail(user?.email ?? '');

      const s = await getWorkoutStats();
      setStats(s);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)' as any);
        },
      },
    ]);
  }

  const settingsItems: SettingsItem[] = [
    {
      icon: 'person-outline',
      label: 'Edit Profile',
      subtitle: 'Name, avatar and preferences',
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      subtitle: 'Workout reminders',
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Privacy & Security',
      subtitle: 'Password, data export',
    },
    {
      icon: 'information-circle-outline',
      label: 'About LyftTrack',
      subtitle: 'Version 1.0.0',
    },
    {
      icon: 'log-out-outline',
      label: 'Sign Out',
      onPress: handleLogout,
      destructive: true,
    },
  ];

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{displayName}</Text>
        <Text style={styles.profileEmail}>{email}</Text>

        {/* Inline Stats */}
        <View style={styles.inlineStats}>
          {isLoading ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <>
              <View style={styles.inlineStat}>
                <Text style={styles.inlineStatValue}>{stats.totalWorkouts}</Text>
                <Text style={styles.inlineStatLabel}>Workouts</Text>
              </View>
              <View style={styles.inlineStatDivider} />
              <View style={styles.inlineStat}>
                <Text style={styles.inlineStatValue}>{formatVolume(stats.totalVolume)}</Text>
                <Text style={styles.inlineStatLabel}>Volume</Text>
              </View>
              <View style={styles.inlineStatDivider} />
              <View style={styles.inlineStat}>
                <Text style={styles.inlineStatValue}>{stats.totalSets}</Text>
                <Text style={styles.inlineStatLabel}>Sets</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Settings Section */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.settingsCard}>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.settingsRow,
              index < settingsItems.length - 1 && styles.settingsRowBorder,
            ]}
            activeOpacity={0.7}
            onPress={item.onPress}
          >
            <View
              style={[
                styles.settingsIconWrap,
                item.destructive && styles.settingsIconWrapDestructive,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.destructive ? palette.error : palette.accent}
              />
            </View>
            <View style={styles.settingsTextWrap}>
              <Text
                style={[
                  styles.settingsLabel,
                  item.destructive && styles.settingsLabelDestructive,
                ]}
              >
                {item.label}
              </Text>
              {item.subtitle && (
                <Text style={styles.settingsSubtitle}>{item.subtitle}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // Profile Card
  profileCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: palette.accent,
  },
  avatarText: {
    color: palette.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  profileName: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileEmail: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },

  // Inline Stats
  inlineStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    width: '100%',
  },
  inlineStat: {
    flex: 1,
    alignItems: 'center',
  },
  inlineStatValue: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  inlineStatLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inlineStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: palette.border,
  },

  // Settings
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  settingsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingsIconWrapDestructive: {
    backgroundColor: palette.error + '18',
  },
  settingsTextWrap: {
    flex: 1,
  },
  settingsLabel: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  settingsLabelDestructive: {
    color: palette.error,
  },
  settingsSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
});