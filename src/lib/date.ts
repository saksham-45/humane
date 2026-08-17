/** UTC calendar date as YYYY-MM-DD. */
export function utcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function yesterdayOf(date: string): string {
  const [y, m, day] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function formatStamp(date: string): string {
  const [, m, d] = date.split("-");
  return `${m}.${d}`;
}

export function parseDateParam(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return value;
}
