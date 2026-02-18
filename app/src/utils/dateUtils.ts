export function formatRelativeTime(iso: string): string {
  const timestamp = new Date(iso);

  if (Number.isNaN(timestamp.getTime())) {
    return 'Just now';
  }

  const nowMs = Date.now();
  const diffMs = nowMs - timestamp.getTime();

  if (diffMs <= 0) {
    return 'Just now';
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return 'Just now';
  }

  const minutes = Math.floor(diffMs / minuteMs);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(diffMs / hourMs);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(diffMs / dayMs);
  if (days < 30) {
    return `${days}d`;
  }

  return timestamp.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
