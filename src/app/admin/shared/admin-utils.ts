export interface RankedItem {
  label: string;
  count: number;
}

export interface WeekdayBar {
  label: string;
  count: number;
  height: string;
}

export function dateValue(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

export function rankBy<T>(items: T[], getter: (item: T) => string): RankedItem[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getter(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function weekdayBars(items: { created_at: string | null }[]): WeekdayBar[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const item of items) {
    if (!item.created_at) {
      continue;
    }
    const day = new Date(item.created_at).getDay();
    counts[day] += 1;
  }

  const max = Math.max(...counts, 1);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return counts.map((count, index) => ({
    label: labels[index],
    count,
    height: `${Math.max(18, (count / max) * 100)}%`,
  }));
}
