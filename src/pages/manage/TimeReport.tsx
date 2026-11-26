import { useMemo } from 'react';
import { PageHead, ErrorBox } from '../../components/ui';
import { useTaskView } from '../../components/taskBits';
import { useScope } from './ManagerShell';
import { useData } from '../../state/data';
import { entriesInPeriod, formatMinutes, groupMinutes, sumMinutes, toHours } from '../../domain/time';
import { vnDate } from '../../domain/dates';

function csvCell(v: string | number): string {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // chống chèn công thức khi mở bằng Excel
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Giờ công theo người và theo loại việc trong kỳ/đơn vị đang chọn; xuất CSV. */
export function TimeReportPage() {
  const v = useTaskView();
  const s = useScope();
  const d = useData();
  const entries = useMemo(() => entriesInPeriod(d.timeEntries.filter((e) => s.unitIds.has(e.unitId)), s.period), [d.timeEntries, s.unitIds, s.period]);
  const taskById = useMemo(() => new Map(v.tasks.map((t) => [t.id, t])), [v.tasks]);
  const byUser = useMemo(() => [...groupMinutes(entries, (e) => e.userId)].sort((a, b) => b[1] - a[1]), [entries]);
  const byType = useMemo(() => [...groupMinutes(entries, (e) => taskById.get(e.taskId)?.typeId ?? '')].map(([k, m]) => [v.typeById(k)?.name ?? 'Khác', m] as const).sort((a, b) => b[1] - a[1]), [entries, taskById, v]);
  const topTasks = useMemo(() => [...groupMinutes(entries, (e) => e.taskId)].sort((a, b) => b[1] - a[1]).slice(0, 8), [entries]);
  const total = sumMinutes(entries);
  const max = Math.max(1, ...byUser.map(([, m]) => m));

  function exportCsv() {
    const head = ['Ngày', 'Thành viên', 'Việc', 'Loại việc', 'Phút', 'Giờ', 'Ghi chú', 'Nguồn'];
    const rows = [...entries].sort((a, b) => a.day.localeCompare(b.day)).map((e) => {
      const t = taskById.get(e.taskId);
      return [vnDate(e.day), v.userName(e.userId), t?.title ?? '(không xem được việc)', v.typeById(t?.typeId ?? '')?.name ?? '', e.minutes, toHours(e.minutes), e.note, e.source === 'timer' ? 'Bấm giờ' : 'Nhập tay'];
    });
    const csv = `\uFEFF${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `gio-cong_${v.today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="screen">
      <PageHead title="Giờ công" sub={`${s.periodLabel} · ${s.unit?.parentId === null ? 'Toàn Khoa' : s.unit?.name}`} actions={<button className="btn" disabled={entries.length === 0} onClick={exportCsv}>Xuất Excel (CSV)</button>} />
      <ErrorBox errors={v.errors} />
      <div className="g4">
        <div className="card stat"><span>Tổng thời gian</span><b>{formatMinutes(total)}</b><small className="note">{entries.length} bản ghi</small></div>
        <div className="card stat"><span>Số người ghi giờ</span><b>{byUser.length}</b><small className="note">trong kỳ</small></div>
        <div className="card stat"><span>Trung bình mỗi người</span><b>{byUser.length ? formatMinutes(Math.round(total / byUser.length)) : '—'}</b><small className="note">trong kỳ</small></div>
        <div className="card stat"><span>Số việc có giờ công</span><b>{new Set(entries.map((e) => e.taskId)).size}</b><small className="note">việc khác nhau</small></div>
      </div>
      <div className="g21">
        <div className="card">
          <h3>Theo thành viên</h3>
          {byUser.length === 0 ? <div className="empty">Chưa có giờ công trong kỳ này. Thành viên bấm giờ ở trang chi tiết việc.</div> : (
            <div className="ub">
              {byUser.map(([u, m]) => (
                <div className="u-row" style={{ gridTemplateColumns: '150px 1fr 110px' }} key={u}>
                  <span>{v.userName(u)}</span>
                  <div className="bar" role="img" aria-label={`${v.userName(u)}: ${formatMinutes(m)}`}><i style={{ width: `${(m / max) * 100}%` }} /></div>
                  <b>{formatMinutes(m)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="col">
          <div className="card">
            <h3>Theo loại việc</h3>
            {byType.length === 0 ? <div className="empty">—</div> : <div className="list">{byType.map(([n, m]) => <div className="li" key={n}><span style={{ flex: 1 }}>{n}</span><strong>{formatMinutes(m)}</strong></div>)}</div>}
          </div>
          <div className="card">
            <h3>Việc tốn thời gian nhất</h3>
            {topTasks.length === 0 ? <div className="empty">—</div> : <div className="list">{topTasks.map(([id, m]) => <div className="li" key={id}><span style={{ flex: 1, minWidth: 0 }}>{taskById.get(id)?.title ?? '(không xem được)'}</span><strong>{formatMinutes(m)}</strong></div>)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
