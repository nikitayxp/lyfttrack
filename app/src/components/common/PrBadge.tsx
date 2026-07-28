import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius } from '@/constants/Styles';

const palette = Colors.dark;

type PrBadgeProps = {
  count: number | null | undefined;
  /** Compact drops the count and keeps only the trophy, for tight rows. */
  compact?: boolean;
};

/**
 * Renders nothing without a record, which is the point: a "0 records" badge is
 * noise on the majority of workouts and says nothing worth reading.
 */
export function PrBadge({ count, compact = false }: PrBadgeProps) {
  const { t } = useTranslation();

  if (!count || count <= 0) {
    return null;
  }

  return (
    <View
      style={[styles.badge, compact && styles.badgeCompact]}
      accessibilityLabel={t('feed.metrics.recordsBadge', { count })}
    >
      <Ionicons name="trophy" size={compact ? 11 : 12} color={palette.warningText} />
      {compact ? null : <Text style={styles.count}>{count}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.32)',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  badgeCompact: {
    paddingHorizontal: 5,
  },
  count: {
    color: palette.warningText,
    fontSize: 12,
    fontWeight: '800',
  },
});
