export function resolveChartScrollMax(contentWidth: number, plotWidth: number): number {
  return Math.max(0, contentWidth - plotWidth);
}

export function isChartAtNewestEnd(x: number, max: number): boolean {
  return x >= max - 1;
}

export function resolveInitialPointerIndex(points: { isActive?: boolean }[]): number {
  return points.length === 0 ? -1 : points.length - 1;
}
