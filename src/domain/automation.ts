// Tự động hoá "khi … thì …". Không có máy chủ chạy nền (gói Spark), nên:
//  - Sự kiện (tạo việc, chuyển trạng thái) được xử lý ngay trên trình duyệt của NGƯỜI THAO TÁC, gộp vào cùng batch ghi.
//  - Quy tắc theo ngày (sắp đến hạn, quá hạn) được xử lý khi chính người nhận mở app, tạo thông báo cho CHÍNH HỌ với ID cố định (không trùng).
import type { Automation, AutoRecipient, StateCategory, Task } from './types';
import { diffDays } from './dates';

export interface AutoContext {
  unitHeadOf: (unitId: string) => string | null;
  userName: (id: string) => string;
}

export type AutoEvent =
  | { type: 'state_changed'; task: Task; toCategory: StateCategory; toLabel: string; actorId: string }
  | { type: 'task_created'; task: Task; actorId: string };

export interface AutoNotice { userId: string; text: string; taskId: string; ruleId: string; key: string }

export const RECIPIENT_LABEL: Record<AutoRecipient, string> = { assignees: 'Người phụ trách', collaborators: 'Người phối hợp', reviewers: 'Người duyệt', creator: 'Người tạo việc', unit_head: 'Trưởng đơn vị' };

export function recipientsOf(to: AutoRecipient[], task: Task, ctx: AutoContext): string[] {
  const out = new Set<string>();
  for (const r of to) {
    if (r === 'assignees') task.assigneeIds.forEach((u) => out.add(u));
    else if (r === 'collaborators') task.collaboratorIds.forEach((u) => out.add(u));
    else if (r === 'reviewers') task.reviewerIds.forEach((u) => out.add(u));
    else if (r === 'creator') out.add(task.createdBy);
    else if (r === 'unit_head') { const h = ctx.unitHeadOf(task.unitId); if (h) out.add(h); }
  }
  return [...out];
}

/** Thay {title} {actor} {state} {due}; biến lạ giữ nguyên. Kết quả ≤ 300 ký tự (giới hạn thông báo). */
export function renderText(tpl: string, vars: { title: string; actor: string; state: string; due: string }): string {
  return tpl.replace(/\{(title|actor|state|due)\}/g, (_, k: keyof typeof vars) => vars[k]).slice(0, 300);
}

const typeOk = (rule: Automation, task: Task) => rule.trigger.typeId === null || rule.trigger.typeId === task.typeId;
const dueText = (t: Task) => (t.dueAt ? t.dueAt.split('-').reverse().join('/') : 'chưa đặt hạn');

/** Thông báo phát sinh từ một sự kiện; không gửi cho chính người thao tác; mỗi người nhận tối đa một thông báo cho mỗi quy tắc. */
export function eventNotices(rules: Automation[], evt: AutoEvent, ctx: AutoContext): AutoNotice[] {
  const out: AutoNotice[] = [];
  for (const rule of rules) {
    if (!rule.enabled || !typeOk(rule, evt.task)) continue;
    if (evt.type === 'state_changed') {
      if (rule.trigger.kind !== 'state_changed' || (rule.trigger.toCategory !== null && rule.trigger.toCategory !== evt.toCategory)) continue;
    } else if (rule.trigger.kind !== 'task_created') continue;
    const text = renderText(rule.action.text, { title: evt.task.title, actor: ctx.userName(evt.actorId), state: evt.type === 'state_changed' ? evt.toLabel : 'Mới tạo', due: dueText(evt.task) });
    for (const userId of recipientsOf(rule.action.to, evt.task, ctx)) {
      if (userId === evt.actorId) continue;
      out.push({ userId, text, taskId: evt.task.id, ruleId: rule.id, key: `${rule.id}:${evt.task.id}:${userId}` });
    }
  }
  return out;
}

/**
 * Quy tắc theo ngày, tính cho riêng `me`: sắp đến hạn đúng N ngày (mỗi mốc một lần) hoặc đã quá hạn (một lần cho mỗi việc).
 * `isOpen` cho biết việc còn mở (chưa xong).
 */
export function scheduledNotices(rules: Automation[], tasks: Task[], today: string, me: string, ctx: AutoContext, isOpen: (t: Task) => boolean): AutoNotice[] {
  const out: AutoNotice[] = [];
  for (const rule of rules) {
    if (!rule.enabled || (rule.trigger.kind !== 'due_soon' && rule.trigger.kind !== 'overdue')) continue;
    for (const t of tasks) {
      if (t.dueAt === null || !isOpen(t) || !typeOk(rule, t)) continue;
      const left = diffDays(t.dueAt, today);
      const hit = rule.trigger.kind === 'due_soon' ? left === rule.trigger.days : left < 0;
      if (!hit || !recipientsOf(rule.action.to, t, ctx).includes(me)) continue;
      const text = renderText(rule.action.text, { title: t.title, actor: 'Hệ thống', state: rule.trigger.kind === 'overdue' ? 'Quá hạn' : `Còn ${left} ngày`, due: dueText(t) });
      out.push({ userId: me, text, taskId: t.id, ruleId: rule.id, key: `${rule.id}:${t.id}:${rule.trigger.kind === 'due_soon' ? `d${rule.trigger.days}` : 'late'}` });
    }
  }
  return out;
}
