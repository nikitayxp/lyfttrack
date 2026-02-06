import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/Colors';

const palette = Colors.dark;

export function SplashLoader() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fade in + scale
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar appears after logo
    const barTimer = setTimeout(() => {
      Animated.timing(barOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Animate bar width (non-native driver for layout prop)
      Animated.timing(barWidth, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 400);

    // Subtle pulse glow behind logo
    const pulseTimer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.35,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.08,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 200);

    return () => {
      clearTimeout(barTimer);
      clearTimeout(pulseTimer);
    };
  }, [barOpacity, barWidth, logoOpacity, logoScale, pulseOpacity]);

  const barInterpolatedWidth = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.screen}>
      {/* Pulsing glow */}
      <Animated.View style={[styles.pulseGlow, { opacity: pulseOpacity }]} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Animated.Text style={styles.logoLyft}>Lyft</Animated.Text>
        <Animated.Text style={styles.logoTrack}>Track</Animated.Text>
      </Animated.View>

      {/* Progress bar */}
      <Animated.View style={[styles.barTrack, { opacity: barOpacity }]}>
        <Animated.View
          style={[styles.barFill, { width: barInterpolatedWidth }]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: palette.accent,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoLyft: {
    color: palette.textPrimary,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  logoTrack: {
    color: palette.accent,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  barTrack: {
    position: 'absolute',
    bottom: '18%',
    width: 140,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: palette.accent,
  },
});
