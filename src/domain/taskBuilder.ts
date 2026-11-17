import type { ChecklistItem, CustomValue, Priority, Task, TaskType, Workflow } from './types';
import { normalizeCustomFields } from './fields';
import { participantsOf } from './taskLogic';
import { categoryOf } from './workflow';

export interface NewTaskInput {
  id: string;
  type: TaskType;
  workflow: Workflow;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  startAt: string | null;
  dueAt: string | null;
  unitId: string;
  assigneeIds: string[];
  collaboratorIds: string[];
  reviewerIds: string[];
  checklist: string[];
  customFields: Record<string, CustomValue>;
  templateId: string | null;
  bulkId: string | null;
  createdBy: string;
  now: string; // ISO
  newItemId: () => string;
}

export function buildTask(i: NewTaskInput): Task {
  const t: Task = {
    id: i.id,
    typeId: i.type.id,
    workflowId: i.workflow.id,
    title: i.title.trim(),
    description: i.description.trim(),
    stateKey: i.workflow.initialState,
    priority: i.priority,
    labels: [...new Set(i.labels.map((l) => l.trim()).filter(Boolean))].slice(0, 10),
    startAt: i.startAt,
    dueAt: i.dueAt,
    unitId: i.unitId,
    assigneeIds: [...new Set(i.assigneeIds)],
    collaboratorIds: [...new Set(i.collaboratorIds)].filter((x) => !i.assigneeIds.includes(x)),
    reviewerIds: [...new Set(i.reviewerIds)],
    participantIds: [],
    checklist: i.checklist.map((x) => x.trim()).filter(Boolean).map((text): ChecklistItem => ({ id: i.newItemId(), text, done: false })),
    links: [],
    customFields: normalizeCustomFields(i.type.fields, i.customFields),
    activity: {},
    lastActivityId: null,
    statusNote: '',
    statusNoteAt: null,
    templateId: i.templateId,
    bulkId: i.bulkId,
    createdBy: i.createdBy,
    createdAt: i.now,
    updatedAt: i.now,
    completedAt: null,
  };
  t.participantIds = participantsOf(t);
  return t;
}

export type Patch = Record<string, unknown>;

/** Ghi một mục nhật ký (đường dẫn con của map `activity`) + `lastActivityId`, đúng yêu cầu của Firestore Rules. */
export function activityPatch(actorId: string, action: string, detail: string, now: string, id: string): Patch {
  return { [`activity.${id}`]: { actorId, action, detail: detail.slice(0, 500), createdAt: now }, lastActivityId: id };
}

export interface TransitionInput {
  task: Task;
  workflow: Workflow;
  to: string;
  note: string;
  actorId: string;
  now: string;
  activityId: string;
}

export function transitionPatch(i: TransitionInput): Patch {
  const toState = i.workflow.states.find((s) => s.key === i.to);
  if (!toState) throw new Error('Trạng thái đích không tồn tại trong quy trình.');
  const isDone = categoryOf(i.workflow, i.to) === 'done';
  const fromLabel = i.workflow.states.find((s) => s.key === i.task.stateKey)?.label ?? i.task.stateKey;
  return {
    stateKey: i.to,
    completedAt: isDone ? i.now : null,
    updatedAt: i.now,
    statusNote: i.note.trim().slice(0, 500),
    statusNoteAt: i.now,
    ...activityPatch(i.actorId, 'transition', `${fromLabel} → ${toState.label}${i.note.trim() ? `: ${i.note.trim()}` : ''}`, i.now, i.activityId),
  };
}

export function peoplePatch(next: { assigneeIds: string[]; collaboratorIds: string[]; reviewerIds: string[] }, actorId: string, detail: string, now: string, activityId: string): Patch {
  const merged = { assigneeIds: [...new Set(next.assigneeIds)], collaboratorIds: [...new Set(next.collaboratorIds)].filter((x) => !next.assigneeIds.includes(x)), reviewerIds: [...new Set(next.reviewerIds)] };
  return { ...merged, participantIds: participantsOf(merged), updatedAt: now, ...activityPatch(actorId, 'reassign', detail, now, activityId) };
}

export function extendPatch(newDue: string, reason: string, oldDue: string | null, actorId: string, now: string, activityId: string): Patch {
  return { dueAt: newDue, updatedAt: now, ...activityPatch(actorId, 'extend', `Gia hạn ${oldDue ?? '—'} → ${newDue}. Lý do: ${reason.trim()}`, now, activityId) };
}

/** Bỏ khoá undefined (Firestore không nhận undefined). */
export function stripUndefined(p: Patch): Patch {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
}
