import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing } from '@/constants/Styles';

const palette = Colors.dark;

const AUTO_DISMISS_MS = 2600;

type InlineToastProps = {
  message: string | null;
  onDismiss: () => void;
  tone?: 'info' | 'error';
};

/**
 * Exists because react-native's Alert renders nothing on web, and the paths
 * that need to say something — "the link was copied because this browser has no
 * share sheet" — are web-only. An Alert there is a message that never arrives.
 */
export function InlineToast({ message, onDismiss, tone = 'info' }: InlineToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = setTimeout(onDismiss, AUTO_DISMISS_MS);

    return () => clearTimeout(timeoutId);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(160)}
      style={[styles.toast, tone === 'error' && styles.toastError]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
        size={15}
        color={tone === 'error' ? palette.error : palette.success}
      />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.28)',
    backgroundColor: 'rgba(22,163,74,0.10)',
  },
  toastError: {
    borderColor: 'rgba(239,68,68,0.28)',
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  text: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
