import type { AppSettings, Task, Workflow } from './types';
import { categoryOf } from './workflow';
import { addDays, dayOfIso, diffDays, weekStart } from './dates';
import { riskOf } from './taskLogic';

export interface Period {
  start: string; // YYYY-MM-DD
  end: string;
}

/** N tuần gần nhất tính tới tuần chứa `today` (gồm cả tuần này). */
export function lastWeeksPeriod(today: string, weeks: number): Period {
  const thisWeek = weekStart(today);
  return { start: addDays(thisWeek, -7 * (weeks - 1)), end: addDays(thisWeek, 6) };
}

export function weekStarts(p: Period): string[] {
  const out: string[] = [];
  for (let w = weekStart(p.start); diffDays(w, p.end) <= 0; w = addDays(w, 7)) out.push(w);
  return out;
}

export interface WeekPoint {
  week: string; // thứ Hai đầu tuần
  done: number;
  created: number;
  actualPct: number;
  planPct: number;
}

/**
 * Cohort = việc có hạn chót nằm trong kỳ.
 *  - actualPct(w) = % cohort có completedAt <= cuối tuần w
 *  - planPct(w)   = % cohort có dueAt <= cuối tuần w (kế hoạch: việc đến hạn thì lẽ ra đã xong)
 *  - created(w)   = số việc (mọi việc trong phạm vi) tạo trong tuần w
 *  - done(w)      = số việc (mọi việc trong phạm vi) hoàn thành trong tuần w
 */
export function weeklySeries(tasks: Task[], period: Period): WeekPoint[] {
  const cohort = tasks.filter((t) => t.dueAt !== null && diffDays(t.dueAt, period.start) >= 0 && diffDays(t.dueAt, period.end) <= 0);
  const n = cohort.length;
  return weekStarts(period).map((w) => {
    const wEnd = addDays(w, 6);
    const inWeek = (iso: string | null) => iso !== null && diffDays(dayOfIso(iso), w) >= 0 && diffDays(dayOfIso(iso), wEnd) <= 0;
    const doneByEnd = cohort.filter((t) => t.completedAt !== null && diffDays(dayOfIso(t.completedAt), wEnd) <= 0).length;
    const planByEnd = cohort.filter((t) => t.dueAt !== null && diffDays(t.dueAt, wEnd) <= 0).length;
    return {
      week: w,
      done: tasks.filter((t) => inWeek(t.completedAt)).length,
      created: tasks.filter((t) => inWeek(t.createdAt)).length,
      actualPct: n === 0 ? 0 : Math.round((doneByEnd / n) * 100),
      planPct: n === 0 ? 0 : Math.round((planByEnd / n) * 100),
    };
  });
}

export interface Breakdown {
  total: number;
  done: number;
  doing: number;
  review: number;
  late: number;
  todo: number;
}

export function breakdown(tasks: Task[], wfOf: (t: Task) => Workflow | undefined, today: string): Breakdown {
  const b: Breakdown = { total: 0, done: 0, doing: 0, review: 0, late: 0, todo: 0 };
  for (const t of tasks) {
    const cat = categoryOf(wfOf(t), t.stateKey);
    b.total++;
    if (cat === 'done') b.done++;
    else if (t.dueAt !== null && diffDays(t.dueAt, today) < 0) b.late++;
    else if (cat === 'review') b.review++;
    else if (cat === 'doing') b.doing++;
    else b.todo++;
  }
  return b;
}

export function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export interface MemberRow {
  userId: string;
  doing: number;
  review: number;
  done: number;
  late: number;
  onTimeRate: number | null; // % việc xong đúng hạn / số việc xong; null nếu chưa xong việc nào
}

/** Thống kê theo thành viên (người phụ trách). Việc quá hạn tính riêng, không cộng vào doing/review. */
export function memberStats(tasks: Task[], userIds: string[], wfOf: (t: Task) => Workflow | undefined, today: string): MemberRow[] {
  return userIds.map((uid) => {
    const mine = tasks.filter((t) => t.assigneeIds.includes(uid));
    const b = breakdown(mine, wfOf, today);
    const doneTasks = mine.filter((t) => categoryOf(wfOf(t), t.stateKey) === 'done');
    const onTime = doneTasks.filter((t) => t.dueAt === null || (t.completedAt !== null && diffDays(dayOfIso(t.completedAt), t.dueAt) <= 0)).length;
    return { userId: uid, doing: b.doing, review: b.review, done: b.done, late: b.late, onTimeRate: doneTasks.length === 0 ? null : pct(onTime, doneTasks.length) };
  });
}

export function riskList(tasks: Task[], wfOf: (t: Task) => Workflow | undefined, settings: AppSettings, today: string): { task: Task; kind: 'overdue' | 'at_risk' }[] {
  const out: { task: Task; kind: 'overdue' | 'at_risk' }[] = [];
  for (const t of tasks) {
    const k = riskOf(t, wfOf(t), settings, today);
    if (k) out.push({ task: t, kind: k });
  }
  return out.sort((a, b) => (a.task.dueAt ?? '').localeCompare(b.task.dueAt ?? ''));
}
