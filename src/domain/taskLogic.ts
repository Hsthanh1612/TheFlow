import type { AppSettings, ChecklistItem, StateCategory, Task, Workflow } from './types';
import { categoryOf } from './workflow';
import { diffDays } from './dates';

/** Tiến độ 0..100: theo checklist; nếu không có checklist thì theo nhóm trạng thái. */
export function progressOf(task: Pick<Task, 'checklist'>, category: StateCategory): number {
  const items: ChecklistItem[] = task.checklist;
  if (items.length > 0) return Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return category === 'done' ? 100 : 0;
}

export type DisplayStatus = 'todo' | 'doing' | 'review' | 'done' | 'late';

export function isOverdue(task: Pick<Task, 'dueAt'>, category: StateCategory, today: string): boolean {
  return category !== 'done' && task.dueAt !== null && diffDays(task.dueAt, today) < 0;
}

export function displayStatus(task: Pick<Task, 'dueAt'>, category: StateCategory, today: string): DisplayStatus {
  return isOverdue(task, category, today) ? 'late' : category;
}

export function daysLeft(task: Pick<Task, 'dueAt'>, today: string): number | null {
  return task.dueAt === null ? null : diffDays(task.dueAt, today);
}

export type RiskKind = 'overdue' | 'at_risk';

/** Quá hạn, hoặc còn ≤ riskDays ngày mà tiến độ < riskProgress%. Việc đã xong không có rủi ro. */
export function riskOf(task: Task, wf: Workflow | undefined, settings: AppSettings, today: string): RiskKind | null {
  const cat = categoryOf(wf, task.stateKey);
  if (cat === 'done' || task.dueAt === null) return null;
  const left = diffDays(task.dueAt, today);
  if (left < 0) return 'overdue';
  if (left <= settings.riskDays && progressOf(task, cat) < settings.riskProgress) return 'at_risk';
  return null;
}

export function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function participantsOf(t: Pick<Task, 'assigneeIds' | 'collaboratorIds' | 'reviewerIds'>): string[] {
  return uniq([...t.assigneeIds, ...t.collaboratorIds, ...t.reviewerIds]);
}
