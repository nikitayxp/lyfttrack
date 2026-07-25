import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { TAB_ICON_SIZE } from '@/constants/tabBar';
import { useTranslation } from 'react-i18next';

const palette = Colors.dark;

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerStyle: styles.header,
        headerTintColor: palette.textPrimary,
        headerTitleStyle: styles.headerTitle,
        headerShadowVisible: false,
        tabBarStyle: styles.tabBar,
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
          title: t('tabs.editProfile'),
        }}
      />
      <Tabs.Screen
        name="profile/settings"
        options={{
          href: null,
          title: t('tabs.settings'),
        }}
      />
      <Tabs.Screen
        name="public-profile/[id]"
        options={{
          href: null,
          title: t('tabs.publicProfile'),
        }}
      />
      <Tabs.Screen
        name="profile/[id]"
        options={{
          href: null,
          title: t('tabs.publicProfile'),
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
  },
});
