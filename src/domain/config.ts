import { z } from 'zod';
import type { FieldDef, OrgUnit, Role, TaskTemplate, TaskType, Workflow, AppSettings, AcademicTerm } from './types';
import { ALL_PERMS } from './types';
import { validateWorkflow, withDerived } from './workflow';

const key = z.string().regex(/^[a-z0-9_]{1,40}$/, 'Khoá chỉ gồm a-z, 0-9, _ (tối đa 40).');
const actor = z.enum(['assignee', 'collaborator', 'reviewer', 'creator', 'approver', 'approver_all', 'assigner']);
const cat = z.enum(['todo', 'doing', 'review', 'done']);

export const fieldSchema = z.object({
  key,
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'longtext', 'number', 'date', 'select', 'multiselect', 'user', 'file', 'url', 'checkbox']),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(80)).max(100),
  order: z.number().int(),
  archived: z.boolean(),
});

export const workflowSchema = z.object({
  id: key,
  name: z.string().min(1).max(80),
  initialState: key,
  states: z.array(z.object({ key, label: z.string().min(1).max(60), category: cat })).min(2).max(20),
  transitions: z.array(z.object({ from: key, to: key, allowed: z.array(actor).min(1), requiresComment: z.boolean() })).max(80),
  archived: z.boolean(),
});

export const typeSchema = z.object({
  id: key,
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  workflowId: key,
  fields: z.array(fieldSchema).max(40),
  archived: z.boolean(),
});

export const roleSchema = z.object({
  key,
  name: z.string().min(1).max(80),
  permissions: z.array(z.enum(ALL_PERMS as unknown as [string, ...string[]])),
  archived: z.boolean(),
});

export const unitSchema = z.object({
  id: key,
  parentId: key.nullable(),
  name: z.string().min(1).max(80),
  kind: z.enum(['khoa', 'bomon', 'to']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  headId: z.string().max(128).nullable(),
  archived: z.boolean(),
});

export const templateSchema = z.object({
  id: key,
  name: z.string().min(1).max(100),
  typeId: key,
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  priority: z.enum(['low', 'normal', 'high']),
  checklist: z.array(z.string().min(1).max(200)).max(50),
  dueOffsetDays: z.number().int().min(0).max(366),
  recurrence: z.object({ kind: z.enum(['weekly', 'monthly', 'term']), active: z.boolean() }).nullable(),
  archived: z.boolean(),
});

export const termSchema = z.object({ id: key, name: z.string().min(1).max(80), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export const settingsSchema = z.object({
  riskDays: z.number().int().min(0).max(60),
  riskProgress: z.number().int().min(0).max(100),
  reminderDays: z.array(z.number().int().min(0).max(60)).max(5),
  categoryLabels: z.object({ todo: z.string().min(1), doing: z.string().min(1), review: z.string().min(1), done: z.string().min(1) }),
});

export const configSchema = z.object({
  version: z.literal(1),
  units: z.array(unitSchema),
  roles: z.array(roleSchema),
  workflows: z.array(workflowSchema),
  taskTypes: z.array(typeSchema),
  templates: z.array(templateSchema),
  terms: z.array(termSchema),
  settings: settingsSchema,
});

export interface KhoaConfig {
  version: 1;
  units: OrgUnit[];
  roles: Role[];
  workflows: Workflow[];
  taskTypes: TaskType[];
  templates: TaskTemplate[];
  terms: AcademicTerm[];
  settings: AppSettings;
}

/** Kiểm tra chặt cả cấu hình: schema + ràng buộc tham chiếu chéo. Trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateConfig(input: unknown): { ok: true; config: KhoaConfig } | { ok: false; errors: string[] } {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`) };
  }
  const c = parsed.data as unknown as Omit<KhoaConfig, 'workflows'> & { workflows: Omit<Workflow, 'allowed'>[] };
  const errs: string[] = [];
  const dup = (label: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) errs.push(`${label} bị trùng khoá.`);
  };
  dup('Đơn vị', c.units.map((u) => u.id));
  dup('Vai trò', c.roles.map((r) => r.key));
  dup('Quy trình', c.workflows.map((w) => w.id));
  dup('Loại việc', c.taskTypes.map((t) => t.id));
  dup('Mẫu việc', c.templates.map((t) => t.id));
  const roots = c.units.filter((u) => u.parentId === null && !u.archived);
  if (c.units.length > 0 && roots.length !== 1) errs.push('Cây tổ chức phải có đúng một đơn vị gốc (Khoa).');
  for (const u of c.units) if (u.parentId && !c.units.some((p) => p.id === u.parentId)) errs.push(`Đơn vị "${u.name}" trỏ tới cha không tồn tại.`);
  for (const w of c.workflows) errs.push(...validateWorkflow(w).map((e) => `Quy trình "${w.name}": ${e}`));
  for (const t of c.taskTypes) {
    if (!c.workflows.some((w) => w.id === t.workflowId)) errs.push(`Loại việc "${t.name}" dùng quy trình không tồn tại.`);
    dup(`Trường của "${t.name}"`, t.fields.map((f: FieldDef) => f.key));
    for (const f of t.fields) if ((f.type === 'select' || f.type === 'multiselect') && f.options.length === 0 && !f.archived) errs.push(`Trường "${f.label}" cần có danh sách lựa chọn.`);
  }
  for (const tpl of c.templates) if (!c.taskTypes.some((t) => t.id === tpl.typeId)) errs.push(`Mẫu "${tpl.name}" dùng loại việc không tồn tại.`);
  if (errs.length > 0) return { ok: false, errors: errs };
  const workflows: Workflow[] = c.workflows.map((w) => withDerived(w as Omit<Workflow, 'allowed' | 'needsComment' | 'doneStates'>));
  return { ok: true, config: { ...c, workflows } as KhoaConfig };
}

export interface ConfigChange {
  section: keyof Omit<KhoaConfig, 'version' | 'settings'> | 'settings';
  kind: 'add' | 'update' | 'remove';
  id: string;
  label: string;
}

function idOf(section: string, item: { id?: string; key?: string }): string {
  return (section === 'roles' ? item.key : item.id) ?? '';
}

/** So sánh hai cấu hình để hiển thị bản xem trước (diff) trước khi áp dụng. */
export function diffConfig(a: KhoaConfig, b: KhoaConfig): ConfigChange[] {
  const out: ConfigChange[] = [];
  const sections = ['units', 'roles', 'workflows', 'taskTypes', 'templates', 'terms'] as const;
  for (const s of sections) {
    const am = new Map((a[s] as { id?: string; key?: string; name?: string }[]).map((x) => [idOf(s, x), x]));
    const bm = new Map((b[s] as { id?: string; key?: string; name?: string }[]).map((x) => [idOf(s, x), x]));
    for (const [id, nb] of bm) {
      const na = am.get(id);
      if (!na) out.push({ section: s, kind: 'add', id, label: nb.name ?? id });
      else if (JSON.stringify(na) !== JSON.stringify(nb)) out.push({ section: s, kind: 'update', id, label: nb.name ?? id });
    }
    for (const [id, na] of am) if (!bm.has(id)) out.push({ section: s, kind: 'remove', id, label: na.name ?? id });
  }
  if (JSON.stringify(a.settings) !== JSON.stringify(b.settings)) out.push({ section: 'settings', kind: 'update', id: 'app', label: 'Thiết lập chung' });
  return out;
}
