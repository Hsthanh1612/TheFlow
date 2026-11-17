import { diffDays } from './dates';

export interface Span {
  firstCol: number; // 0-based trong cửa sổ
  lastCol: number;
}

/**
 * Cột (theo tuần) mà thanh thời gian [from, to] chiếm trong cửa sổ `weeks` tuần bắt đầu từ `windowStart` (thứ Hai).
 * Trả về null nếu không giao với cửa sổ hoặc không có hạn. Nếu bắt đầu muộn hơn hạn thì coi như bắt đầu đúng hạn.
 */
export function timelineSpan(from: string, to: string | null, windowStart: string, weeks: number): Span | null {
  if (to === null) return null;
  const begin = diffDays(from, to) > 0 ? to : from;
  const colOf = (d: string) => Math.floor(diffDays(d, windowStart) / 7);
  const a = colOf(begin);
  const b = colOf(to);
  if (b < 0 || a > weeks - 1) return null;
  return { firstCol: Math.max(a, 0), lastCol: Math.min(b, weeks - 1) };
}
