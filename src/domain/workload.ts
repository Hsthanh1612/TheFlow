// Khối lượng công việc theo người: đếm việc đang mở và quy ra "điểm" theo mức ưu tiên, chia theo tuần đến hạn. Hàm thuần.
import type { Priority, Task, Workflow } from './types';
import { categoryOf } from './workflow';
import { diffDays, weekStart } from './dates';

export const PRIORITY_POINTS: Record<Priority, number> = { low: 1, normal: 2, high: 3 };
export const DEFAULT_CAPACITY = 8; // điểm/tuần coi là "đầy tải" (1 việc ưu tiên cao = 3 điểm)

export interface WeekLoad { week: string; points: number; tasks: number }
export interface WorkloadRow {
  userId: string;
  open: number; // việc đang mở (chưa xong) người này phụ trách
  overdue: number;
  undated: number; // việc không có hạn chót
  points: number; // tổng điểm của các tuần trong khung nhìn
  weeks: WeekLoad[];
}

/**
 * Mỗi việc chưa xong được tính cho từng người PHỤ TRÁCH, vào tuần đến hạn (việc quá hạn dồn vào tuần này).
 * Việc có hạn xa hơn khung nhìn vẫn tính vào `open` nhưng chưa vào cột tuần nào.
 */
export function workloadRows(tasks: Task[], userIds: string[], wfOf: (t: Task) => Workflow | undefined, today: string, weeks = 4): WorkloadRow[] {
  const w0 = weekStart(today);
  const rows = new Map<string, WorkloadRow>(userIds.map((id) => [id, { userId: id, open: 0, overdue: 0, undated: 0, points: 0, weeks: Array.from({ length: weeks }, (_, i) => ({ week: addWeeks(w0, i), points: 0, tasks: 0 })) }]));
  for (const t of tasks) {
    if (categoryOf(wfOf(t), t.stateKey) === 'done') continue;
    for (const uid of t.assigneeIds) {
      const r = rows.get(uid);
      if (!r) continue;
      r.open++;
      if (t.dueAt === null) { r.undated++; continue; }
      const late = diffDays(t.dueAt, today) < 0;
      if (late) r.overdue++;
      const idx = late ? 0 : Math.floor(diffDays(weekStart(t.dueAt), w0) / 7);
      if (idx < 0 || idx >= weeks) continue;
      r.weeks[idx].tasks++;
      r.weeks[idx].points += PRIORITY_POINTS[t.priority];
      r.points += PRIORITY_POINTS[t.priority];
    }
  }
  return [...rows.values()];
}

function addWeeks(d: string, n: number): string {
  const t = Date.parse(`${d}T00:00:00Z`) + n * 7 * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export type LoadLevel = 'free' | 'ok' | 'high' | 'over';
export function loadLevel(points: number, capacity: number): LoadLevel {
  if (points <= 0) return 'free';
  if (points <= capacity * 0.7) return 'ok';
  if (points <= capacity) return 'high';
  return 'over';
}
