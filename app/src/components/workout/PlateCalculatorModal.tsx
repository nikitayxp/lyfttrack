import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';

const palette = Colors.dark;
const STANDARD_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

type PlateBreakdownItem = {
  plate: number;
  countPerSide: number;
};

type PlateCalculationResult = {
  perSideTarget: number;
  loadableTotal: number;
  remainderPerSide: number;
  breakdown: PlateBreakdownItem[];
};

type PlateCalculatorModalProps = {
  visible: boolean;
  onClose: () => void;
  initialTotalWeight?: string | number | null;
  defaultBarWeight?: number;
};

function sanitizeDecimalInput(value: string): string {
  const digitsAndDot = value.replace(/[^0-9.]/g, '');
  const [head, ...tail] = digitsAndDot.split('.');

  if (tail.length === 0) {
    return head;
  }

  return `${head}.${tail.join('')}`;
}

function parseNonNegativeNumber(value: string): number {
  if (!value || value === '.') {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function formatWeight(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const normalized = value.toFixed(2);
  return normalized.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function calculatePlateBreakdown(totalWeight: number, barWeight: number): PlateCalculationResult {
  const normalizedTotalWeight = Math.max(0, totalWeight);
  const normalizedBarWeight = Math.max(0, barWeight);
  const loadableTotal = Math.max(0, normalizedTotalWeight - normalizedBarWeight);
  const perSideTarget = loadableTotal / 2;

  let remainingPerSide = perSideTarget;
  const breakdown: PlateBreakdownItem[] = [];

  for (const plate of STANDARD_PLATES) {
    const countPerSide = Math.floor((remainingPerSide + 1e-6) / plate);

    if (countPerSide <= 0) {
      continue;
    }

    breakdown.push({
      plate,
      countPerSide,
    });

    remainingPerSide = Number((remainingPerSide - countPerSide * plate).toFixed(2));
  }

  const remainderPerSide = Math.max(0, Number(remainingPerSide.toFixed(2)));

  return {
    perSideTarget,
    loadableTotal,
    remainderPerSide,
    breakdown,
  };
}

export function PlateCalculatorModal({
  visible,
  onClose,
  initialTotalWeight,
  defaultBarWeight = 20,
}: PlateCalculatorModalProps) {
  const [totalWeightInput, setTotalWeightInput] = useState('');
  const [barWeightInput, setBarWeightInput] = useState(formatWeight(defaultBarWeight));

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (typeof initialTotalWeight === 'number' && Number.isFinite(initialTotalWeight)) {
      setTotalWeightInput(formatWeight(initialTotalWeight));
    } else if (typeof initialTotalWeight === 'string') {
      setTotalWeightInput(sanitizeDecimalInput(initialTotalWeight));
    } else {
      setTotalWeightInput('');
    }

    setBarWeightInput(formatWeight(defaultBarWeight));
  }, [defaultBarWeight, initialTotalWeight, visible]);

  const calculation = useMemo(() => {
    const totalWeight = parseNonNegativeNumber(totalWeightInput);
    const barWeight = parseNonNegativeNumber(barWeightInput);

    return calculatePlateBreakdown(totalWeight, barWeight);
  }, [barWeightInput, totalWeightInput]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Plate Calculator</Text>
              <Text style={styles.subtitle}>Barbell setup by side using standard plate sizes.</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} activeOpacity={0.88} onPress={onClose}>
              <Ionicons name="close" size={18} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputsRow}>
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Total Weight (kg)</Text>
              <TextInput
                value={totalWeightInput}
                onChangeText={(value) => setTotalWeightInput(sanitizeDecimalInput(value))}
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="100"
                placeholderTextColor={palette.textMuted}
              />
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Bar Weight (kg)</Text>
              <TextInput
                value={barWeightInput}
                onChangeText={(value) => setBarWeightInput(sanitizeDecimalInput(value))}
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="20"
                placeholderTextColor={palette.textMuted}
              />
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Per Side</Text>
              <Text style={styles.summaryValue}>{formatWeight(calculation.perSideTarget)} kg</Text>
            </View>

            <View>
              <Text style={styles.summaryLabel}>Loadable</Text>
              <Text style={styles.summaryValue}>{formatWeight(calculation.loadableTotal)} kg</Text>
            </View>
          </View>

          <View style={styles.listCard}>
            <Text style={styles.listTitle}>Plate Stack (Each Side)</Text>

            {calculation.breakdown.length === 0 ? (
              <Text style={styles.placeholderText}>No plates required for this target.</Text>
            ) : (
              calculation.breakdown.map((item) => (
                <View key={`plate-${item.plate}`} style={styles.plateRow}>
                  <View style={styles.plateChip}>
                    <Text style={styles.plateChipText}>{formatWeight(item.plate)} kg</Text>
                  </View>

                  <Text style={styles.plateCountText}>x {item.countPerSide} each side</Text>
                </View>
              ))
            )}

            {calculation.remainderPerSide > 0 ? (
              <Text style={styles.remainderText}>
                Remainder per side: {formatWeight(calculation.remainderPerSide)} kg (no exact standard match)
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.overlay,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#111827',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#334155',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 10,
  },
  inputCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  inputLabel: {
    color: '#9FB1C9',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  input: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 9,
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 7,
  },
  plateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#122744',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plateChipText: {
    color: '#EAF1FF',
    fontSize: 12,
    fontWeight: '800',
  },
  plateCountText: {
    color: '#D1DBEA',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  remainderText: {
    marginTop: 4,
    color: '#F59E0B',
    fontSize: 12,
    lineHeight: 18,
  },
});
