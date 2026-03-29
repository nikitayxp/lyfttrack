import { useCallback, useEffect, useRef } from 'react';
import { router, Stack, useSegments } from 'expo-router';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';

const palette = Colors.dark;

export default function RootLayout() {
  const segments = useSegments();
  const segmentsRef = useRef<string[]>(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const redirectForSession = useCallback((session: Session | null) => {
    const currentSegments = segmentsRef.current;
    const inAuthGroup = currentSegments[0] === '(auth)';
    const inTabsGroup = currentSegments[0] === '(tabs)';

    if (session) {
      if (!inTabsGroup) {
        router.replace('/(tabs)' as any);
      }

      return;
    }

    if (!inAuthGroup) {
      router.replace('/(auth)' as any);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) {
        return;
      }

      redirectForSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) {
          return;
        }

        redirectForSession(session);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [redirectForSession]);

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
        <Stack.Screen
          name="workout/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            statusBarStyle: 'light',
            statusBarTranslucent: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}