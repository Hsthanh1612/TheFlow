import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead, ErrorBox, ProgressBar } from '../../components/ui';
import { useTaskView } from '../../components/taskBits';
import { ExtendDialog, ReassignDialog } from '../../components/dialogs';
import { useScope } from './ManagerShell';
import { useAuth } from '../../state/auth';
import { useToast } from '../../state/toast';
import { extendTask, reassignTask, remind } from '../../services/firebase/taskRepo';
import { riskList } from '../../domain/stats';
import { hasPerm } from '../../domain/permissions';
import { diffDays, vnDayMonth } from '../../domain/dates';
import type { Task } from '../../domain/types';

export function RisksPage() {
  const v = useTaskView();
  const s = useScope();
  const { profile, principal } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'overdue' | 'at_risk'>('all');
  const [ext, setExt] = useState<Task | null>(null);
  const [re, setRe] = useState<Task | null>(null);
  const all = useMemo(() => riskList(s.tasks, v.wfOfTask, v.settings, v.today), [s.tasks, v, ]);
  const rows = all.filter((r) => filter === 'all' || r.kind === filter);
  const text = (t: Task) => `Nhắc: “${t.title}” ${t.dueAt && diffDays(t.dueAt, v.today) < 0 ? 'đã quá hạn' : `sắp đến hạn (${vnDayMonth(t.dueAt)})`}`;

  return (
    <div className="screen">
      <PageHead title="Rủi ro & quá hạn" sub={`Việc đã quá hạn, hoặc còn ≤${v.settings.riskDays} ngày mà tiến độ dưới ${v.settings.riskProgress}% (ngưỡng đặt ở Cấu hình).`}
        actions={<button className="btn" disabled={rows.length === 0 || !profile} onClick={() => profile && void toast.run(() => remind(rows.map((r) => r.task), profile, text), `Đã gửi nhắc tới ${new Set(rows.flatMap((r) => r.task.assigneeIds)).size} người.`)}>Nhắc tất cả</button>} />
      <ErrorBox errors={v.errors} />
      <div className="chips" role="group" aria-label="Lọc rủi ro">
        {([['all', `Tất cả (${all.length})`], ['overdue', `Quá hạn (${all.filter((r) => r.kind === 'overdue').length})`], ['at_risk', `Có nguy cơ (${all.filter((r) => r.kind === 'at_risk').length})`]] as const).map(([k, l]) => (
          <button key={k} className={`btn sm${filter === k ? ' pri' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="card">
        {rows.length === 0 ? <div className="empty">Không có việc rủi ro trong phạm vi này.</div> : (
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th scope="col">Công việc</th><th scope="col">Đơn vị</th><th scope="col">Phụ trách</th><th scope="col">Hạn</th><th scope="col">Tiến độ</th><th scope="col">Tình trạng</th><th scope="col">Thao tác</th></tr></thead>
              <tbody>
                {rows.map(({ task: t, kind }) => (
                  <tr key={t.id}>
                    <td><Link className="tl" to={`/task/${t.id}`}>{t.title}</Link></td>
                    <td>{v.unitById(t.unitId)?.name}</td>
                    <td>{t.assigneeIds.map(v.userName).join(', ')}</td>
                    <td className="nw" style={{ color: kind === 'overdue' ? 'var(--danger)' : undefined }}>{vnDayMonth(t.dueAt)}</td>
                    <td style={{ minWidth: 110 }}><ProgressBar pct={v.progress(t)} /></td>
                    <td><span className={`b ${kind === 'overdue' ? 'late' : 'rev'}`}>{kind === 'overdue' ? `Quá hạn ${-diffDays(t.dueAt!, v.today)} ngày` : 'Có nguy cơ'}</span></td>
                    <td><div className="row" style={{ gap: 6 }}>
                      <button className="btn sm" onClick={() => profile && void toast.run(() => remind([t], profile, text), 'Đã gửi nhắc.')}>Nhắc</button>
                      {hasPerm(principal, 'task.reassign', t.unitId) && <button className="btn sm" onClick={() => setRe(t)}>Đổi người</button>}
                      {hasPerm(principal, 'task.extend', t.unitId) && <button className="btn sm" onClick={() => setExt(t)}>Gia hạn</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="note">“Nhắc” gửi thông báo trong ứng dụng. Gửi email cần máy chủ có tính phí nên chưa được hỗ trợ (xem docs/REQUIREMENTS.md).</p>
      <ExtendDialog task={ext} onClose={() => setExt(null)} onSubmit={async (due, reason) => { if (!ext || !profile) return; const r = await toast.run(() => extendTask(ext, due, reason, profile), 'Đã gia hạn và ghi lý do vào lịch sử.'); if (r.ok) setExt(null); }} />
      <ReassignDialog task={re} onClose={() => setRe(null)} onSubmit={async (who, keep) => { if (!re || !profile) return; const r = await toast.run(() => reassignTask(re, who, keep, profile, v.userName), 'Đã đổi người phụ trách.'); if (r.ok) setRe(null); }} />
    </div>
  );
}
