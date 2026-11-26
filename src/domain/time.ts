// Theo dõi thời gian: tính phút, định dạng, đọc chuỗi nhập tay ("1h30", "1:30", "90"), tổng hợp. Hàm thuần.
import type { TimeEntry } from './types';
import type { Period } from './stats';
import { diffDays } from './dates';

export const MAX_ENTRY_MINUTES = 1440; // khớp Firestore Rules

/** Số phút giữa hai thời điểm ISO, làm tròn, tối thiểu 1, tối đa 24 giờ (đồng hồ quên tắt không phình số liệu). */
export function elapsedMinutes(startIso: string, endIso: string): number {
  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  return Math.min(MAX_ENTRY_MINUTES, Math.max(1, Math.round(ms / 60_000)));
}

export function formatMinutes(m: number): string {
  const v = Math.max(0, Math.round(m));
  const h = Math.floor(v / 60);
  const r = v % 60;
  if (h === 0) return `${r} phút`;
  return r === 0 ? `${h} giờ` : `${h} giờ ${r} phút`;
}

/** Giờ dạng thập phân cho báo cáo/CSV: 90 phút → 1.5 */
export const toHours = (m: number): number => Math.round((m / 60) * 100) / 100;

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** "90" · "1:30" · "1h30" · "1g30p" · "1.5h" · "45p" · "2 giờ 15 phút" → số phút (1–1440), hoặc null nếu không hiểu. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, '.');
  if (s === '') return null;
  let m: RegExpExecArray | null;
  let minutes: number | null = null;
  if ((m = /^(\d+)$/.exec(s))) minutes = Number(m[1]);
  else if ((m = /^(\d+):(\d{1,2})$/.exec(s))) minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = /^(\d+(?:\.\d+)?)\s*(?:h|g|gio|giờ)$/.exec(s))) minutes = Math.round(Number(m[1]) * 60);
  else if ((m = /^(\d+)\s*(?:m|p|phut|phút)$/.exec(s))) minutes = Number(m[1]);
  else if ((m = /^(\d+)\s*(?:h|g|gio|giờ)\s*(\d+)\s*(?:m|p|phut|phút)?$/.exec(s))) minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes === null || !Number.isFinite(minutes) || minutes < 1 || minutes > MAX_ENTRY_MINUTES) return null;
  return minutes;
}

export const sumMinutes = (entries: Pick<TimeEntry, 'minutes'>[]): number => entries.reduce((a, e) => a + e.minutes, 0);

export function groupMinutes<T extends Pick<TimeEntry, 'minutes'>>(entries: T[], key: (e: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) out.set(key(e), (out.get(key(e)) ?? 0) + e.minutes);
  return out;
}

export const entriesInPeriod = <T extends Pick<TimeEntry, 'day'>>(entries: T[], p: Period): T[] =>
  entries.filter((e) => diffDays(e.day, p.start) >= 0 && diffDays(e.day, p.end) <= 0);
