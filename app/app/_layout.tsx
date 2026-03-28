import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

const palette = Colors.dark;

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)/workout' as any);
      } else {
        router.replace('/(auth)' as any);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          router.replace('/(tabs)/workout' as any);
        } else {
          router.replace('/(auth)' as any);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bgPrimary },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workout/active"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            statusBarStyle: 'light',
            statusBarTranslucent: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}