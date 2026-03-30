import { useCallback, useEffect, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';

const palette = Colors.dark;

/** Largura mínima (px) para mostrar o mockup de telemóvel na Web; ≤ isto = app a fullscreen como no device. */
const DESKTOP_WEB_MOCKUP_MIN_WIDTH = 768;

/** react-native-web aceita `vh`; o tipo `DimensionValue` do RN ainda não inclui esta string. */
const webViewportFill: ViewStyle = {
  width: '100%',
  height: '100%' as ViewStyle['height'],
  minHeight: '100dvh' as ViewStyle['minHeight'],
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  safeAreaWeb: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: '100%',
    backgroundColor: '#000000',
  },
  desktopBackground: {
    flex: 1,
    backgroundColor: '#000000',
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
    borderColor: '#27272A',
  },
});

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width > DESKTOP_WEB_MOCKUP_MIN_WIDTH;
  const safeAreaStyle = isWeb ? styles.safeAreaWeb : styles.safeArea;

  const segments = useSegments();
  const segmentsRef = useRef<string[]>(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const previous = {
      htmlHeight: html.style.height,
      htmlMinHeight: html.style.minHeight,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
      bodyMargin: body.style.margin,
      bodyBackground: body.style.backgroundColor,
      rootHeight: root?.style.height ?? '',
      rootMinHeight: root?.style.minHeight ?? '',
      rootDisplay: root?.style.display ?? '',
      rootFlexDirection: root?.style.flexDirection ?? '',
      rootBackground: root?.style.backgroundColor ?? '',
    };

    html.style.height = '100%';
    html.style.minHeight = '100%';

    body.style.height = '100%';
    body.style.minHeight = '100%';
    body.style.margin = '0';
    body.style.backgroundColor = '#000000';

    if (root) {
      root.style.height = '100%';
      root.style.minHeight = '100%';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.backgroundColor = '#000000';
    }

    return () => {
      html.style.height = previous.htmlHeight;
      html.style.minHeight = previous.htmlMinHeight;

      body.style.height = previous.bodyHeight;
      body.style.minHeight = previous.bodyMinHeight;
      body.style.margin = previous.bodyMargin;
      body.style.backgroundColor = previous.bodyBackground;

      if (root) {
        root.style.height = previous.rootHeight;
        root.style.minHeight = previous.rootMinHeight;
        root.style.display = previous.rootDisplay;
        root.style.flexDirection = previous.rootFlexDirection;
        root.style.backgroundColor = previous.rootBackground;
      }
    };
  }, [isWeb]);

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
    <SafeAreaProvider style={safeAreaStyle} initialMetrics={isWeb ? undefined : initialWindowMetrics}>
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
      <View style={[styles.desktopBackground, isWeb && webViewportFill]}>
        <View style={styles.deviceMockup}>
          <StatusBar style="light" />
          {layout}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, isWeb && webViewportFill]}>
      {layout}
      <StatusBar style="light" />
    </View>
  );
}