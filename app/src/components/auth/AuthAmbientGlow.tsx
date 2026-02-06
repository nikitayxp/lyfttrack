import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type AuthAmbientGlowProps = {
  children: ReactNode;
};

import { Colors } from '@/constants/Colors';
import { Radius } from '@/constants/Styles';

const palette = Colors.dark;
const ROOT_SCREEN_BG = palette.bgPrimary;

export function AuthAmbientGlow({ children }: AuthAmbientGlowProps) {
  const orbOneScale = useSharedValue(1);
  const orbOneX = useSharedValue(-14);
  const orbOneY = useSharedValue(-10);

  const orbTwoScale = useSharedValue(1);
  const orbTwoX = useSharedValue(12);
  const orbTwoY = useSharedValue(10);

  useEffect(() => {
    const easing = Easing.inOut(Easing.sin);

    orbOneScale.value = withRepeat(withTiming(1.14, { duration: 7800, easing }), -1, true);
    orbOneX.value = withRepeat(withTiming(10, { duration: 9200, easing }), -1, true);
    orbOneY.value = withRepeat(withTiming(16, { duration: 8400, easing }), -1, true);

    orbTwoScale.value = withRepeat(withTiming(1.1, { duration: 8600, easing }), -1, true);
    orbTwoX.value = withRepeat(withTiming(-12, { duration: 9800, easing }), -1, true);
    orbTwoY.value = withRepeat(withTiming(-14, { duration: 9000, easing }), -1, true);

    return () => {
      cancelAnimation(orbOneScale);
      cancelAnimation(orbOneX);
      cancelAnimation(orbOneY);
      cancelAnimation(orbTwoScale);
      cancelAnimation(orbTwoX);
      cancelAnimation(orbTwoY);
    };
  }, [orbOneScale, orbOneX, orbOneY, orbTwoScale, orbTwoX, orbTwoY]);

  const orbOneStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: orbOneX.value }, { translateY: orbOneY.value }, { scale: orbOneScale.value }],
  }));

  const orbTwoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: orbTwoX.value }, { translateY: orbTwoY.value }, { scale: orbTwoScale.value }],
  }));

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.orbLayer}>
        <Animated.View style={[styles.orbBase, styles.orbOne, orbOneStyle]} />
        <Animated.View style={[styles.orbBase, styles.orbTwo, orbTwoStyle]} />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ROOT_SCREEN_BG,
  },
  orbLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orbBase: {
    position: 'absolute',
    borderRadius: Radius.pill,
    backgroundColor: palette.accent,
  },
  orbOne: {
    width: 340,
    height: 340,
    top: -170,
    left: -140,
    opacity: 0.08,
  },
  orbTwo: {
    width: 300,
    height: 300,
    right: -130,
    bottom: -140,
    opacity: 0.06,
  },
});
