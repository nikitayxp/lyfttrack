import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, HIT_SLOP, Radius, Typography } from '@/constants/Styles';

const palette = Colors.dark;

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, selected = false, onPress, style }: ChipProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      activeOpacity={ACTIVE_OPACITY}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        style,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexShrink: 0,
    minHeight: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  chipText: {
    ...Typography.chip,
    color: palette.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});
