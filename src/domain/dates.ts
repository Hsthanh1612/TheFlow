// Ngày lịch dạng YYYY-MM-DD, tính theo UTC để không phụ thuộc múi giờ máy.

const DAY = 86_400_000;

export function parseDay(d: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Ngày không hợp lệ: ${d}`);
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const back = new Date(t).toISOString().slice(0, 10);
  if (back !== d) throw new Error(`Ngày không tồn tại: ${d}`);
  return t;
}

export function isValidDay(d: string): boolean {
  try {
    parseDay(d);
    return true;
  } catch {
    return false;
  }
}

export function formatDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  return formatDay(parseDay(d) + n * DAY);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a) - parseDay(b)) / DAY);
}

export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ngày (YYYY-MM-DD) của thứ Hai đầu tuần chứa d. */
export function weekStart(d: string): string {
  const t = parseDay(d);
  const dow = new Date(t).getUTCDay(); // 0 = CN
  const back = dow === 0 ? 6 : dow - 1;
  return formatDay(t - back * DAY);
}

/** Lấy phần ngày từ chuỗi ISO datetime. */
export function dayOfIso(iso: string): string {
  return iso.slice(0, 10);
}

export function vnDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function vnDayMonth(d: string | null): string {
  if (!d) return '—';
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}
