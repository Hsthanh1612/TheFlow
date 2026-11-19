import type { DocumentData } from 'firebase/firestore';
import type { AcademicTerm, ActivityEntry, AppNotification, AppSettings, OrgUnit, Role, Task, TaskTemplate, TaskType, UserProfile, Workflow } from '../../domain/types';
import { DEFAULT_SETTINGS } from '../../domain/types';
import { withDerived } from '../../domain/workflow';

// Chuẩn hoá dữ liệu đọc từ Firestore: điền mặc định cho trường thiếu để UI không vỡ khi gặp tài liệu cũ/sai.

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

export function toTask(id: string, d: DocumentData): Task {
  return {
    id,
    typeId: str(d.typeId),
    workflowId: str(d.workflowId),
    title: str(d.title, '(không tiêu đề)'),
    description: str(d.description),
    stateKey: str(d.stateKey),
    priority: d.priority === 'high' || d.priority === 'low' ? d.priority : 'normal',
    labels: arr<string>(d.labels),
    startAt: typeof d.startAt === 'string' ? d.startAt : null,
    dueAt: typeof d.dueAt === 'string' ? d.dueAt : null,
    unitId: str(d.unitId),
    assigneeIds: arr<string>(d.assigneeIds),
    collaboratorIds: arr<string>(d.collaboratorIds),
    reviewerIds: arr<string>(d.reviewerIds),
    participantIds: arr<string>(d.participantIds),
    checklist: arr(d.checklist),
    links: arr(d.links),
    customFields: d.customFields && typeof d.customFields === 'object' ? d.customFields : {},
    activity: d.activity && typeof d.activity === 'object' ? (d.activity as Record<string, ActivityEntry>) : {},
    lastActivityId: typeof d.lastActivityId === 'string' ? d.lastActivityId : null,
    statusNote: str(d.statusNote),
    statusNoteAt: typeof d.statusNoteAt === 'string' ? d.statusNoteAt : null,
    templateId: typeof d.templateId === 'string' ? d.templateId : null,
    bulkId: typeof d.bulkId === 'string' ? d.bulkId : null,
    createdBy: str(d.createdBy),
    createdAt: str(d.createdAt),
    updatedAt: str(d.updatedAt),
    completedAt: typeof d.completedAt === 'string' ? d.completedAt : null,
  };
}

export function toUser(uid: string, d: DocumentData): UserProfile {
  return {
    uid,
    name: str(d.name, uid),
    email: str(d.email),
    active: d.active === true,
    unitId: typeof d.unitId === 'string' ? d.unitId : null,
    assignments: arr(d.assignments),
    scopes: d.scopes && typeof d.scopes === 'object' ? d.scopes : {},
    createdAt: str(d.createdAt),
  };
}

export function toUnit(id: string, d: DocumentData): OrgUnit {
  return { id, parentId: typeof d.parentId === 'string' ? d.parentId : null, name: str(d.name, id), kind: d.kind === 'khoa' || d.kind === 'to' ? d.kind : 'bomon', color: str(d.color, '#2F6BE0'), headId: typeof d.headId === 'string' ? d.headId : null, archived: d.archived === true };
}

export function toRole(key: string, d: DocumentData): Role {
  return { key, name: str(d.name, key), permissions: arr(d.permissions), archived: d.archived === true };
}

export function toWorkflow(id: string, d: DocumentData): Workflow {
  return withDerived({ id, name: str(d.name, id), initialState: str(d.initialState), states: arr(d.states), transitions: arr(d.transitions), archived: d.archived === true });
}

export function toTaskType(id: string, d: DocumentData): TaskType {
  return { id, name: str(d.name, id), color: str(d.color, '#2F6BE0'), workflowId: str(d.workflowId), fields: arr(d.fields), archived: d.archived === true };
}

export function toTemplate(id: string, d: DocumentData): TaskTemplate {
  return {
    id, name: str(d.name, id), typeId: str(d.typeId), title: str(d.title), description: str(d.description),
    priority: d.priority === 'high' || d.priority === 'low' ? d.priority : 'normal', checklist: arr<string>(d.checklist),
    dueOffsetDays: typeof d.dueOffsetDays === 'number' ? d.dueOffsetDays : 7, recurrence: d.recurrence && typeof d.recurrence === 'object' ? d.recurrence : null, archived: d.archived === true,
  };
}

export function toTerm(id: string, d: DocumentData): AcademicTerm {
  return { id, name: str(d.name, id), startDate: str(d.startDate), endDate: str(d.endDate) };
}

export function toSettings(d: DocumentData | undefined): AppSettings {
  if (!d) return DEFAULT_SETTINGS;
  return {
    riskDays: typeof d.riskDays === 'number' ? d.riskDays : DEFAULT_SETTINGS.riskDays,
    riskProgress: typeof d.riskProgress === 'number' ? d.riskProgress : DEFAULT_SETTINGS.riskProgress,
    reminderDays: arr<number>(d.reminderDays),
    categoryLabels: { ...DEFAULT_SETTINGS.categoryLabels, ...(d.categoryLabels ?? {}) },
  };
}

export function toNotification(id: string, userId: string, d: DocumentData): AppNotification {
  return { id, userId, actorId: str(d.actorId), taskId: typeof d.taskId === 'string' ? d.taskId : null, kind: d.kind, text: str(d.text), createdAt: str(d.createdAt), readAt: typeof d.readAt === 'string' ? d.readAt : null };
}
