export function getWebVisibleViewportHeight(layoutHeight: number, visualHeight: number): number {
  const layout = Number.isFinite(layoutHeight) && layoutHeight > 0 ? layoutHeight : 0;
  const visual = Number.isFinite(visualHeight) && visualHeight > 0 ? visualHeight : layout;

  if (layout === 0) {
    return Math.round(visual);
  }

  return Math.round(Math.min(layout, visual));
}
