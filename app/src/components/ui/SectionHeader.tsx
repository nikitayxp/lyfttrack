import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Spacing } from '@/constants/Styles';

const palette = Colors.dark;

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, actionLabel, onActionPress, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          activeOpacity={ACTIVE_OPACITY}
          onPress={onActionPress}
          style={styles.pill}
        >
          <Text style={styles.pillText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
