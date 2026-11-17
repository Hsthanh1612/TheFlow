import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { Icon, Loading, PageHead, ErrorBox } from '../components/ui';
import { useTaskView } from '../components/taskBits';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { getServices } from '../services/firebase/init';
import { nowIso } from '../services/firebase/ids';
import { classify } from '../services/errors';
import { applyFilter, EMPTY_FILTER, type DueFilter, type TaskFilter } from '../domain/filters';
import { descendantIds } from '../domain/permissions';
import { ListView } from './views/ListView';
import { KanbanView } from './views/KanbanView';
import { CalendarView } from './views/CalendarView';
import { TimelineView } from './views/TimelineView';

type ViewKey = 'list' | 'kanban' | 'calendar' | 'timeline';
const VIEWS: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'list', label: 'Danh sách', icon: 'list' }, { key: 'kanban', label: 'Kanban', icon: 'kanban' },
  { key: 'calendar', label: 'Lịch', icon: 'calendar' }, { key: 'timeline', label: 'Timeline', icon: 'timeline' },
];
const DUE: { v: DueFilter; l: string }[] = [{ v: 'all', l: 'Hạn: Tất cả' }, { v: 'overdue', l: 'Đã quá hạn' }, { v: 'week', l: '7 ngày tới' }, { v: 'month', l: 'Tháng này' }, { v: 'none', l: 'Chưa có hạn' }];

interface Saved { id: string; name: string; view: ViewKey; filters: TaskFilter }

function useSavedViews(uid: string) {
  const [items, setItems] = useState<Saved[]>([]);
  const [err, setErr] = useState('');
  const load = async () => {
    try {
      const s = await getDocs(query(collection(getServices().db, 'savedViews'), where('ownerId', '==', uid)));
      setItems(s.docs.map((d) => ({ id: d.id, name: String(d.data().name), view: d.data().view as ViewKey, filters: { ...EMPTY_FILTER, ...(d.data().filters as Partial<TaskFilter>) } })));
    } catch (e) {
      setErr(classify(e).message);
    }
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  return { items, err, reload: load };
}

export function TasksPage() {
  const v = useTaskView();
  const { profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const params = useParams();
  const [sp] = useSearchParams();
  const view: ViewKey = (VIEWS.find((x) => x.key === params.view)?.key ?? 'kanban') as ViewKey;
  const [filter, setFilter] = useState<TaskFilter>({ ...EMPTY_FILTER, text: sp.get('q') ?? '' });
  const [group, setGroup] = useState<'none' | 'unit' | 'type'>('none');
  const saved = useSavedViews(profile?.uid ?? '');

  useEffect(() => { const q = sp.get('q'); if (q !== null) setFilter((f) => ({ ...f, text: q })); }, [sp]);

  const labels = useMemo(() => [...new Set(v.tasks.flatMap((t) => t.labels))].sort(), [v.tasks]);
  const filtered = useMemo(
    () => applyFilter(v.tasks, filter, v.wfOfTask, v.today, (id) => descendantIds(v.units, id)),
    [v.tasks, filter, v.wfOfTask, v.today, v.units],
  );
  const set = <K extends keyof TaskFilter>(k: K, val: TaskFilter[K]) => setFilter((f) => ({ ...f, [k]: val }));
  const people = useMemo(() => v.users.filter((u) => u.active && v.tasks.some((t) => t.assigneeIds.includes(u.uid))), [v.users, v.tasks]);
  const scopeText = v.units.length && filter.unitId ? v.unitById(filter.unitId)?.name : 'Phạm vi bạn được xem';

  async function saveFilter() {
    const name = window.prompt('Đặt tên cho bộ lọc này:');
    if (!name || !name.trim() || !profile) return;
    await toast.run(async () => { await addDoc(collection(getServices().db, 'savedViews'), { ownerId: profile.uid, name: name.trim().slice(0, 80), view, filters: filter, createdAt: nowIso() }); await saved.reload(); }, 'Đã lưu bộ lọc.');
  }
  async function removeSaved(id: string) {
    await toast.run(async () => { await deleteDoc(doc(getServices().db, 'savedViews', id)); await saved.reload(); }, 'Đã xoá bộ lọc.');
  }

  if (!v.ready) return <Loading />;
  return (
    <div className="screen">
      <PageHead title="Bảng công việc" sub={`${scopeText} · ${filtered.length} việc`}
        actions={
          <div className="tabs" role="tablist" aria-label="Kiểu xem">
            {VIEWS.map((x) => (
              <Link key={x.key} role="tab" aria-selected={view === x.key} to={`/tasks/${x.key}`} className={`tab${view === x.key ? ' on' : ''}`}><Icon name={x.icon} size={15} />{x.label}</Link>
            ))}
          </div>
        } />
      <ErrorBox errors={[...v.errors, ...(saved.err ? [saved.err] : [])]} />
      <div className="chips" role="group" aria-label="Bộ lọc">
        <select className="sel" aria-label="Bộ môn" value={filter.unitId} onChange={(e) => set('unitId', e.target.value)}>
          <option value="">Bộ môn: Tất cả</option>{v.units.filter((u) => !u.archived).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="sel" aria-label="Người phụ trách" value={filter.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
          <option value="">Người phụ trách: Tất cả</option>{people.map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
        </select>
        <select className="sel" aria-label="Loại việc" value={filter.typeId} onChange={(e) => set('typeId', e.target.value)}>
          <option value="">Loại việc: Tất cả</option>{v.taskTypes.filter((t) => !t.archived).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="sel" aria-label="Nhãn" value={filter.label} onChange={(e) => set('label', e.target.value)}>
          <option value="">Nhãn: Tất cả</option>{labels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="sel" aria-label="Hạn" value={filter.due} onChange={(e) => set('due', e.target.value as DueFilter)}>{DUE.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}</select>
        <input className="sel" type="search" aria-label="Tìm theo tiêu đề" placeholder="Tìm tiêu đề…" value={filter.text} onChange={(e) => set('text', e.target.value)} />
        {view === 'timeline' && (
          <select className="sel" aria-label="Nhóm theo" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
            <option value="none">Nhóm theo: Không</option><option value="unit">Nhóm theo: Bộ môn</option><option value="type">Nhóm theo: Loại việc</option>
          </select>
        )}
        <button className="btn sm" onClick={() => setFilter(EMPTY_FILTER)}>Xoá lọc</button>
        <button className="btn sm" style={{ background: 'var(--accent-bg)', color: 'var(--accent-ink)' }} onClick={() => void saveFilter()}>Lưu bộ lọc</button>
        {saved.items.length > 0 && (
          <select className="sel" aria-label="Bộ lọc đã lưu" value="" onChange={(e) => { const s = saved.items.find((x) => x.id === e.target.value); if (s) { setFilter(s.filters); nav(`/tasks/${s.view}`); } }}>
            <option value="">Bộ lọc đã lưu…</option>{saved.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      {saved.items.length > 0 && (
        <details><summary className="note">Quản lý bộ lọc đã lưu</summary>
          <div className="row" style={{ marginTop: 6 }}>{saved.items.map((s) => <span key={s.id} className="tg">{s.name} <button className="linkbtn" aria-label={`Xoá bộ lọc ${s.name}`} onClick={() => void removeSaved(s.id)}>✕</button></span>)}</div>
        </details>
      )}
      {view === 'list' && <ListView tasks={filtered} typeId={filter.typeId} />}
      {view === 'kanban' && <KanbanView tasks={filtered} typeId={filter.typeId} />}
      {view === 'calendar' && <CalendarView tasks={filtered} />}
      {view === 'timeline' && <TimelineView tasks={filtered} group={group} />}
    </div>
  );
}
