import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const palette = Colors.dark;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        height: (Platform.OS === 'ios' ? 72 : 64) + Math.max(insets.bottom, 10),
        paddingBottom: Math.max(insets.bottom, 10),
      },
    ],
    [insets.bottom]
  );

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerStyle: styles.header,
        headerTintColor: palette.textPrimary,
        headerTitleStyle: styles.headerTitle,
        headerShadowVisible: false,
        tabBarStyle,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarLabelStyle: styles.workoutLabel,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.workoutIconContainer, focused && styles.workoutIconContainerFocused]}>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/edit"
        options={{
          href: null,
          title: 'Edit Profile',
        }}
      />
      <Tabs.Screen
        name="public-profile/[id]"
        options={{
          href: null,
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: palette.bgPrimary,
  },
  headerTitle: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  tabBar: {
    backgroundColor: palette.tabBarBackground,
    borderTopColor: palette.border,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  workoutLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  workoutIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    borderWidth: 4,
    borderColor: palette.tabBarBackground,
  },
  workoutIconContainerFocused: {
    transform: [{ scale: 1.03 }],
  },
});