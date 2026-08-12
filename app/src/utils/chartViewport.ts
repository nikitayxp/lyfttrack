export function resolveChartScrollMax(contentWidth: number, plotWidth: number): number {
  return Math.max(0, contentWidth - plotWidth);
}

export function isChartAtNewestEnd(x: number, max: number): boolean {
  return x >= max - 1;
}

export function resolveInitialPointerIndex(points: { isActive?: boolean }[]): number {
  return points.length === 0 ? -1 : points.length - 1;
}

export type PointerCardEdge = 'start' | 'middle' | 'end';

export function resolvePointerCardEdge(index: number, count: number): PointerCardEdge {
  if (count <= 1 || index <= 0) {
    return 'start';
  }

  if (index >= count - 1) {
    return 'end';
  }

  return 'middle';
}

export function resolvePointerCardShiftX(edge: PointerCardEdge, alignCorrection: number): number {
  return edge === 'end' ? 0 : alignCorrection;
}

export function resolveDragScrollX(
  startScrollX: number,
  startClientX: number,
  clientX: number,
  max: number
): number {
  return Math.min(max, Math.max(0, startScrollX + (startClientX - clientX)));
}
