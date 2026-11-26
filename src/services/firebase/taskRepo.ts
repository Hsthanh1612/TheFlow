import { addDoc, collection, doc, getDoc, updateDoc, writeBatch, type WriteBatch } from 'firebase/firestore';
import { getServices } from './init';
import { newId, notificationId, nowIso } from './ids';
import { toTask } from './converters';
import { classify, AppError } from '../errors';
import { buildTask, extendPatch, peoplePatch, stripUndefined, transitionPatch, type NewTaskInput } from '../../domain/taskBuilder';
import { checkTransition } from '../../domain/workflow';
import { type Principal } from '../../domain/permissions';
import { MAX_BULK_TASKS, planBulkAssign, type BulkInput } from '../../domain/assign';
import { validateCustomFields } from '../../domain/fields';
import type { AppNotification, Task, TaskTemplate, TaskType, UserProfile, Workflow, OrgUnit, Priority, ChecklistItem, TaskLink } from '../../domain/types';
import { categoryOf } from '../../domain/workflow';

export type Notice = Pick<AppNotification, 'kind' | 'text'> & { userId: string; taskId: string | null };

function addNotice(b: WriteBatch, actorId: string, n: Notice): void {
  if (n.userId === actorId) return; // không tự thông báo cho chính mình
  const { db } = getServices();
  b.set(doc(db, 'users', n.userId, 'notifications', notificationId()), { actorId, taskId: n.taskId, kind: n.kind, text: n.text.slice(0, 300), createdAt: nowIso(), readAt: null });
}

export type TaskFormInput = Omit<NewTaskInput, 'id' | 'createdBy' | 'now' | 'newItemId' | 'bulkId' | 'templateId'> & { templateId?: string | null };

/** Tạo một việc. Kiểm tra trường động trước khi ghi; chỉ resolve khi máy chủ đã xác nhận. */
export async function createTask(input: TaskFormInput, actor: UserProfile, extra?: (task: Task) => Notice[]): Promise<string> {
  const errs = validateCustomFields(input.type.fields, input.customFields);
  if (Object.keys(errs).length > 0) throw new AppError('data', Object.values(errs)[0]);
  if (input.title.trim().length === 0) throw new AppError('data', 'Tiêu đề không được để trống.');
  if (input.assigneeIds.length === 0) throw new AppError('data', 'Cần ít nhất một người phụ trách.');
  const { db } = getServices();
  const id = newId();
  const task = buildTask({ ...input, templateId: input.templateId ?? null, bulkId: null, id, createdBy: actor.uid, now: nowIso(), newItemId: newId });
  try {
    const b = writeBatch(db);
    b.set(doc(db, 'tasks', id), task);
    for (const uid of task.assigneeIds) addNotice(b, actor.uid, { userId: uid, taskId: id, kind: 'assigned', text: `${actor.name} giao việc “${task.title}” cho bạn` });
    for (const uid of task.collaboratorIds) addNotice(b, actor.uid, { userId: uid, taskId: id, kind: 'assigned', text: `${actor.name} nhờ bạn phối hợp “${task.title}”` });
    for (const n of extra?.(task) ?? []) addNotice(b, actor.uid, n); // thông báo do quy tắc tự động hoá, cùng một lần ghi
    await b.commit();
    return id;
  } catch (e) {
    throw classify(e);
  }
}

export interface BulkResult {
  bulkId: string;
  created: number;
  skipped: { label: string; reason: string }[];
}

export interface BulkContent {
  type: TaskType;
  workflow: Workflow;
  title: string;
  description: string;
  dueAt: string | null;
  priority: Priority;
  template: TaskTemplate | null;
  customFields: Task['customFields'];
}

/**
 * Giao công việc trong MỘT batch nguyên tử (tất cả hoặc không việc nào). ID việc = `${bulkId}_${i}`
 * nên nếu người dùng bấm lại với cùng bulkId thì ghi đè đúng các tài liệu đó, không nhân đôi.
 */
export async function bulkAssign(input: BulkInput, content: BulkContent, users: UserProfile[], units: OrgUnit[], actor: UserProfile, bulkId: string = newId()): Promise<BulkResult> {
  const plan = planBulkAssign(input, users, units);
  if (plan.errors.length > 0) throw new AppError('data', plan.errors[0]);
  if (plan.drafts.length > MAX_BULK_TASKS) throw new AppError('data', `Tối đa ${MAX_BULK_TASKS} việc mỗi lần giao.`);
  const errs = validateCustomFields(content.type.fields, content.customFields);
  if (Object.keys(errs).length > 0) throw new AppError('data', Object.values(errs)[0]);
  if (content.title.trim().length === 0) throw new AppError('data', 'Tiêu đề không được để trống.');
  const { db } = getServices();
  const now = nowIso();
  try {
    const b = writeBatch(db);
    plan.drafts.forEach((d, i) => {
      const id = `${bulkId}_${i}`;
      const task = buildTask({
        id, type: content.type, workflow: content.workflow, title: content.title, description: content.description, priority: content.priority, labels: [],
        startAt: null, dueAt: content.dueAt, unitId: d.unitId, assigneeIds: d.assigneeIds, collaboratorIds: d.collaboratorIds, reviewerIds: d.reviewerIds,
        checklist: content.template?.checklist ?? [], customFields: content.customFields, templateId: content.template?.id ?? null, bulkId, createdBy: actor.uid, now, newItemId: newId,
      });
      b.set(doc(db, 'tasks', id), task);
      for (const uid of [...task.assigneeIds, ...task.collaboratorIds]) addNotice(b, actor.uid, { userId: uid, taskId: id, kind: 'assigned', text: `${actor.name} giao việc “${task.title}” cho bạn` });
    });
    await b.commit();
    return { bulkId, created: plan.drafts.length, skipped: plan.skipped };
  } catch (e) {
    throw classify(e);
  }
}

export interface TransitionOptions {
  task: Task;
  workflow: Workflow;
  to: string;
  note: string;
  actor: UserProfile;
  principal: Principal | null;
  taskTitleForNotice?: string;
  /** Thông báo do quy tắc tự động hoá, ghi cùng batch với việc chuyển trạng thái. */
  extraNotices?: Notice[];
}

function transitionNotices(task: Task, workflow: Workflow, to: string, actor: UserProfile, note: string): Notice[] {
  const cat = categoryOf(workflow, to);
  const from = categoryOf(workflow, task.stateKey);
  const label = workflow.states.find((s) => s.key === to)?.label ?? to;
  const base = { taskId: task.id };
  if (cat === 'review') return task.reviewerIds.map((userId) => ({ ...base, userId, kind: 'review_requested' as const, text: `${actor.name} nộp “${task.title}” chờ bạn duyệt` }));
  if (cat === 'done') return task.assigneeIds.map((userId) => ({ ...base, userId, kind: 'approved' as const, text: `“${task.title}” đã ${label.toLowerCase()}` }));
  if (from === 'review' && (cat === 'doing' || cat === 'todo')) return task.assigneeIds.map((userId) => ({ ...base, userId, kind: 'returned' as const, text: `“${task.title}” bị trả lại${note ? `: ${note}` : ''}` }));
  return [];
}

/** Chuyển trạng thái theo quy trình. Kiểm tra ở client (UX) và lại ở Firestore Rules (bảo mật). */
export async function transitionTask(o: TransitionOptions): Promise<void> {
  const c = checkTransition(o.workflow, o.task, o.to, o.principal);
  if (!c.ok) throw new AppError('permission', c.reason ?? 'Không được phép chuyển trạng thái.');
  if (c.requiresComment && o.note.trim().length === 0) throw new AppError('data', 'Bước này bắt buộc nhập ý kiến.');
  const { db } = getServices();
  try {
    const b = writeBatch(db);
    b.update(doc(db, 'tasks', o.task.id), stripUndefined(transitionPatch({ task: o.task, workflow: o.workflow, to: o.to, note: o.note, actorId: o.actor.uid, now: nowIso(), activityId: newId() })));
    for (const n of transitionNotices(o.task, o.workflow, o.to, o.actor, o.note.trim())) addNotice(b, o.actor.uid, n);
    for (const n of o.extraNotices ?? []) addNotice(b, o.actor.uid, n);
    await b.commit();
  } catch (e) {
    throw classify(e);
  }
}

/** Duyệt hoặc trả lại nhiều việc trong một batch nguyên tử. Mỗi việc đều ghi nhật ký. */
export async function bulkTransition(items: { task: Task; workflow: Workflow }[], to: 'approve' | 'return', note: string, actor: UserProfile, principal: Principal | null, extra?: (task: Task, toStateKey: string) => Notice[]): Promise<number> {
  if (items.length === 0) return 0;
  if (items.length > 150) throw new AppError('data', 'Tối đa 150 việc mỗi lần.');
  if (to === 'return' && note.trim().length === 0) throw new AppError('data', 'Trả lại bắt buộc ghi ý kiến.');
  const { db } = getServices();
  const now = nowIso();
  const batch = writeBatch(db);
  for (const { task, workflow } of items) {
    // Mỗi việc đi tới trạng thái hợp lệ đầu tiên theo hướng yêu cầu; nếu không có thì dừng cả batch (không làm dở dang).
    const targets = workflow.states.filter((s) => checkTransition(workflow, task, s.key, principal).ok);
    const wantCat = to === 'approve' ? (task.stateKey && categoryOf(workflow, task.stateKey) === 'review' ? ['done', 'review'] : ['done']) : ['doing', 'todo'];
    const target = wantCat.map((c) => targets.find((s) => categoryOf(workflow, s.key) === c && s.key !== task.stateKey)).find(Boolean);
    if (!target) throw new AppError('permission', `Bạn không thể ${to === 'approve' ? 'duyệt' : 'trả lại'} “${task.title}”.`);
    const c = checkTransition(workflow, task, target.key, principal);
    if (c.requiresComment && note.trim().length === 0) throw new AppError('data', 'Bước này bắt buộc nhập ý kiến.');
    batch.update(doc(db, 'tasks', task.id), stripUndefined(transitionPatch({ task, workflow, to: target.key, note, actorId: actor.uid, now, activityId: newId() })));
    for (const n of transitionNotices(task, workflow, target.key, actor, note.trim())) addNotice(batch, actor.uid, n);
    for (const n of extra?.(task, target.key) ?? []) addNotice(batch, actor.uid, n);
  }
  try {
    await batch.commit();
    return items.length;
  } catch (e) {
    throw classify(e);
  }
}

export async function updateTaskFields(taskId: string, fields: Partial<Pick<Task, 'description' | 'customFields' | 'checklist' | 'links' | 'title' | 'priority' | 'labels' | 'startAt'>>): Promise<void> {
  try {
    await updateDoc(doc(getServices().db, 'tasks', taskId), { ...stripUndefined(fields), updatedAt: nowIso() });
  } catch (e) {
    throw classify(e);
  }
}

export async function setChecklist(taskId: string, checklist: ChecklistItem[]): Promise<void> {
  if (checklist.length > 50) throw new AppError('data', 'Tối đa 50 mục checklist.');
  await updateTaskFields(taskId, { checklist });
}

export async function setLinks(taskId: string, links: TaskLink[]): Promise<void> {
  if (links.some((l) => !/^https?:\/\//i.test(l.url))) throw new AppError('data', 'Đường dẫn phải bắt đầu bằng http:// hoặc https://.');
  if (links.length > 20) throw new AppError('data', 'Tối đa 20 liên kết.');
  await updateTaskFields(taskId, { links });
}

export async function extendTask(task: Task, newDue: string, reason: string, actor: UserProfile): Promise<void> {
  if (reason.trim().length === 0) throw new AppError('data', 'Gia hạn bắt buộc ghi lý do.');
  const { db } = getServices();
  try {
    const b = writeBatch(db);
    b.update(doc(db, 'tasks', task.id), stripUndefined(extendPatch(newDue, reason, task.dueAt, actor.uid, nowIso(), newId())));
    for (const uid of task.assigneeIds) addNotice(b, actor.uid, { userId: uid, taskId: task.id, kind: 'extended', text: `“${task.title}” được gia hạn tới ${newDue}` });
    await b.commit();
  } catch (e) {
    throw classify(e);
  }
}

export async function reassignTask(task: Task, newAssignee: string, keepOld: boolean, actor: UserProfile, names: (uid: string) => string): Promise<void> {
  if (newAssignee === task.assigneeIds[0] && task.assigneeIds.length === 1) throw new AppError('data', 'Người phụ trách mới trùng người hiện tại.');
  const collab = [...task.collaboratorIds.filter((x) => x !== newAssignee), ...(keepOld ? task.assigneeIds.filter((x) => x !== newAssignee) : [])];
  const { db } = getServices();
  try {
    const b = writeBatch(db);
    b.update(doc(db, 'tasks', task.id), stripUndefined(peoplePatch({ assigneeIds: [newAssignee], collaboratorIds: collab, reviewerIds: task.reviewerIds }, actor.uid, `Đổi người phụ trách: ${task.assigneeIds.map(names).join(', ')} → ${names(newAssignee)}${keepOld ? ' (giữ người cũ phối hợp)' : ''}`, nowIso(), newId())));
    addNotice(b, actor.uid, { userId: newAssignee, taskId: task.id, kind: 'reassigned', text: `${actor.name} giao lại “${task.title}” cho bạn` });
    await b.commit();
  } catch (e) {
    throw classify(e);
  }
}

export const REMINDER_MAX = 200;

/** Nội dung thông báo gửi tới người nhận: tên người nhắc + tên việc (cắt gọn) + lời nhắn. Giữ ≤ 300 ký tự theo Rules. */
export function reminderText(actorName: string, taskTitle: string, message: string): string {
  const title = taskTitle.length > 60 ? `${taskTitle.slice(0, 59)}…` : taskTitle;
  return `${actorName} nhắc bạn “${title}”: ${message.trim().slice(0, REMINDER_MAX)}`.slice(0, 300);
}

/**
 * Tạo lời nhắc: gửi thông báo trong app kèm lời nhắn của người nhắc tới những người được chọn
 * (người phụ trách / phối hợp của từng việc). Một batch nguyên tử; không tự gửi cho chính mình.
 */
export async function createReminders(tasks: Task[], recipientIds: string[], message: string, actor: UserProfile): Promise<number> {
  if (message.trim().length === 0) throw new AppError('data', 'Hãy viết nội dung lời nhắc.');
  if (message.trim().length > REMINDER_MAX) throw new AppError('data', `Lời nhắc tối đa ${REMINDER_MAX} ký tự.`);
  const { db } = getServices();
  const chosen = new Set(recipientIds);
  const b = writeBatch(db);
  let n = 0;
  for (const t of tasks) {
    for (const uid of new Set([...t.assigneeIds, ...t.collaboratorIds])) {
      if (!chosen.has(uid) || uid === actor.uid) continue;
      addNotice(b, actor.uid, { userId: uid, taskId: t.id, kind: 'reminder', text: reminderText(actor.name, t.title, message) });
      n++;
    }
  }
  if (n === 0) throw new AppError('data', 'Chưa chọn người nhận (hoặc người nhận chỉ có bạn).');
  if (n > 400) throw new AppError('data', 'Quá nhiều thông báo cho một lần nhắc.');
  try {
    await b.commit();
    return n;
  } catch (e) {
    throw classify(e);
  }
}

export async function addComment(task: Task, body: string, mentions: string[], actor: UserProfile): Promise<void> {
  const text = body.trim();
  if (!text) throw new AppError('data', 'Bình luận không được để trống.');
  if (text.length > 2000) throw new AppError('data', 'Bình luận tối đa 2000 ký tự.');
  const { db } = getServices();
  try {
    await addDoc(collection(db, 'tasks', task.id, 'comments'), { authorId: actor.uid, body: text, mentions: mentions.slice(0, 20), createdAt: nowIso() });
    const b = writeBatch(db);
    for (const uid of mentions) addNotice(b, actor.uid, { userId: uid, taskId: task.id, kind: 'mention', text: `${actor.name} nhắc bạn ở “${task.title}”` });
    if (mentions.length > 0) await b.commit();
  } catch (e) {
    throw classify(e);
  }
}

export async function fetchTask(id: string): Promise<Task | null> {
  try {
    const s = await getDoc(doc(getServices().db, 'tasks', id));
    return s.exists() ? toTask(s.id, s.data()) : null;
  } catch (e) {
    throw classify(e);
  }
}

