/** The chart library adds 10px after the plot, besides its labelled Y axis. */
export function getBarChartLayout(containerWidth: number, axisWidth: number, count: number) {
  const width = Math.max(1, containerWidth - 18 - axisWidth - 10);
  const spacing = 4;
  const barWidth = Math.max(1, Math.min(28, Math.floor((width - 12) / Math.max(1, count)) - spacing));
  return { width, barWidth, spacing };
}
