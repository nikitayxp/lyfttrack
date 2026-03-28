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
      initialRouteName="workout"
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
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: 'Routines',
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={24} color={color} />,
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
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ color }) => <Ionicons name="barbell-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />,
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
    shadowColor: palette.accent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  workoutIconContainerFocused: {
    transform: [{ scale: 1.03 }],
  },
});