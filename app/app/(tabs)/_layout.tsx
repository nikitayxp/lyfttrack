import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import {
  TAB_BAR_TOP_PADDING,
  TAB_ICON_SIZE,
  getTabBarBottomPadding,
  getTabBarHeight,
} from '@/constants/tabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const palette = Colors.dark;

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const tabBarHeight = getTabBarHeight(isWeb, insets.bottom);
  const tabBarBottomPadding = getTabBarBottomPadding(isWeb, insets.bottom);

  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        height: tabBarHeight,
        paddingBottom: tabBarBottomPadding,
        paddingTop: TAB_BAR_TOP_PADDING,
      },
    ],
    [tabBarBottomPadding, tabBarHeight]
  );

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        header: () => <View style={[styles.headerSafeArea, { height: insets.top }]} />,
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
          title: t('tabs.feed'),
          tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: t('tabs.workout'),
          tabBarIcon: ({ color }) => <Ionicons name="barbell-outline" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={TAB_ICON_SIZE} color={color} />,
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
        }}
      />
      <Tabs.Screen
        name="profile/settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/import"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="public-profile/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerSafeArea: {
    backgroundColor: palette.bgPrimary,
  },
  tabBar: {
    backgroundColor: palette.tabBarBackground,
    borderTopColor: palette.border,
    borderTopWidth: 1,
  },
  tabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    marginBottom: 0,
    lineHeight: 12,
  },
});
