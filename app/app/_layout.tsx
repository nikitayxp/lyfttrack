import { useCallback, useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import NeuralBackground from '@/components/ui/flow-field-background';
import { MinimizedWorkoutBar } from '@/components/workout/MinimizedWorkoutBar';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { WorkoutProvider } from '@/context/WorkoutContext';
import type { Session } from '@supabase/supabase-js';

const palette = Colors.dark;

/** Largura mínima (px) para mostrar o mockup de telemóvel na Web; ≤ isto = app a fullscreen como no device. */
const DESKTOP_WEB_MOCKUP_MIN_WIDTH = 768;

const webViewportFill: ViewStyle = {
  width: '100%',
  height: '100%' as ViewStyle['height'],
  minHeight: '100dvh' as ViewStyle['minHeight'],
  overflow: 'hidden',
};

const desktopShellWebShadow = {
  boxShadow: '0px 24px 64px rgba(0, 0, 0, 0.42)',
} as any;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webRoot: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  webRootDesktop: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  safeAreaWeb: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: '100%',
    backgroundColor: palette.bgPrimary,
  },
  webFlowLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  pointerEventsNone: {
    pointerEvents: 'none' as any,
  },
  webBlueAuraTop: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 520,
    top: -220,
    left: -120,
    opacity: 0.36,
    zIndex: 1,
    pointerEvents: 'none' as any,
  },
  webBlueAuraBottom: {
    position: 'absolute',
    width: 560,
    height: 560,
    borderRadius: 560,
    bottom: -250,
    right: -140,
    opacity: 0.28,
    zIndex: 1,
    pointerEvents: 'none' as any,
  },
  deviceMockup: {
    width: 393,
    height: 852,
    maxHeight: '95vh' as ViewStyle['maxHeight'],
    margin: 'auto' as any,
    backgroundColor: palette.bgPrimary,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: '#1a1a1a',
    zIndex: 10,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 20,
    transform: [{ translateY: 0 }],
  },
});

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width > DESKTOP_WEB_MOCKUP_MIN_WIDTH;
  const segments = useSegments();
  const currentAuthSegment = String(segments[1] ?? '');
  const isTabsRoute = segments[0] === '(tabs)';
  const isResetPasswordRoute = segments[0] === '(auth)' && currentAuthSegment === 'reset-password';
  const safeAreaStyle = isWeb ? styles.safeAreaWeb : styles.safeArea;

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
      htmlBackground: html.style.backgroundColor,
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
    html.style.backgroundColor = '#000000';

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
      html.style.backgroundColor = previous.htmlBackground;

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

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') {
      return;
    }

    document.body.classList.toggle('desktop-mockup-active', isDesktopWeb);

    return () => {
      document.body.classList.remove('desktop-mockup-active');
    };
  }, [isWeb, isDesktopWeb]);

  const redirectForSession = useCallback((session: Session | null) => {
    const inAuthGroup = segments[0] === '(auth)';

    if (session) {
      if (inAuthGroup && !isResetPasswordRoute) {
        router.replace('/(tabs)' as any);
      }

      return;
    }

    if (!inAuthGroup) {
      router.replace('/(auth)' as any);
    }
  }, [isResetPasswordRoute, segments]);

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
    <PreferencesProvider>
      <WorkoutProvider>
        <SafeAreaProvider style={safeAreaStyle} initialMetrics={isWeb ? undefined : initialWindowMetrics}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: palette.bgPrimary,
              },
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="workout/active"
              options={{
                headerShown: false,
                presentation: isWeb ? 'card' : 'fullScreenModal',
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
            <Stack.Screen
              name="athletes"
              options={{
                headerShown: false,
                animation: 'slide_from_right',
                statusBarStyle: 'light',
              }}
            />
          </Stack>
          <MinimizedWorkoutBar visible={isTabsRoute} />
        </SafeAreaProvider>
      </WorkoutProvider>
    </PreferencesProvider>
  );

  if (isWeb) {
    return (
      <View style={[styles.webRoot, isDesktopWeb && styles.webRootDesktop, webViewportFill]}>
        <View style={[styles.webFlowLayer, styles.pointerEventsNone]}>
          <NeuralBackground color="#3B82F6" trailOpacity={0.12} speed={0.35} />
        </View>

        <LinearGradient
          colors={['rgba(59,130,246,0.50)', 'rgba(59,130,246,0.00)']}
          start={{ x: 0.4, y: 0.2 }}
          end={{ x: 0.85, y: 0.9 }}
          style={[styles.webBlueAuraTop, styles.pointerEventsNone]}
        />
        <LinearGradient
          colors={['rgba(56,189,248,0.42)', 'rgba(56,189,248,0.00)']}
          start={{ x: 0.2, y: 0.15 }}
          end={{ x: 0.8, y: 0.85 }}
          style={[styles.webBlueAuraBottom, styles.pointerEventsNone]}
        />

        {isDesktopWeb ? <View style={[styles.deviceMockup, desktopShellWebShadow]}>{layout}</View> : layout}
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {layout}
      <StatusBar style="light" />
    </View>
  );
}