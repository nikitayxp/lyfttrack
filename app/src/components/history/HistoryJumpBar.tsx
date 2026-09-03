import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Chip } from '@/components/ui/Chip';
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

function formatMonthLabel(year: number, month: number, locale: string, withYear: boolean): string {
  const resolvedLocale = locale.startsWith('en') ? 'en-US' : 'pt-PT';
  return new Date(year, month - 1, 1).toLocaleDateString(resolvedLocale, {
    month: 'short',
    year: withYear ? 'numeric' : undefined,
  });
}

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
  const years = useMemo(() => {
    const unique = new Set(months.map((bucket) => bucket.year));
    return [...unique].sort((left, right) => right - left);
  }, [months]);

  const showYearChips = years.length > 1;
  const selectedYear = selectedPeriodKey
    ? Number(selectedPeriodKey.slice(0, 4))
    : showYearChips
      ? null
      : years[0] ?? null;
  const monthChips = selectedYear
    ? months.filter((bucket) => bucket.year === selectedYear)
    : [];

  if (months.length === 0 && !query) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={palette.textMuted} />
        <TextInput
          accessibilityLabel={searchPlaceholder}
          value={query}
          onChangeText={onChangeQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={palette.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Chip label={allLabel} selected={selectedPeriodKey === null} onPress={() => onSelectPeriod(null)} />

        {showYearChips
          ? years.map((year) => {
              const key = String(year);
              const selected = selectedPeriodKey === key || selectedPeriodKey?.startsWith(`${key}-`) === true;

              return (
                <Chip
                  key={key}
                  label={key}
                  selected={selected}
                  onPress={() => onSelectPeriod(selectedPeriodKey === key ? null : key)}
                />
              );
            })
          : null}

        {monthChips.map((bucket) => {
          const selected = selectedPeriodKey === bucket.key;

          return (
            <Chip
              key={bucket.key}
              label={formatMonthLabel(bucket.year, bucket.month, locale, !showYearChips)}
              selected={selected}
              onPress={() =>
                onSelectPeriod(selected ? (showYearChips ? String(bucket.year) : null) : bucket.key)
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    rowGap: 10,
  },
  searchBar: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingRight: 8,
  },
});
