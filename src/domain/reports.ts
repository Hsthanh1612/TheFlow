import type { AppSettings, OrgUnit, Task, UserProfile, Workflow } from './types';
import { breakdown, memberStats, pct, riskList } from './stats';
import { descendantIds } from './permissions';
import { vnDate } from './dates';

// Mẫu báo cáo là DỮ LIỆU: định nghĩa cột + nguồn dòng. Thêm mẫu mới = thêm một phần tử, không đổi logic dựng báo cáo.
export type ReportSource = 'units' | 'overdue' | 'types' | 'members';

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  source: ReportSource;
  columns: ReportColumn[];
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { id: 'unit_progress', name: 'Tiến độ theo đơn vị', description: 'Số việc theo trạng thái và % hoàn thành của từng đơn vị.', source: 'units',
    columns: [{ key: 'name', label: 'Đơn vị' }, { key: 'total', label: 'Tổng việc' }, { key: 'done', label: 'Hoàn thành' }, { key: 'doing', label: 'Đang làm' }, { key: 'review', label: 'Chờ duyệt' }, { key: 'late', label: 'Quá hạn' }, { key: 'pct', label: '% hoàn thành' }] },
  { id: 'overdue_list', name: 'Danh sách quá hạn', description: 'Các việc đã quá hạn hoặc có nguy cơ.', source: 'overdue',
    columns: [{ key: 'title', label: 'Công việc' }, { key: 'unit', label: 'Đơn vị' }, { key: 'assignee', label: 'Phụ trách' }, { key: 'due', label: 'Hạn' }, { key: 'progress', label: 'Tiến độ' }, { key: 'kind', label: 'Tình trạng' }] },
  { id: 'by_type', name: 'Tổng kết theo loại việc', description: 'Số việc và tỉ lệ hoàn thành theo từng loại việc.', source: 'types',
    columns: [{ key: 'name', label: 'Loại việc' }, { key: 'total', label: 'Tổng việc' }, { key: 'done', label: 'Hoàn thành' }, { key: 'late', label: 'Quá hạn' }, { key: 'pct', label: '% hoàn thành' }] },
  { id: 'by_member', name: 'Tổng kết theo thành viên', description: 'Khối lượng và tỉ lệ đúng hạn của từng thành viên.', source: 'members',
    columns: [{ key: 'name', label: 'Thành viên' }, { key: 'unit', label: 'Đơn vị' }, { key: 'doing', label: 'Đang làm' }, { key: 'review', label: 'Chờ duyệt' }, { key: 'done', label: 'Hoàn thành' }, { key: 'late', label: 'Quá hạn' }, { key: 'ontime', label: 'Đúng hạn' }] },
];

export interface ReportContext {
  tasks: Task[];
  units: OrgUnit[];
  users: UserProfile[];
  types: { id: string; name: string }[];
  wfOf: (t: Task) => Workflow | undefined;
  settings: AppSettings;
  today: string;
  scopeUnitId: string;
  progressOf: (t: Task) => number;
}

export type ReportRow = Record<string, string | number>;

export function buildReport(def: ReportDefinition, ctx: ReportContext): ReportRow[] {
  const ids = new Set(descendantIds(ctx.units, ctx.scopeUnitId));
  const tasks = ctx.tasks.filter((t) => ids.has(t.unitId));
  const nameOf = (id: string) => ctx.users.find((u) => u.uid === id)?.name ?? '(không rõ)';
  const unitName = (id: string) => ctx.units.find((u) => u.id === id)?.name ?? '—';
  switch (def.source) {
    case 'units': {
      const scoped = ctx.units.filter((u) => !u.archived && ids.has(u.id));
      const roots = scoped.filter((u) => u.parentId === null || u.parentId === ctx.scopeUnitId || u.id === ctx.scopeUnitId);
      const list = roots.length > 1 ? roots.filter((u) => u.id !== ctx.scopeUnitId || !scoped.some((x) => x.parentId === ctx.scopeUnitId)) : roots;
      return list.map((u) => {
        const sub = new Set(descendantIds(ctx.units, u.id));
        const b = breakdown(tasks.filter((t) => sub.has(t.unitId)), ctx.wfOf, ctx.today);
        return { name: u.name, total: b.total, done: b.done, doing: b.doing, review: b.review, late: b.late, pct: pct(b.done, b.total) };
      });
    }
    case 'overdue':
      return riskList(tasks, ctx.wfOf, ctx.settings, ctx.today).map(({ task, kind }) => ({
        title: task.title, unit: unitName(task.unitId), assignee: task.assigneeIds.map(nameOf).join(', '), due: vnDate(task.dueAt), progress: `${ctx.progressOf(task)}%`, kind: kind === 'overdue' ? 'Quá hạn' : 'Có nguy cơ',
      }));
    case 'types':
      return ctx.types.map((ty) => {
        const b = breakdown(tasks.filter((t) => t.typeId === ty.id), ctx.wfOf, ctx.today);
        return { name: ty.name, total: b.total, done: b.done, late: b.late, pct: pct(b.done, b.total) };
      }).filter((r) => (r.total as number) > 0);
    case 'members': {
      const people = ctx.users.filter((u) => u.active && u.unitId && ids.has(u.unitId));
      return memberStats(tasks, people.map((u) => u.uid), ctx.wfOf, ctx.today).map((m) => ({
        name: nameOf(m.userId), unit: unitName(ctx.users.find((u) => u.uid === m.userId)?.unitId ?? ''), doing: m.doing, review: m.review, done: m.done, late: m.late, ontime: m.onTimeRate === null ? '—' : `${m.onTimeRate}%`,
      }));
    }
  }
}

function csvCell(v: string | number): string {
  let s = String(v);
  // Chống "CSV/formula injection" khi mở bằng Excel: ô bắt đầu bằng = + - @ bị coi là công thức.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(def: ReportDefinition, rows: ReportRow[]): string {
  const head = def.columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => def.columns.map((c) => csvCell(r[c.key] ?? '')).join(','));
  return `\uFEFF${[head, ...body].join('\r\n')}\r\n`;
}
