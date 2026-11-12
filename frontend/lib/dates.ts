// Calendar-date helpers. Dates are YYYY-MM-DD strings in IST so that
// "today" means the farmer's today, not UTC's.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function todayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function currentSeason(isoDate: string): 'kharif' | 'rabi' | 'zaid' {
  const month = Number(isoDate.slice(5, 7));
  if (month >= 6 && month <= 9) return 'kharif';
  if (month >= 3 && month <= 5) return 'zaid';
  return 'rabi';
}
