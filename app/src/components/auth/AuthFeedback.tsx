import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Radius } from '@/constants/Styles';

const palette = Colors.dark;

export type AuthFeedbackValue = {
  message: string;
  type: 'error' | 'success' | 'info';
};

const ICON_BY_TYPE = {
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
} as const;

const COLOR_BY_TYPE = {
  error: palette.error,
  success: palette.success,
  info: palette.accent,
} as const;

type AuthFeedbackProps = {
  feedback: AuthFeedbackValue | null;
};

export function AuthFeedback({ feedback }: AuthFeedbackProps) {
  const shake = useSharedValue(0);

  useEffect(() => {
    if (feedback?.type !== 'error') {
      return;
    }

    // Re-runs on every new feedback object, so submitting twice with the same
    // problem shakes again instead of leaving a banner that looks unchanged.
    shake.value = withSequence(
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(-4, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [feedback, shake]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  if (!feedback) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(140)}
      style={[
        styles.banner,
        feedback.type === 'error'
          ? styles.bannerError
          : feedback.type === 'success'
            ? styles.bannerSuccess
            : styles.bannerInfo,
        shakeStyle,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons name={ICON_BY_TYPE[feedback.type]} size={16} color={COLOR_BY_TYPE[feedback.type]} />
      <Text style={styles.text}>{feedback.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    columnGap: 8,
    marginTop: 12,
  },
  bannerError: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.19)',
  },
  bannerSuccess: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.19)',
  },
  bannerInfo: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.19)',
  },
  text: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
