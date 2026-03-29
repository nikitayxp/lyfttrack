const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type PlateBreakdownItem = {
  plate: number;
  countPerSide: number;
};

export type PlateCalculationResult = {
  totalWeight: number;
  barWeight: number;
  perSideTarget: number;
  loadableTotal: number;
  remainderPerSide: number;
  breakdown: PlateBreakdownItem[];
};

function toNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

export function formatPlateWeight(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const normalized = value.toFixed(2);
  return normalized.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function calculatePlateBreakdown(totalWeight: number, barWeight = 20): PlateCalculationResult {
  const normalizedTotalWeight = toNonNegative(totalWeight);
  const normalizedBarWeight = toNonNegative(barWeight);
  const loadableTotal = Math.max(0, normalizedTotalWeight - normalizedBarWeight);
  const perSideTarget = loadableTotal / 2;

  let remainingPerSide = perSideTarget;
  const breakdown: PlateBreakdownItem[] = [];

  for (const plate of STANDARD_PLATES_KG) {
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

  return {
    totalWeight: normalizedTotalWeight,
    barWeight: normalizedBarWeight,
    perSideTarget,
    loadableTotal,
    remainderPerSide: Math.max(0, Number(remainingPerSide.toFixed(2))),
    breakdown,
  };
}
