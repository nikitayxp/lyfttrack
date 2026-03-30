import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';

const palette = Colors.dark;

const styles = StyleSheet.create({
  desktopBackground: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceMockup: {
    width: 390,
    height: 844,
    backgroundColor: '#000',
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 10,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
});

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;

  const segments = useSegments();
  const segmentsRef = useRef<string[]>(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const redirectForSession = useCallback((session: Session | null) => {
    const currentSegments = segmentsRef.current;
    const inAuthGroup = currentSegments[0] === '(auth)';

    if (session) {
      if (inAuthGroup) {
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

  const layout = (
    <SafeAreaProvider style={{ flex: 1 }} initialMetrics={initialWindowMetrics}>
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
          }}
        />
        <Stack.Screen
          name="workout/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            statusBarStyle: 'light',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.desktopBackground}>
        <View style={styles.deviceMockup}>
          <StatusBar style="light" />
          {layout}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      {layout}
      <StatusBar style="light" />
    </View>
  );
}