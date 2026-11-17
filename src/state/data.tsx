import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { subscribeConfig, subscribeNotifications, subscribeTasks, type ConfigData } from '../services/firebase/subscriptions';
import type { AppError } from '../services/errors';
import { useAuth } from './auth';
import { scopeUnits } from '../domain/permissions';
import { categoryOf } from '../domain/workflow';
import { DEFAULT_SETTINGS, type AppNotification, type OrgUnit, type StateCategory, type Task, type TaskType, type UserProfile, type Workflow } from '../domain/types';
import { todayLocal } from '../domain/dates';

export interface DataState extends ConfigData {
  users: UserProfile[];
  tasks: Task[];
  notifications: AppNotification[];
  ready: boolean; // cấu hình + việc đã tải lần đầu
  errors: string[];
  today: string;
  unitById: (id: string | null | undefined) => OrgUnit | undefined;
  typeById: (id: string) => TaskType | undefined;
  wfById: (id: string) => Workflow | undefined;
  wfOfType: (typeId: string) => Workflow | undefined;
  wfOfTask: (t: Task) => Workflow | undefined;
  userById: (id: string) => UserProfile | undefined;
  userName: (id: string) => string;
  categoryOfTask: (t: Task) => StateCategory;
  stateLabel: (t: Task) => string;
}

const Ctx = createContext<DataState | null>(null);

type Loaded = Partial<Record<'units' | 'roles' | 'workflows' | 'taskTypes' | 'templates' | 'terms' | 'users' | 'settings' | 'tasks', true>>;

export function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  return (p.length === 1 ? p[0].slice(0, 2) : p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase();
}

/** Mỗi tài khoản có một DataProvider riêng (key = uid) => đổi tài khoản huỷ sạch listener và dữ liệu cũ. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { profile, principal } = useAuth();
  const uid = profile?.uid ?? '';
  const scope = useMemo(() => scopeUnits(principal, 'task.view_all'), [principal]);
  const scopeKey = scope === '*' ? '*' : scope.join(',');

  const [cfg, setCfg] = useState<{ units: OrgUnit[]; roles: ConfigData['roles']; workflows: Workflow[]; taskTypes: TaskType[]; templates: ConfigData['templates']; terms: ConfigData['terms']; settings: ConfigData['settings']; users: UserProfile[] }>({
    units: [], roles: [], workflows: [], taskTypes: [], templates: [], terms: [], settings: DEFAULT_SETTINGS, users: [],
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState<Loaded>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [today, setToday] = useState(todayLocal());

  useEffect(() => {
    const id = window.setInterval(() => setToday(todayLocal()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!uid) return;
    const onErr = (e: AppError) => setErrors((x) => (x.includes(e.message) ? x : [...x, e.message]));
    const mark = (k: keyof Loaded) => setLoaded((l) => ({ ...l, [k]: true }));
    const offs = [
      subscribeConfig((k, v) => {
        setCfg((c) => ({ ...c, [k]: v }));
        mark(k as keyof Loaded);
      }, onErr),
      subscribeTasks(uid, scope === '*' ? '*' : scope, (t) => { setTasks(t); mark('tasks'); }, onErr),
      subscribeNotifications(uid, setNotifications, onErr),
    ];
    return () => offs.forEach((o) => o());
    // scopeKey thay cho scope (mảng mới mỗi render) để không tạo lại listener vô cớ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, scopeKey]);

  const value = useMemo<DataState>(() => {
    const unitMap = new Map(cfg.units.map((u) => [u.id, u]));
    const typeMap = new Map(cfg.taskTypes.map((t) => [t.id, t]));
    const wfMap = new Map(cfg.workflows.map((w) => [w.id, w]));
    const userMap = new Map(cfg.users.map((u) => [u.uid, u]));
    const wfOfType = (typeId: string) => wfMap.get(typeMap.get(typeId)?.workflowId ?? '');
    const wfOfTask = (t: Task) => wfMap.get(t.workflowId) ?? wfOfType(t.typeId);
    return {
      ...cfg, tasks, notifications, errors, today,
      ready: ['units', 'roles', 'workflows', 'taskTypes', 'users', 'settings', 'tasks'].every((k) => loaded[k as keyof Loaded]),
      unitById: (id) => (id ? unitMap.get(id) : undefined),
      typeById: (id) => typeMap.get(id),
      wfById: (id) => wfMap.get(id),
      wfOfType,
      wfOfTask,
      userById: (id) => userMap.get(id),
      userName: (id) => userMap.get(id)?.name ?? '(không rõ)',
      categoryOfTask: (t) => categoryOf(wfOfTask(t), t.stateKey),
      stateLabel: (t) => wfOfTask(t)?.states.find((s) => s.key === t.stateKey)?.label ?? t.stateKey,
    };
  }, [cfg, tasks, notifications, errors, today, loaded]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData ngoài DataProvider');
  return c;
}
