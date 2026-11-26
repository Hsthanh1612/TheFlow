// Ảnh chụp tình trạng theo tuần và burndown. Hàm thuần.
import type { SnapshotCounts, Task, WeekSnapshot, Workflow } from './types';
import { categoryOf } from './workflow';
import { addDays, dayOfIso, diffDays, weekStart } from './dates';
import { weekStarts, type Period } from './stats';

export const emptyCounts = (): SnapshotCounts => ({ todo: 0, doing: 0, review: 0, done: 0, late: 0 });
export const openOf = (c: SnapshotCounts): number => c.todo + c.doing + c.review + c.late;

/** Cùng cách phân loại với màn Tổng quan: xong; quá hạn (chưa xong); chờ duyệt; đang làm; chờ làm. */
export function countTasks(tasks: Task[], wfOf: (t: Task) => Workflow | undefined, today: string): SnapshotCounts {
  const c = emptyCounts();
  for (const t of tasks) {
    const cat = categoryOf(wfOf(t), t.stateKey);
    if (cat === 'done') c.done++;
    else if (t.dueAt !== null && diffDays(t.dueAt, today) < 0) c.late++;
    else c[cat]++;
  }
  return c;
}

export const weekKey = (day: string): string => weekStart(day);

export function makeSnapshot(tasks: Task[], wfOf: (t: Task) => Workflow | undefined, today: string, takenBy: string, nowIso: string): WeekSnapshot {
  const byUnit: Record<string, SnapshotCounts> = {};
  const unitIds = [...new Set(tasks.map((t) => t.unitId))];
  for (const u of unitIds) byUnit[u] = countTasks(tasks.filter((t) => t.unitId === u), wfOf, today);
  const week = weekKey(today);
  return { id: week, week, total: countTasks(tasks, wfOf, today), byUnit, takenBy, createdAt: nowIso };
}

/** Cộng dồn số liệu của nhiều đơn vị (đơn vị được chọn và các đơn vị con). */
export function sumCounts(snap: WeekSnapshot, unitIds: Set<string> | '*'): SnapshotCounts {
  if (unitIds === '*') return snap.total;
  const out = emptyCounts();
  for (const [u, c] of Object.entries(snap.byUnit)) if (unitIds.has(u)) for (const k of Object.keys(out) as (keyof SnapshotCounts)[]) out[k] += c[k] ?? 0;
  return out;
}

export interface BurnPoint { week: string; remaining: number | null; ideal: number }

/**
 * Burndown của nhóm việc có hạn chót trong kỳ: số việc CÒN LẠI cuối mỗi tuần (tính lại từ ngày hoàn thành) so với đường lý tưởng
 * giảm đều về 0 vào cuối kỳ. Các tuần chưa tới có remaining = null.
 */
export function burndown(tasks: Task[], period: Period, today: string): BurnPoint[] {
  const cohort = tasks.filter((t) => t.dueAt !== null && diffDays(t.dueAt, period.start) >= 0 && diffDays(t.dueAt, period.end) <= 0);
  const n = cohort.length;
  const weeks = weekStarts(period);
  return weeks.map((w, i) => {
    const end = addDays(w, 6);
    const future = diffDays(w, today) > 0;
    const remaining = future ? null : cohort.filter((t) => !(t.completedAt !== null && diffDays(dayOfIso(t.completedAt), end) <= 0)).length;
    return { week: w, remaining, ideal: Math.round(n * (1 - (i + 1) / weeks.length) * 10) / 10 };
  });
}
