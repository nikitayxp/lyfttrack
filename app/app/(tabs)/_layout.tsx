import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const palette = Colors.dark;
const WEB_MOBILE_TAB_BAR_HEIGHT = 74;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const nativeBottomInset = Math.max(insets.bottom, 10);
  const tabBarHeight = isWeb
    ? WEB_MOBILE_TAB_BAR_HEIGHT
    : (Platform.OS === 'ios' ? 72 : 64) + nativeBottomInset;

  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        height: tabBarHeight,
        paddingBottom: isWeb ? 12 : Math.max(nativeBottomInset - 2, 10),
        paddingTop: isWeb ? 8 : 8,
      },
    ],
    [isWeb, nativeBottomInset, tabBarHeight]
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
        tabBarItemStyle: styles.tabItem,
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
          title: 'Treinar',
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
          title: 'Perfil',
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
          title: 'Editar perfil',
        }}
      />
      <Tabs.Screen
        name="profile/settings"
        options={{
          href: null,
          title: 'Definicoes',
        }}
      />
      <Tabs.Screen
        name="public-profile/[id]"
        options={{
          href: null,
          title: 'Perfil',
        }}
      />
      <Tabs.Screen
        name="profile/[id]"
        options={{
          href: null,
          title: 'Perfil',
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
  },
  tabItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
    marginBottom: 1,
  },
  workoutLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    marginBottom: 1,
  },
  workoutIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    borderWidth: 2,
    borderColor: palette.tabBarBackground,
  },
  workoutIconContainerFocused: {
    transform: [{ scale: 1.03 }],
  },
});