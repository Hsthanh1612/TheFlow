import type { ActorKind, StateCategory, Task, Transition, Workflow, WorkflowState } from './types';
import { hasGlobalPerm, hasPerm, type Principal } from './permissions';

export function stateOf(wf: Workflow, key: string): WorkflowState | undefined {
  return wf.states.find((s) => s.key === key);
}

export function categoryOf(wf: Workflow | undefined, key: string): StateCategory {
  return (wf && stateOf(wf, key)?.category) || 'todo';
}

/** Bảng tra phẳng cho Firestore Rules: "from>to" -> kinds. Luôn sinh lại từ transitions. */
export function buildAllowedMap(transitions: Transition[]): Record<string, ActorKind[]> {
  const out: Record<string, ActorKind[]> = {};
  for (const t of transitions) {
    const k = `${t.from}>${t.to}`;
    out[k] = [...new Set([...(out[k] ?? []), ...t.allowed])];
  }
  return out;
}

export function buildNeedsCommentMap(transitions: Transition[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const t of transitions) out[`${t.from}>${t.to}`] = (out[`${t.from}>${t.to}`] ?? false) || t.requiresComment;
  return out;
}

/** Tính lại toàn bộ trường dẫn xuất của quy trình. Gọi mỗi khi lưu quy trình. */
export function withDerived<T extends Omit<Workflow, 'allowed' | 'needsComment' | 'doneStates'>>(wf: T): T & Pick<Workflow, 'allowed' | 'needsComment' | 'doneStates'> {
  return { ...wf, allowed: buildAllowedMap(wf.transitions), needsComment: buildNeedsCommentMap(wf.transitions), doneStates: wf.states.filter((s) => s.category === 'done').map((s) => s.key) };
}

export function validateWorkflow(wf: Pick<Workflow, 'states' | 'transitions' | 'initialState'>): string[] {
  const errs: string[] = [];
  const keys = wf.states.map((s) => s.key);
  if (wf.states.length < 2) errs.push('Quy trình cần ít nhất 2 trạng thái.');
  if (new Set(keys).size !== keys.length) errs.push('Khoá trạng thái bị trùng.');
  if (!keys.includes(wf.initialState)) errs.push('Trạng thái khởi đầu không tồn tại.');
  if (!wf.states.some((s) => s.category === 'done')) errs.push('Cần ít nhất một trạng thái thuộc nhóm "Hoàn thành".');
  for (const t of wf.transitions) {
    if (!keys.includes(t.from) || !keys.includes(t.to)) errs.push(`Bước chuyển ${t.from} → ${t.to} trỏ tới trạng thái không tồn tại.`);
    if (t.from === t.to) errs.push(`Bước chuyển ${t.from} → ${t.to} không đổi trạng thái.`);
  }
  return errs;
}

/** Người thực hiện thuộc những ActorKind nào đối với task này. */
export function actorKinds(p: Principal, task: Pick<Task, 'assigneeIds' | 'collaboratorIds' | 'reviewerIds' | 'createdBy' | 'unitId'>): ActorKind[] {
  const k: ActorKind[] = [];
  if (task.assigneeIds.includes(p.uid)) k.push('assignee');
  if (task.collaboratorIds.includes(p.uid)) k.push('collaborator');
  if (task.reviewerIds.includes(p.uid)) k.push('reviewer');
  if (task.createdBy === p.uid) k.push('creator');
  if (hasPerm(p, 'task.approve', task.unitId)) k.push('approver');
  if (hasGlobalPerm(p, 'task.approve')) k.push('approver_all');
  if (hasPerm(p, 'task.assign', task.unitId)) k.push('assigner');
  return k;
}

export interface TransitionCheck {
  ok: boolean;
  requiresComment: boolean;
  reason?: string;
}

/** Mirror của logic trong firestore.rules: kiểm tra người dùng có được chuyển trạng thái không. */
export function checkTransition(wf: Workflow, task: Task, to: string, p: Principal | null): TransitionCheck {
  if (!p || !p.active) return { ok: false, requiresComment: false, reason: 'Chưa đăng nhập hoặc tài khoản chưa được kích hoạt.' };
  if (task.stateKey === to) return { ok: false, requiresComment: false, reason: 'Việc đã ở trạng thái này.' };
  const t = wf.transitions.find((x) => x.from === task.stateKey && x.to === to);
  if (!t) return { ok: false, requiresComment: false, reason: 'Quy trình không cho phép chuyển trực tiếp sang trạng thái này.' };
  const mine = actorKinds(p, task);
  if (!t.allowed.some((a) => mine.includes(a))) {
    return { ok: false, requiresComment: t.requiresComment, reason: 'Bạn không có quyền thực hiện bước chuyển này.' };
  }
  return { ok: true, requiresComment: t.requiresComment };
}

/** Các trạng thái đích mà người dùng được phép chuyển tới. */
export function allowedTargets(wf: Workflow, task: Task, p: Principal | null): { state: WorkflowState; requiresComment: boolean }[] {
  const out: { state: WorkflowState; requiresComment: boolean }[] = [];
  for (const s of wf.states) {
    const c = checkTransition(wf, task, s.key, p);
    if (c.ok) out.push({ state: s, requiresComment: c.requiresComment });
  }
  return out;
}

/** Trạng thái đích đầu tiên thuộc nhóm `cat` mà task có thể chuyển tới từ vị trí hiện tại. */
export function firstReachableInCategory(wf: Workflow, task: Task, cat: StateCategory, p: Principal | null): WorkflowState | null {
  const c = allowedTargets(wf, task, p).find((x) => x.state.category === cat);
  return c?.state ?? null;
}
