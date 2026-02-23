import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';

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
      accessibilityState={{ selected }}
      activeOpacity={ACTIVE_OPACITY}
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
    minHeight: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.chipBorder,
    backgroundColor: palette.chipFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chipSelected: {
    borderColor: palette.chipBorderSelected,
    backgroundColor: palette.chipFillSelected,
  },
  chipText: {
    color: palette.chipText,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: palette.chipTextSelected,
  },
});
