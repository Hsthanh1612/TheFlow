import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, Avatars, Field, Loading, Modal, PageHead, ProgressBar } from '../components/ui';
import { FieldInput } from '../components/TaskForm';
import { ExtendDialog, NoteDialog, ReassignDialog } from '../components/dialogs';
import { TaskStatus, TypeTag, useTaskView } from '../components/taskBits';
import { SaveHint, useAutosave } from '../state/useAutosave';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { addComment, extendTask, fetchTask, reassignTask, setChecklist, setLinks, transitionTask, updateTaskFields } from '../services/firebase/taskRepo';
import { AppError } from '../services/errors';
import { subscribeComments } from '../services/firebase/subscriptions';
import { newId } from '../services/firebase/ids';
import { allowedTargets } from '../domain/workflow';
import { hasPerm } from '../domain/permissions';
import { validateCustomFields, preserveArchived } from '../domain/fields';
import { vnDate } from '../domain/dates';
import type { CustomValue, Priority, Task, WorkflowState } from '../domain/types';

const PRIO: Record<Priority, string> = { low: 'Thấp', normal: 'Bình thường', high: 'Cao' };
type Comment = { id: string; authorId: string; body: string; mentions: string[]; createdAt: string };

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const v = useTaskView();
  const inStore = v.tasks.find((t) => t.id === id);
  const [fetched, setFetched] = useState<Task | null | undefined>(undefined);
  useEffect(() => {
    setFetched(undefined);
    if (!inStore && v.ready) fetchTask(id).then(setFetched).catch(() => setFetched(null));
  }, [id, inStore, v.ready]);
  const task = inStore ?? fetched ?? undefined;
  if (!v.ready || (!inStore && fetched === undefined)) return <Loading />;
  if (!task) return <div className="card"><div className="empty">Không tìm thấy việc này, hoặc bạn không có quyền xem.<div><Link to="/tasks/kanban">Về bảng công việc</Link></div></div></div>;
  return <Detail key={task.id} task={task} live={!!inStore} />;
}

function Detail({ task, live }: { task: Task; live: boolean }) {
  const v = useTaskView();
  const { profile, principal } = useAuth();
  const toast = useToast();
  const type = v.typeById(task.typeId);
  const wf = v.wfOfTask(task);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cErr, setCErr] = useState('');
  const [text, setText] = useState('');
  const [newItem, setNewItem] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [note, setNote] = useState<WorkflowState | null>(null);
  const [extend, setExtend] = useState(false);
  const [reassign, setReassign] = useState(false);
  const [edit, setEdit] = useState(false);

  useEffect(() => subscribeComments(task.id, setComments, (e) => setCErr(e.message)), [task.id]);

  const uid = profile!.uid;
  const isDoer = task.assigneeIds.includes(uid) || task.collaboratorIds.includes(uid);
  const canAssign = hasPerm(principal, 'task.assign', task.unitId);
  const canEditContent = isDoer || canAssign;
  const canExtend = hasPerm(principal, 'task.extend', task.unitId);
  const canReassign = hasPerm(principal, 'task.reassign', task.unitId);
  const targets = wf ? allowedTargets(wf, task, principal) : [];
  const cat = v.categoryOfTask(task);
  const pct = v.progress(task);

  const desc = useAutosave(task.description, (d) => updateTaskFields(task.id, { description: d }), canEditContent);
  const defs = (type?.fields ?? []).filter((f) => !f.archived).sort((a, b) => a.order - b.order);
  const cf = useAutosave<Record<string, CustomValue>>(task.customFields, async (vals) => {
    const errs = validateCustomFields(defs, vals);
    if (Object.keys(errs).length > 0) throw new AppError('data', Object.values(errs)[0]);
    await updateTaskFields(task.id, { customFields: preserveArchived(type?.fields ?? [], task.customFields, vals) });
  }, canEditContent, 1000);
  const cfErrors = useMemo(() => validateCustomFields(defs, cf.value), [defs, cf.value]);

  const activity = Object.entries(task.activity).map(([k, a]) => ({ k, ...a })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function go(s: WorkflowState, noteText: string) {
    if (!wf || !profile) return false;
    const r = await toast.run(() => transitionTask({ task, workflow: wf, to: s.key, note: noteText, actor: profile, principal }), `Đã chuyển sang “${s.label}”.`);
    return r.ok;
  }

  async function submitComment() {
    if (!profile || !text.trim()) return;
    const mentions = v.users.filter((u) => u.uid !== uid && text.toLowerCase().includes(`@${u.name.toLowerCase()}`)).map((u) => u.uid);
    const r = await toast.run(() => addComment(task, text, mentions, profile), 'Đã gửi bình luận.');
    if (r.ok) setText('');
  }

  const doneCount = task.checklist.filter((i) => i.done).length;

  return (
    <div className="screen">
      {!live && <div className="alert warn" role="status">Đang xem bản chụp (không cập nhật trực tiếp).</div>}
      <PageHead
        title={<>{task.title} <TaskStatus t={task} /></>}
        sub={<><Link to="/tasks/kanban">Bảng công việc</Link> / {type?.name ?? '—'}</>}
        actions={<>
          {canAssign && <button className="btn" onClick={() => setEdit(true)}>Sửa thông tin</button>}
          {canExtend && cat !== 'done' && <button className="btn" onClick={() => setExtend(true)}>Gia hạn</button>}
          {canReassign && cat !== 'done' && <button className="btn" onClick={() => setReassign(true)}>Đổi người</button>}
          {targets.map((t, i) => (
            <button key={t.state.key} className={`btn${i === 0 && t.state.category !== 'todo' ? ' pri' : ''}`} onClick={() => (t.requiresComment ? setNote(t.state) : void go(t.state, ''))}>
              {t.state.category === 'review' ? 'Nộp để duyệt' : t.state.category === 'done' ? 'Duyệt / Hoàn thành' : t.requiresComment ? `Trả lại (${t.state.label})` : `Chuyển: ${t.state.label}`}
            </button>
          ))}
        </>}
      />
      <div className="g12">
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <h3>Mô tả <SaveHint state={desc.state} error={desc.error} /></h3>
            {canEditContent ? <textarea className="inp" aria-label="Mô tả" value={desc.value} onChange={(e) => desc.change(e.target.value)} onBlur={() => void desc.flush()} maxLength={5000} style={{ height: 110 }} /> : <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{task.description || 'Chưa có mô tả.'}</p>}
          </div>
          <div className="card">
            <h3>Checklist <span className="note">{doneCount}/{task.checklist.length} hoàn thành</span></h3>
            {task.checklist.length > 0 && <div style={{ marginBottom: 8 }}><ProgressBar pct={pct} /></div>}
            {task.checklist.map((i) => (
              <div className="ck" key={i.id}>
                <label>
                  <input type="checkbox" checked={i.done} disabled={!canEditContent} onChange={() => void toast.run(() => setChecklist(task.id, task.checklist.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x))), i.done ? 'Đã bỏ đánh dấu.' : 'Đã hoàn thành mục.')} />
                  <span className={i.done ? 'done-t' : ''}>{i.text}</span>
                </label>
                {canEditContent && <button className="linkbtn" aria-label={`Xoá mục ${i.text}`} onClick={() => void toast.run(() => setChecklist(task.id, task.checklist.filter((x) => x.id !== i.id)), 'Đã xoá mục.')}>✕</button>}
              </div>
            ))}
            {task.checklist.length === 0 && <div className="note">Chưa có mục nào.</div>}
            {canEditContent && (
              <form className="row" style={{ marginTop: 8 }} onSubmit={async (e) => { e.preventDefault(); if (!newItem.trim()) return; const r = await toast.run(() => setChecklist(task.id, [...task.checklist, { id: newId(), text: newItem.trim().slice(0, 200), done: false }]), 'Đã thêm mục.'); if (r.ok) setNewItem(''); }}>
                <input className="inp" style={{ flex: 1 }} aria-label="Mục checklist mới" placeholder="Thêm mục…" value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={200} />
                <button className="btn sm" type="submit">Thêm mục</button>
              </form>
            )}
          </div>
          <div className="card">
            <h3>Tệp đính kèm (liên kết)</h3>
            <div className="col" style={{ gap: 8 }}>
              {task.links.length === 0 && <div className="note">Chưa có liên kết. Hệ thống không lưu tệp (Firebase Storage cần gói trả phí) — dán liên kết Drive/OneDrive.</div>}
              {task.links.map((l, i) => (
                <div className="fr" key={i}>
                  <a href={/^https?:\/\//i.test(l.url) ? l.url : undefined} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>{l.name}</a>
                  {canEditContent && <button className="linkbtn" aria-label={`Xoá liên kết ${l.name}`} onClick={() => void toast.run(() => setLinks(task.id, task.links.filter((_, j) => j !== i)), 'Đã xoá liên kết.')}>✕</button>}
                </div>
              ))}
              {canEditContent && (
                <form className="row" onSubmit={async (e) => { e.preventDefault(); const r = await toast.run(() => setLinks(task.id, [...task.links, { name: linkName.trim() || linkUrl.trim(), url: linkUrl.trim() }]), 'Đã thêm liên kết.'); if (r.ok) { setLinkName(''); setLinkUrl(''); } }}>
                  <input className="inp" style={{ flex: 1, minWidth: 120 }} aria-label="Tên liên kết" placeholder="Tên tệp" value={linkName} onChange={(e) => setLinkName(e.target.value)} maxLength={100} />
                  <input className="inp" style={{ flex: 2, minWidth: 160 }} aria-label="Địa chỉ liên kết" type="url" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required />
                  <button className="btn sm" type="submit">Thêm</button>
                </form>
              )}
            </div>
          </div>
          <div className="card">
            <h3>Bình luận</h3>
            {cErr && <div className="alert err" role="alert">{cErr}</div>}
            <div className="list">
              {comments.length === 0 && <div className="note">Chưa có bình luận.</div>}
              {comments.map((c) => (
                <div className="li" key={c.id}><Avatar name={v.userName(c.authorId)} label={false} /><div><strong style={{ fontWeight: 600 }}>{v.userName(c.authorId)}</strong> <span className="note">· {vnDate(c.createdAt.slice(0, 10))} {c.createdAt.slice(11, 16)}</span><div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div></div></div>
              ))}
            </div>
            <div className="fld" style={{ marginTop: 12 }}>
              <label htmlFor="cmt">Viết bình luận</label>
              <textarea id="cmt" className="inp" placeholder="Nhập nội dung, dùng @Tên để nhắc người khác" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
              <div className="row"><button className="btn sm pri" disabled={!text.trim()} onClick={() => void submitComment()}>Gửi</button>
                <select className="sel" aria-label="Chèn @ nhắc người" value="" onChange={(e) => { if (e.target.value) setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}@${v.userName(e.target.value)} `); }}>
                  <option value="">@ Nhắc người…</option>{task.participantIds.filter((p) => p !== uid).map((p) => <option key={p} value={p}>{v.userName(p)}</option>)}
                </select></div>
            </div>
          </div>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <h3>Thuộc tính</h3>
            <dl className="pp">
              <div className="pr"><dt>Trạng thái</dt><dd><TaskStatus t={task} /></dd></div>
              <div className="pr"><dt>Người phụ trách</dt><dd><Avatars names={task.assigneeIds.map(v.userName)} /> {task.assigneeIds.map(v.userName).join(', ')}</dd></div>
              <div className="pr"><dt>Phối hợp</dt><dd>{task.collaboratorIds.length ? <><Avatars names={task.collaboratorIds.map(v.userName)} /> {task.collaboratorIds.map(v.userName).join(', ')}</> : '—'}</dd></div>
              <div className="pr"><dt>Người duyệt</dt><dd>{task.reviewerIds.length ? task.reviewerIds.map(v.userName).join(', ') : '—'}</dd></div>
              <div className="pr"><dt>Hạn chót</dt><dd>{vnDate(task.dueAt)}</dd></div>
              <div className="pr"><dt>Ưu tiên</dt><dd>{PRIO[task.priority]}</dd></div>
              <div className="pr"><dt>Nhãn</dt><dd>{task.labels.length ? task.labels.map((l) => <span key={l} className="tg">{l}</span>) : '—'}</dd></div>
              <div className="pr"><dt>Loại việc</dt><dd><TypeTag typeId={task.typeId} /></dd></div>
              <div className="pr"><dt>Đơn vị</dt><dd>{v.unitById(task.unitId)?.name ?? '—'}</dd></div>
              <div className="pr"><dt>Tạo bởi</dt><dd>{v.userName(task.createdBy)}</dd></div>
            </dl>
          </div>
          {defs.length > 0 && (
            <div className="card">
              <h3>Trường theo loại việc “{type?.name}” <SaveHint state={cf.state} error={cf.error} /></h3>
              {canEditContent ? (
                <div className="col">{defs.map((f) => <FieldInput key={f.key} def={f} value={cf.value[f.key]} onChange={(val) => cf.change({ ...cf.value, [f.key]: val })} error={cfErrors[f.key]} idPrefix="cf" />)}</div>
              ) : (
                <dl className="pp">{defs.map((f) => <div className="pr" key={f.key}><dt>{f.label}</dt><dd>{String(task.customFields[f.key] ?? '—')}</dd></div>)}</dl>
              )}
              <p className="note">Các trường này do cấu hình loại việc quyết định.</p>
            </div>
          )}
          {wf && (
            <div className="card">
              <h3>Quy trình duyệt</h3>
              <div className="steps" role="list">{wf.states.map((s) => <span key={s.key} role="listitem" className={`stp${s.key === task.stateKey ? ' on' : ''}`} aria-current={s.key === task.stateKey ? 'step' : undefined}>{s.label}</span>)}</div>
              {task.statusNote && <p className="note" style={{ marginTop: 10 }}>Ý kiến gần nhất: “{task.statusNote}”</p>}
            </div>
          )}
          <div className="card">
            <h3>Lịch sử hoạt động</h3>
            {activity.length === 0 ? <div className="note">Chưa có hoạt động.</div> : (
              <div className="list">{activity.slice(0, 30).map((a) => <div className="li" key={a.k}><div>{a.detail || a.action}<small>{v.userName(a.actorId)} · {vnDate(a.createdAt.slice(0, 10))} {a.createdAt.slice(11, 16)}</small></div></div>)}</div>
            )}
          </div>
        </div>
      </div>
      <NoteDialog open={note !== null} title={note ? `Chuyển sang “${note.label}”` : ''} label="Ý kiến (bắt buộc)" required confirmText="Xác nhận" onClose={() => setNote(null)} onSubmit={async (n) => { if (note && (await go(note, n))) setNote(null); }} />
      <ExtendDialog task={extend ? task : null} onClose={() => setExtend(false)} onSubmit={async (due, reason) => { if (!profile) return; const r = await toast.run(() => extendTask(task, due, reason, profile), 'Đã gia hạn.'); if (r.ok) setExtend(false); }} />
      <ReassignDialog task={reassign ? task : null} onClose={() => setReassign(false)} onSubmit={async (who, keep) => { if (!profile) return; const r = await toast.run(() => reassignTask(task, who, keep, profile, v.userName), 'Đã đổi người phụ trách.'); if (r.ok) setReassign(false); }} />
      <EditDialog task={edit ? task : null} onClose={() => setEdit(false)} />
    </div>
  );
}

function EditDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [labels, setLabels] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (task) { setTitle(task.title); setPriority(task.priority); setLabels(task.labels.join(', ')); } }, [task]);
  return (
    <Modal open={task !== null} title="Sửa thông tin việc" onClose={onClose}>
      <form className="col" onSubmit={async (e) => {
        e.preventDefault();
        if (!task || busy || !title.trim()) return;
        setBusy(true);
        const r = await toast.run(() => updateTaskFields(task.id, { title: title.trim().slice(0, 200), priority, labels: labels.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10) }), 'Đã lưu.');
        setBusy(false);
        if (r.ok) onClose();
      }}>
        <Field label="Tiêu đề" htmlFor="ed-title"><input id="ed-title" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></Field>
        <div className="g2">
          <Field label="Ưu tiên" htmlFor="ed-prio"><select id="ed-prio" className="inp" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{(Object.keys(PRIO) as Priority[]).map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}</select></Field>
          <Field label="Nhãn (cách nhau bằng dấu phẩy)" htmlFor="ed-labels"><input id="ed-labels" className="inp" value={labels} onChange={(e) => setLabels(e.target.value)} /></Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Huỷ</button><button type="submit" className="btn pri" disabled={busy}>Lưu</button></div>
      </form>
    </Modal>
  );
}
