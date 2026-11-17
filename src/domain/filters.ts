import type { Task, TaskType, Workflow } from './types';
import { categoryOf } from './workflow';
import { diffDays, parseDay } from './dates';

export type DueFilter = 'all' | 'overdue' | 'week' | 'month' | 'none';

export interface TaskFilter {
  unitId: string; // '' = tất cả
  assigneeId: string;
  typeId: string;
  label: string;
  due: DueFilter;
  text: string;
}

export const EMPTY_FILTER: TaskFilter = { unitId: '', assigneeId: '', typeId: '', label: '', due: 'all', text: '' };

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Bộ lọc dùng chung cho Danh sách / Kanban / Lịch / Timeline. */
export function applyFilter(tasks: Task[], f: TaskFilter, wfOf: (t: Task) => Workflow | undefined, today: string, descendants?: (unitId: string) => string[]): Task[] {
  const q = norm(f.text.trim());
  const unitSet = f.unitId ? new Set(descendants ? descendants(f.unitId) : [f.unitId]) : null;
  return tasks.filter((t) => {
    if (unitSet && !unitSet.has(t.unitId)) return false;
    if (f.assigneeId && !t.assigneeIds.includes(f.assigneeId)) return false;
    if (f.typeId && t.typeId !== f.typeId) return false;
    if (f.label && !t.labels.includes(f.label)) return false;
    if (q && !norm(t.title).includes(q)) return false;
    if (f.due !== 'all') {
      const cat = categoryOf(wfOf(t), t.stateKey);
      if (f.due === 'none') return t.dueAt === null;
      if (t.dueAt === null) return false;
      const left = diffDays(t.dueAt, today);
      if (f.due === 'overdue') return cat !== 'done' && left < 0;
      if (f.due === 'week') return left >= 0 && left <= 7;
      if (f.due === 'month') {
        const a = new Date(parseDay(t.dueAt));
        const b = new Date(parseDay(today));
        return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
      }
    }
    return true;
  });
}

export function sortByDue(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.dueAt ?? '9999-12-31').localeCompare(b.dueAt ?? '9999-12-31') || a.title.localeCompare(b.title, 'vi'));
}

export function typeName(types: TaskType[], id: string): string {
  return types.find((t) => t.id === id)?.name ?? '—';
}
