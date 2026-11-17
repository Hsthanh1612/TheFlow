import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead, ErrorBox } from '../../components/ui';
import { TypeTag, useTaskView } from '../../components/taskBits';
import { NoteDialog } from '../../components/dialogs';
import { useScope } from './ManagerShell';
import { useAuth } from '../../state/auth';
import { useToast } from '../../state/toast';
import { bulkTransition } from '../../services/firebase/taskRepo';
import { hasPerm } from '../../domain/permissions';
import { vnDate, vnDayMonth } from '../../domain/dates';

export function ApprovalsPage() {
  const v = useTaskView();
  const s = useScope();
  const { profile, principal } = useAuth();
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  const rows = useMemo(
    () => s.tasks.filter((t) => v.categoryOfTask(t) === 'review' && (t.reviewerIds.includes(profile!.uid) || hasPerm(principal, 'task.approve', t.unitId))).sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')),
    [s.tasks, v, profile, principal],
  );
  const chosen = rows.filter((t) => sel.has(t.id));
  const shown = rows.find((t) => t.id === focus) ?? rows[0];
  const toggle = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const items = (list: typeof rows) => list.flatMap((t) => { const wf = v.wfOfTask(t); return wf ? [{ task: t, workflow: wf }] : []; });

  async function approve() {
    if (!profile) return;
    const r = await toast.run(() => bulkTransition(items(chosen), 'approve', '', profile, principal), `Đã duyệt ${chosen.length} việc.`);
    if (r.ok) setSel(new Set());
  }

  return (
    <div className="screen">
      <PageHead title="Hàng đợi duyệt" sub="Việc đã nộp và đang chờ bạn duyệt. Chọn nhiều việc để duyệt hoặc trả lại cùng lúc." />
      <ErrorBox errors={v.errors} />
      {chosen.length > 0 && (
        <div className="bulk" role="region" aria-label="Thao tác hàng loạt">
          <strong>Đã chọn {chosen.length} việc</strong>
          <button className="btn sm pri" onClick={() => void approve()}>Duyệt các việc đã chọn</button>
          <button className="btn sm" onClick={() => setReturning(true)}>Trả lại kèm ý kiến</button>
        </div>
      )}
      <div className="g12">
        <div className="card">
          {rows.length === 0 ? <div className="empty">Không còn việc nào chờ duyệt trong phạm vi này.</div> : (
            <div className="scroll">
              <table className="tbl">
                <thead><tr><th scope="col"><input type="checkbox" aria-label="Chọn tất cả" checked={sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th><th scope="col">Công việc</th><th scope="col">Đơn vị</th><th scope="col">Người nộp</th><th scope="col">Nộp lúc</th><th scope="col">Hạn</th><th scope="col">Bước duyệt</th></tr></thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className={shown?.id === t.id ? 'sel-row' : ''}>
                      <td><input type="checkbox" aria-label={`Chọn ${t.title}`} checked={sel.has(t.id)} onChange={() => toggle(t.id)} /></td>
                      <td><button className="linkbtn" style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 14, textAlign: 'left' }} onClick={() => setFocus(t.id)}>{t.title}</button></td>
                      <td>{v.unitById(t.unitId)?.name}</td>
                      <td>{t.assigneeIds.map(v.userName).join(', ')}</td>
                      <td className="nw">{t.statusNoteAt ? `${vnDayMonth(t.statusNoteAt.slice(0, 10))} ${t.statusNoteAt.slice(11, 16)}` : '—'}</td>
                      <td className="nw">{vnDayMonth(t.dueAt)}</td>
                      <td><span className="b rev">{v.stateLabel(t)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card" aria-live="polite">
          {!shown ? <div className="empty">Chọn một việc để xem nhanh.</div> : (
            <div className="col">
              <h3 style={{ margin: 0 }}>{shown.title}</h3>
              <div className="row"><TypeTag typeId={shown.typeId} /><span className="note">{v.unitById(shown.unitId)?.name} · hạn {vnDate(shown.dueAt)}</span></div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{shown.statusNote || shown.description || 'Chưa có mô tả.'}</p>
              <div><strong>Tệp đính kèm</strong>{shown.links.length === 0 ? <div className="note">Không có.</div> : shown.links.map((l, i) => <div key={i}><a href={/^https?:\/\//i.test(l.url) ? l.url : undefined} target="_blank" rel="noopener noreferrer">{l.name}</a></div>)}</div>
              <div className="steps">{v.wfOfTask(shown)?.states.map((st) => <span key={st.key} className={`stp${st.key === shown.stateKey ? ' on' : ''}`}>{st.label}</span>)}</div>
              <Link className="btn sm" to={`/task/${shown.id}`}>Mở chi tiết</Link>
            </div>
          )}
        </div>
      </div>
      <NoteDialog open={returning} title={`Trả lại ${chosen.length} việc`} label="Ý kiến trả lại (bắt buộc)" required confirmText="Trả lại" onClose={() => setReturning(false)}
        onSubmit={async (note) => { if (!profile) return; const r = await toast.run(() => bulkTransition(items(chosen), 'return', note, profile, principal), `Đã trả lại ${chosen.length} việc.`); if (r.ok) { setSel(new Set()); setReturning(false); } }} />
    </div>
  );
}
