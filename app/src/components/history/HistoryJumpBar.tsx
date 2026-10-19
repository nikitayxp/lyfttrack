import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius } from '@/constants/Styles';
import type { WorkoutMonthBucket } from '@/services/workoutService';

const palette = Colors.dark;
type HistoryJumpBarProps = {
  months: WorkoutMonthBucket[];
  selectedPeriodKey: string | null;
  onSelectPeriod: (key: string | null) => void;
  query: string;
  onChangeQuery: (value: string) => void;
  searchPlaceholder: string;
  allLabel: string;
  locale: string;
};

export function HistoryJumpBar({
  months,
  selectedPeriodKey,
  onSelectPeriod,
  query,
  onChangeQuery,
  searchPlaceholder,
  allLabel,
  locale,
}: HistoryJumpBarProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [browsingYear, setBrowsingYear] = useState<number | null>(null);
  const years = useMemo(
    () => [...new Set(months.map((bucket) => bucket.year))].sort((a, b) => b - a),
    [months],
  );
  const dateLocale = locale.startsWith('en') ? 'en-GB' : 'pt-PT';
  const year = browsingYear ?? years[0];
  const selectedMonth = months.find((bucket) => bucket.key === selectedPeriodKey);
  const periodLabel = selectedMonth
    ? new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleDateString(dateLocale, {
        month: 'long',
        year: 'numeric',
      })
    : (selectedPeriodKey ?? t('historyJump.allPeriods'));
  function select(period: string | null) {
    onSelectPeriod(period);
    setOpen(false);
  }
  if (months.length === 0 && !query) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={palette.textMuted} />
        <TextInput
          accessibilityLabel={searchPlaceholder}
          value={query}
          onChangeText={onChangeQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={palette.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          spellCheck={false}
          returnKeyType="search"
          inputMode="search"
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('historyJump.clearSearch')}
            onPress={() => onChangeQuery('')}
            style={styles.iconButton}
          >
            <Ionicons name="close-circle" size={20} color={palette.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('historyJump.period')}: ${periodLabel}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setBrowsingYear(selectedPeriodKey ? Number(selectedPeriodKey.slice(0, 4)) : (years[0] ?? null));
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.periodButton,
          selectedPeriodKey !== null && styles.selected,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="calendar-outline" size={19} color={palette.accentLight} />
        <View style={styles.periodText}>
          <Text style={styles.caption}>{t('historyJump.period')}</Text>
          <Text style={styles.periodValue}>{periodLabel}</Text>
        </View>
        <Ionicons name="chevron-down" size={17} color={palette.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={() => setOpen(false)}
          />
          <View
            style={styles.sheet}
            role="dialog"
            accessibilityLabel={t('historyJump.choosePeriod')}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('historyJump.choosePeriod')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                onPress={() => setOpen(false)}
                style={styles.iconButton}
              >
                <Ionicons name="close" size={22} color={palette.textPrimary} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={allLabel}
                accessibilityState={{ selected: selectedPeriodKey === null }}
                onPress={() => select(null)}
                style={[styles.choice, selectedPeriodKey === null && styles.selected]}
              >
                <Text style={styles.choiceText}>{t('historyJump.allPeriods')}</Text>
                <Ionicons name="infinite-outline" size={20} color={palette.accentLight} />
              </Pressable>
              <View style={styles.yearGrid}>
                {years.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={String(value)}
                    accessibilityState={{ selected: year === value }}
                    onPress={() => setBrowsingYear(value)}
                    style={[styles.year, year === value && styles.selected]}
                  >
                    <Text style={styles.choiceText}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              {year ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('historyJump.wholeYear', { year })}
                  accessibilityState={{ selected: selectedPeriodKey === String(year) }}
                  onPress={() => select(String(year))}
                  style={[styles.choice, selectedPeriodKey === String(year) && styles.selected]}
                >
                  <Text style={styles.choiceText}>{t('historyJump.wholeYear', { year })}</Text>
                  <Ionicons name="arrow-forward" size={18} color={palette.accentLight} />
                </Pressable>
              ) : null}
              <View style={styles.monthGrid}>
                {months
                  .filter((bucket) => bucket.year === year)
                  .map((bucket) => (
                    <Pressable
                      key={bucket.key}
                      accessibilityRole="button"
                      accessibilityLabel={new Date(bucket.year, bucket.month - 1, 1).toLocaleDateString(
                        dateLocale,
                        { month: 'long', year: 'numeric' },
                      )}
                      accessibilityState={{ selected: selectedPeriodKey === bucket.key }}
                      onPress={() => select(bucket.key)}
                      style={[styles.month, selectedPeriodKey === bucket.key && styles.selected]}
                    >
                      <Text style={styles.monthName}>
                        {new Date(bucket.year, bucket.month - 1, 1).toLocaleDateString(dateLocale, {
                          month: 'long',
                        })}
                      </Text>
                      <Text style={styles.caption}>
                        {t('historyJump.sessionCount', { count: bucket.count })}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16, gap: 8 },
  searchBar: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: Radius.md,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    paddingVertical: 12,
    color: palette.textPrimary,
    fontSize: 14,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    backgroundColor: palette.surface,
  },
  periodText: { flex: 1, minWidth: 0, gap: 2 },
  caption: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  periodValue: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  selected: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  pressed: { opacity: 0.75 },
  overlay: {
    flex: 1,
    backgroundColor: palette.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: palette.bgPrimary,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 4,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  sheetTitle: { color: palette.textPrimary, fontSize: 20, fontWeight: '800' },
  sheetContent: { padding: 16, gap: 12 },
  choice: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  choiceText: { color: palette.textPrimary, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  year: {
    minHeight: 44,
    minWidth: 68,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: {
    width: '47%',
    minHeight: 64,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.md,
    justifyContent: 'center',
    padding: 10,
    gap: 2,
  },
  monthName: { color: palette.textPrimary, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
});
