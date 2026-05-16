/** YYYY-MM-DD from local calendar date. */
export function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateKey() {
  return dateKeyFromDate(new Date());
}

export function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const base = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  base.setUTCDate(base.getUTCDate() + days);
  const y = base.getUTCFullYear();
  const m = `${base.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${base.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function prettyDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
