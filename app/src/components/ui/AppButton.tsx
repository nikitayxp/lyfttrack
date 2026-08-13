import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';

const palette = Colors.dark;

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      activeOpacity={ACTIVE_OPACITY}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, isDisabled && !loading && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textPrimary} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: palette.accent,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
