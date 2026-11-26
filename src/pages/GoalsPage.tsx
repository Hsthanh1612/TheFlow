import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field, Modal, PageHead, ProgressBar } from '../components/ui';
import { useAuth } from '../state/auth';
import { useData } from '../state/data';
import { useToast } from '../state/toast';
import { saveGoal } from '../services/firebase/featuresRepo';
import { newId, nowIso } from '../services/firebase/ids';
import { AppError } from '../services/errors';
import { HEALTH_LABEL, goalHealth, goalProgress, krPercent, type GoalHealth } from '../domain/goals';
import { hasPerm } from '../domain/permissions';
import { fold } from '../domain/search';
import { vnDate } from '../domain/dates';
import type { Goal, KeyResult } from '../domain/types';

const HEALTH_CLASS: Record<GoalHealth, string> = { done: 'done', on_track: 'doing', at_risk: 'rev', late: 'late', no_deadline: 'todo' };
const blank = (unitId: string, ownerId: string, uid: string): Goal => ({ id: newId(), name: '', description: '', unitId, ownerId, termId: null, dueDate: null, status: 'active', keyResults: [], taskIds: [], createdBy: uid, createdAt: nowIso(), updatedAt: nowIso() });

export function GoalsPage() {
  const { profile, principal } = useAuth();
  const d = useData();
  const toast = useToast();
  const [edit, setEdit] = useState<Goal | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const tasksById = useMemo(() => new Map(d.tasks.map((t) => [t.id, t])), [d.tasks]);
  const isDone = (t: { stateKey: string }) => d.categoryOfTask(t as never) === 'done';
  const myUnits = d.units.filter((u) => !u.archived && hasPerm(principal, 'task.assign', u.id));
  const canCreate = myUnits.length > 0;
  const list = useMemo(() => d.goals.filter((g) => g.status !== 'archived' && (showDone || g.status !== 'done')).map((g) => { const p = goalProgress(g, tasksById, isDone); return { g, p, h: goalHealth(g, p.pct, d.today) }; }).sort((a, b) => Number(b.h === 'late') - Number(a.h === 'late') || a.p.pct - b.p.pct), [d.goals, tasksById, d.today, showDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!profile) return null;

  async function save(g: Goal) {
    const r = await toast.run(() => saveGoal(g), isNew ? 'Đã tạo mục tiêu.' : 'Đã lưu mục tiêu.');
    if (r.ok) setEdit(null);
  }

  return (
    <div className="screen">
      <PageHead title="Mục tiêu" sub="Gắn các việc và kết quả chính vào một mục tiêu của học kỳ để theo dõi tiến độ chung."
        actions={<>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Hiện cả mục tiêu đã xong</label>
          {canCreate && <button className="btn pri" onClick={() => { setIsNew(true); setEdit(blank(myUnits[0].id, profile.uid, profile.uid)); }}>Tạo mục tiêu</button>}
        </>} />
      {list.length === 0 ? (
        <div className="card"><div className="empty">Chưa có mục tiêu nào.{canCreate ? ' Bấm “Tạo mục tiêu” để bắt đầu, ví dụ “Hoàn thành hồ sơ kiểm định” với các việc và kết quả chính liên quan.' : ' Người có quyền giao việc ở đơn vị sẽ tạo mục tiêu.'}</div></div>
      ) : (
        <div className="g2 goals-grid">
          {list.map(({ g, p, h }) => {
            const canEdit = hasPerm(principal, 'task.assign', g.unitId);
            return (
              <article className="card goal" key={g.id} aria-label={g.name}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{g.name}</h3>
                    <div className="note">{d.unitById(g.unitId)?.name} · Phụ trách: {d.userName(g.ownerId)}{g.dueDate && <> · Hạn {vnDate(g.dueDate)}</>}{g.termId && <> · {d.terms.find((t) => t.id === g.termId)?.name}</>}</div>
                  </div>
                  <span className={`b ${HEALTH_CLASS[h]}`}>{HEALTH_LABEL[h]}</span>
                </div>
                <div className="goal-pct"><b>{p.pct}%</b><ProgressBar pct={p.pct} /></div>
                {g.description && <p className="note" style={{ margin: 0 }}>{g.description}</p>}
                {g.keyResults.length > 0 && (
                  <div className="list">
                    {g.keyResults.map((k) => (
                      <div className="li" key={k.id}><span style={{ flex: 1 }}>{k.text}</span><span className="note">{k.current}/{k.target} {k.unit}</span><b>{krPercent(k)}%</b></div>
                    ))}
                  </div>
                )}
                <div className="note">
                  {p.tasksTotal > 0 ? <>Việc liên kết: {p.tasksDone}/{p.tasksTotal} xong</> : 'Chưa liên kết việc nào'}
                  {p.missingTasks > 0 && <> · {p.missingTasks} việc ngoài phạm vi bạn xem</>}
                </div>
                {g.taskIds.length > 0 && <div className="chips">{g.taskIds.map((id) => tasksById.get(id)).filter(Boolean).slice(0, 6).map((t) => <Link key={t!.id} className="tg" to={`/task/${t!.id}`}>{t!.title.length > 28 ? `${t!.title.slice(0, 27)}…` : t!.title}</Link>)}</div>}
                {canEdit && <div><button className="btn sm" onClick={() => { setIsNew(false); setEdit(g); }}>Sửa / cập nhật</button></div>}
              </article>
            );
          })}
        </div>
      )}
      {edit && <GoalDialog goal={edit} isNew={isNew} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function GoalDialog({ goal, isNew, onClose, onSave }: { goal: Goal; isNew: boolean; onClose: () => void; onSave: (g: Goal) => Promise<void> }) {
  const { principal } = useAuth();
  const d = useData();
  const toast = useToast();
  const [g, setG] = useState<Goal>(goal);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const units = d.units.filter((u) => !u.archived && hasPerm(principal, 'task.assign', u.id));
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG((x) => ({ ...x, [k]: v }));
  const setKr = (id: string, patch: Partial<KeyResult>) => set('keyResults', g.keyResults.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  const candidates = useMemo(() => d.tasks.filter((t) => !g.taskIds.includes(t.id) && d.unitById(t.unitId) && (q.trim() === '' || fold(`${t.title} ${d.typeById(t.typeId)?.name ?? ''}`).includes(fold(q)))).slice(0, 8), [g.taskIds, q, d]);
  const linked = g.taskIds.map((id) => d.tasks.find((t) => t.id === id)).filter(Boolean);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (g.name.trim() === '') return toast.fail(new AppError('data', 'Tên mục tiêu là bắt buộc.'));
    if (g.keyResults.some((k) => k.text.trim() === '' || !(k.target > 0))) return toast.fail(new AppError('data', 'Mỗi kết quả chính cần nội dung và chỉ tiêu lớn hơn 0.'));
    setBusy(true);
    await onSave(g);
    setBusy(false);
  }

  return (
    <Modal open title={isNew ? 'Tạo mục tiêu' : `Sửa mục tiêu: ${goal.name}`} onClose={onClose} wide>
      <form className="col" onSubmit={submit} noValidate>
        <div className="g2">
          <Field label="Tên mục tiêu *" htmlFor="g-name"><input id="g-name" className="inp" value={g.name} maxLength={120} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="Đơn vị" htmlFor="g-unit"><select id="g-unit" className="inp" value={g.unitId} onChange={(e) => set('unitId', e.target.value)}>{units.map((u) => <option key={u.id} value={u.id}>{u.parentId === null ? 'Toàn Khoa' : u.name}</option>)}</select></Field>
          <Field label="Người phụ trách" htmlFor="g-owner"><select id="g-owner" className="inp" value={g.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{d.users.filter((u) => u.active).map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}</select></Field>
          <Field label="Hạn hoàn thành" htmlFor="g-due"><input id="g-due" type="date" className="inp" value={g.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} /></Field>
          <Field label="Học kỳ" htmlFor="g-term"><select id="g-term" className="inp" value={g.termId ?? ''} onChange={(e) => set('termId', e.target.value || null)}><option value="">— Không gắn —</option>{d.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Trạng thái" htmlFor="g-status"><select id="g-status" className="inp" value={g.status} onChange={(e) => set('status', e.target.value as Goal['status'])}><option value="active">Đang thực hiện</option><option value="done">Đã hoàn thành</option><option value="archived">Lưu trữ (ẩn)</option></select></Field>
        </div>
        <Field label="Mô tả" htmlFor="g-desc"><textarea id="g-desc" className="inp" value={g.description} maxLength={500} onChange={(e) => set('description', e.target.value)} /></Field>

        <fieldset className="remind-who">
          <legend className="lbl">Kết quả chính (tối đa 10)</legend>
          {g.keyResults.map((k) => (
            <div className="kr-row" key={k.id}>
              <input className="inp" aria-label="Nội dung kết quả chính" placeholder="Ví dụ: Số minh chứng đã thu thập" value={k.text} maxLength={120} onChange={(e) => setKr(k.id, { text: e.target.value })} />
              <input className="inp" aria-label="Hiện tại" type="number" min={0} value={k.current} onChange={(e) => setKr(k.id, { current: Math.max(0, Number(e.target.value) || 0) })} />
              <input className="inp" aria-label="Chỉ tiêu" type="number" min={1} value={k.target} onChange={(e) => setKr(k.id, { target: Math.max(0, Number(e.target.value) || 0) })} />
              <input className="inp" aria-label="Đơn vị đo" placeholder="đơn vị" value={k.unit} maxLength={12} onChange={(e) => setKr(k.id, { unit: e.target.value })} />
              <button type="button" className="linkbtn" aria-label={`Xoá kết quả chính ${k.text}`} onClick={() => set('keyResults', g.keyResults.filter((x) => x.id !== k.id))}>✕</button>
            </div>
          ))}
          {g.keyResults.length === 0 && <span className="note">Chưa có kết quả chính: tiến độ sẽ tính theo các việc liên kết.</span>}
          {g.keyResults.length < 10 && <div><button type="button" className="btn sm" onClick={() => set('keyResults', [...g.keyResults, { id: newId(), text: '', target: 1, current: 0, unit: '' }])}>Thêm kết quả chính</button></div>}
        </fieldset>

        <fieldset className="remind-who">
          <legend className="lbl">Việc liên kết ({g.taskIds.length}/200)</legend>
          {linked.map((t) => <div className="row" key={t!.id}><span style={{ flex: 1 }}>{t!.title}</span><button type="button" className="linkbtn" aria-label={`Bỏ liên kết ${t!.title}`} onClick={() => set('taskIds', g.taskIds.filter((x) => x !== t!.id))}>Bỏ</button></div>)}
          {g.taskIds.length > linked.length && <span className="note">{g.taskIds.length - linked.length} việc liên kết nằm ngoài phạm vi bạn xem (vẫn được giữ).</span>}
          <input className="inp" aria-label="Tìm việc để liên kết" placeholder="Tìm việc để liên kết…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() !== '' && candidates.map((t) => <button type="button" className="fr" key={t.id} onClick={() => { set('taskIds', [...g.taskIds, t.id].slice(0, 200)); setQ(''); }}>{t.title}<span className="note">{d.typeById(t.typeId)?.name}</span></button>)}
        </fieldset>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn pri" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu mục tiêu'}</button>
        </div>
      </form>
    </Modal>
  );
}
