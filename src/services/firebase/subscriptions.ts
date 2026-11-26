import { collection, limit, onSnapshot, orderBy, query, where, documentId, type Query, type Unsubscribe } from 'firebase/firestore';
import { getServices } from './init';
import { toAutomation, toGoal, toNotification, toRole, toSettings, toSnapshot, toTask, toTaskType, toTemplate, toTerm, toTimeEntry, toTimer, toUnit, toUser, toWorkflow } from './converters';
import { classify, type AppError } from '../errors';
import type { AcademicTerm, AppNotification, AppSettings, Automation, Goal, OrgUnit, Role, RunningTimer, Task, TaskTemplate, TaskType, TimeEntry, UserProfile, WeekSnapshot, Workflow } from '../../domain/types';
import { doc } from 'firebase/firestore';

type OnErr = (e: AppError) => void;

function listen<T>(q: Query, map: (id: string, d: Record<string, unknown>) => T, cb: (items: T[]) => void, onErr: OnErr): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => map(d.id, d.data()))),
    (e) => onErr(classify(e)),
  );
}

export interface ConfigData {
  units: OrgUnit[];
  roles: Role[];
  workflows: Workflow[];
  taskTypes: TaskType[];
  templates: TaskTemplate[];
  terms: AcademicTerm[];
  settings: AppSettings;
}

/** Cấu hình + người dùng: tập nhỏ, nghe một lần cho cả phiên. */
export function subscribeConfig(onChange: <K extends keyof ConfigData | 'users'>(k: K, v: K extends 'users' ? UserProfile[] : ConfigData[K & keyof ConfigData]) => void, onErr: OnErr): Unsubscribe {
  const { db } = getServices();
  const offs: Unsubscribe[] = [
    listen(collection(db, 'units'), toUnit, (v) => onChange('units', v), onErr),
    listen(collection(db, 'roles'), (id, d) => toRole(id, d), (v) => onChange('roles', v), onErr),
    listen(collection(db, 'workflows'), toWorkflow, (v) => onChange('workflows', v), onErr),
    listen(collection(db, 'taskTypes'), toTaskType, (v) => onChange('taskTypes', v), onErr),
    listen(collection(db, 'templates'), toTemplate, (v) => onChange('templates', v), onErr),
    listen(collection(db, 'terms'), toTerm, (v) => onChange('terms', v), onErr),
    listen(collection(db, 'users'), toUser, (v) => onChange('users', v), onErr),
    onSnapshot(doc(db, 'settings', 'app'), (s) => onChange('settings', toSettings(s.data())), (e) => onErr(classify(e))),
  ];
  return () => offs.forEach((o) => o());
}

export const MAX_TASKS_LISTENED = 3000;

/**
 * Nghe việc theo đúng phạm vi quyền (Rules chỉ cho phép các truy vấn này):
 *  - việc tôi tham gia, việc tôi tạo
 *  - nếu có task.view_all: toàn Khoa ('*') hoặc từng nhóm ≤30 đơn vị (giới hạn của toán tử `in`)
 * Gộp theo id; huỷ toàn bộ listener khi đổi tài khoản.
 */
export function subscribeTasks(uid: string, viewScope: '*' | string[], onChange: (tasks: Task[]) => void, onErr: OnErr): Unsubscribe {
  const { db } = getServices();
  const parts = new Map<string, Task[]>();
  const emit = () => {
    const m = new Map<string, Task>();
    for (const list of parts.values()) for (const t of list) m.set(t.id, t);
    onChange([...m.values()]);
  };
  const add = (key: string, q: Query): Unsubscribe =>
    listen(q, toTask, (items) => { parts.set(key, items); emit(); }, onErr);
  const tasks = collection(db, 'tasks');
  const offs: Unsubscribe[] = [add('mine', query(tasks, where('participantIds', 'array-contains', uid), limit(MAX_TASKS_LISTENED))), add('created', query(tasks, where('createdBy', '==', uid), limit(MAX_TASKS_LISTENED)))];
  if (viewScope === '*') offs.push(add('all', query(tasks, limit(MAX_TASKS_LISTENED))));
  else for (let i = 0; i < viewScope.length; i += 30) offs.push(add(`u${i}`, query(tasks, where('unitId', 'in', viewScope.slice(i, i + 30)), limit(MAX_TASKS_LISTENED))));
  return () => offs.forEach((o) => o());
}

export function subscribeNotifications(uid: string, onChange: (n: AppNotification[]) => void, onErr: OnErr): Unsubscribe {
  const { db } = getServices();
  const q = query(collection(db, 'users', uid, 'notifications'), orderBy(documentId()), limit(40));
  return listen(q, (id, d) => toNotification(id, uid, d), onChange, onErr);
}

export function subscribeComments(taskId: string, onChange: (c: { id: string; authorId: string; body: string; mentions: string[]; createdAt: string }[]) => void, onErr: OnErr): Unsubscribe {
  const { db } = getServices();
  const q = query(collection(db, 'tasks', taskId, 'comments'), orderBy('createdAt', 'asc'), limit(200));
  return listen(
    q,
    (id, d) => ({ id, authorId: String(d.authorId ?? ''), body: String(d.body ?? ''), mentions: Array.isArray(d.mentions) ? (d.mentions as string[]) : [], createdAt: String(d.createdAt ?? '') }),
    onChange,
    onErr,
  );
}

/** Giờ công: của tôi + (nếu có task.view_all) của cả phạm vi xem, cùng mẫu truy vấn với việc (Rules chỉ cho phép các truy vấn này). */
export function subscribeTimeEntries(uid: string, viewScope: '*' | string[], onChange: (e: TimeEntry[]) => void, onErr: OnErr): Unsubscribe {
  const { db } = getServices();
  const parts = new Map<string, TimeEntry[]>();
  const emit = () => {
    const m = new Map<string, TimeEntry>();
    for (const list of parts.values()) for (const e of list) m.set(e.id, e);
    onChange([...m.values()]);
  };
  const add = (key: string, q: Query): Unsubscribe => listen(q, toTimeEntry, (items) => { parts.set(key, items); emit(); }, onErr);
  const col = collection(db, 'timeEntries');
  const offs: Unsubscribe[] = [add('mine', query(col, where('userId', '==', uid), limit(MAX_TASKS_LISTENED)))];
  if (viewScope === '*') offs.push(add('all', query(col, limit(MAX_TASKS_LISTENED))));
  else for (let i = 0; i < viewScope.length; i += 30) offs.push(add(`u${i}`, query(col, where('unitId', 'in', viewScope.slice(i, i + 30)), limit(MAX_TASKS_LISTENED))));
  return () => offs.forEach((o) => o());
}

export function subscribeTimer(uid: string, onChange: (t: RunningTimer | null) => void, onErr: OnErr): Unsubscribe {
  return onSnapshot(doc(getServices().db, 'users', uid, 'timer', 'current'), (s) => onChange(toTimer(s.data())), (e) => onErr(classify(e)));
}

export const subscribeGoals = (onChange: (g: Goal[]) => void, onErr: OnErr): Unsubscribe => listen(query(collection(getServices().db, 'goals'), limit(500)), toGoal, onChange, onErr);
export const subscribeAutomations = (onChange: (a: Automation[]) => void, onErr: OnErr): Unsubscribe => listen(query(collection(getServices().db, 'automations'), limit(200)), toAutomation, onChange, onErr);
export const subscribeSnapshots = (onChange: (s: WeekSnapshot[]) => void, onErr: OnErr): Unsubscribe => listen(query(collection(getServices().db, 'snapshots'), limit(120)), toSnapshot, onChange, onErr);
