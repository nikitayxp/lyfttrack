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
const auxiliaryTabOptions = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

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
      backBehavior="history"
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
          tabBarIcon: ({ focused }) => <Ionicons name="newspaper-outline" size={TAB_ICON_SIZE} color={focused ? palette.accent : palette.tabIconDefault} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: t('tabs.workout'),
          tabBarIcon: ({ focused }) => <Ionicons name="barbell-outline" size={TAB_ICON_SIZE} color={focused ? palette.accent : palette.tabIconDefault} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <Ionicons name="person-outline" size={TAB_ICON_SIZE} color={focused ? palette.accent : palette.tabIconDefault} />,
        }}
      />
      <Tabs.Screen
        name="athletes"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="exercises"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="social"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="stats"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="profile/edit"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="profile/settings"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="profile/import"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="public-profile/[id]"
        options={auxiliaryTabOptions}
      />
      <Tabs.Screen
        name="profile/[id]"
        options={auxiliaryTabOptions}
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
    ...(Platform.OS === 'web'
      ? {
          position: 'absolute' as const,
          left: 0,
          right: 0,
          bottom: 0,
        }
      : null),
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
