import { Link } from 'react-router-dom';
import { Avatars, ProgressBar, StatusBadge } from './ui';
import { useData } from '../state/data';
import { displayStatus, progressOf } from '../domain/taskLogic';
import { vnDayMonth } from '../domain/dates';
import type { Task } from '../domain/types';

export function useTaskView() {
  const d = useData();
  return {
    ...d,
    status: (t: Task) => displayStatus(t, d.categoryOfTask(t), d.today),
    progress: (t: Task) => progressOf(t, d.categoryOfTask(t)),
    statusLabel: (t: Task) => {
      const s = displayStatus(t, d.categoryOfTask(t), d.today);
      return s === 'late' ? 'Quá hạn' : d.stateLabel(t);
    },
  };
}

export function TaskStatus({ t }: { t: Task }) {
  const v = useTaskView();
  return <StatusBadge status={v.status(t)} label={v.statusLabel(t)} />;
}

export function TypeTag({ typeId }: { typeId: string }) {
  const { typeById } = useData();
  return <span className="tg">{typeById(typeId)?.name ?? '—'}</span>;
}

export function TaskLinkTitle({ t }: { t: Task }) {
  return <Link className="tl" to={`/task/${t.id}`}>{t.title}</Link>;
}

export function ProgressCell({ t }: { t: Task }) {
  const v = useTaskView();
  const p = v.progress(t);
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <div style={{ flex: 1 }}><ProgressBar pct={p} /></div>
      <span className="note" style={{ width: 34 }}>{p}%</span>
    </div>
  );
}

export function AssigneeAvatars({ t }: { t: Task }) {
  const { userName } = useData();
  return <Avatars names={[...t.assigneeIds, ...t.collaboratorIds].map(userName)} />;
}

export function DueText({ t }: { t: Task }) {
  const v = useTaskView();
  const late = v.status(t) === 'late';
  return <span style={{ color: late ? 'var(--danger)' : undefined }}>{vnDayMonth(t.dueAt)}</span>;
}
