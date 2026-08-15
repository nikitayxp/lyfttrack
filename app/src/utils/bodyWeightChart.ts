export const BODY_WEIGHT_CHART_EDGE_SPACING = 20;

const CHART_SECTIONS = 4;
const MAX_CHART_SECTIONS = 6;

export type BodyWeightChartEntry = {
  id: string;
  weight: number;
  recorded_at: string;
};

export type BodyWeightChartPoint = {
  id: string;
  value: number;
  recordedAt: string;
};

export function toBodyWeightChartPoints(entries: BodyWeightChartEntry[]): BodyWeightChartPoint[] {
  const chronological: BodyWeightChartPoint[] = [];

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry || !Number.isFinite(entry.weight) || entry.weight <= 0) {
      continue;
    }

    chronological.push({
      id: entry.id,
      value: entry.weight,
      recordedAt: entry.recorded_at,
    });
  }

  return chronological.length >= 2 ? chronological : [];
}

function niceAxisStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  for (const candidate of [1, 2, 2.5, 5]) {
    if (normalized <= candidate) {
      return candidate * magnitude;
    }
  }

  return 10 * magnitude;
}

export function resolveBodyWeightChartRange(values: number[]): { min: number; max: number; sections: number } {
  const finite = values.filter((value) => Number.isFinite(value));

  if (finite.length === 0) {
    return { min: 0, max: CHART_SECTIONS, sections: CHART_SECTIONS };
  }

  const highest = Math.max(...finite);
  const lowest = Math.min(...finite);
  const spread = highest - lowest;
  const padding = spread === 0 ? Math.max(1, highest * 0.1) : spread * 0.15;
  const step = niceAxisStep((spread + padding * 2) / CHART_SECTIONS);
  const min = Math.max(0, Math.floor((lowest - padding) / step) * step);

  let sections = Math.ceil((highest + padding - min) / step);
  sections = Math.min(MAX_CHART_SECTIONS, Math.max(2, sections));

  if (min + step * sections <= highest) {
    sections += 1;
  }

  return { min, max: min + step * sections, sections };
}

export function resolveBodyWeightLineSpacing(plotWidth: number, pointCount: number): number {
  if (pointCount <= 1) {
    return 48;
  }

  const usable = Math.max(1, plotWidth - BODY_WEIGHT_CHART_EDGE_SPACING * 2);
  return Math.max(1, Math.floor(usable / (pointCount - 1)));
}

export function shouldLabelBodyWeightPoint(index: number, total: number, pointSpacing: number): boolean {
  if (total <= 2) {
    return true;
  }

  if (index === 0 || index === total - 1) {
    return true;
  }

  const step = Math.max(1, Math.ceil(72 / Math.max(1, pointSpacing)));
  return index % step === 0;
}
