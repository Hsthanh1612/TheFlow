import { useMemo, useState } from 'react';
import { PageHead } from '../../components/ui';
import { useTaskView } from '../../components/taskBits';
import { useScope } from './ManagerShell';
import { buildReport, REPORT_DEFINITIONS, toCsv } from '../../domain/reports';
import { vnDate } from '../../domain/dates';

export function ReportsPage() {
  const v = useTaskView();
  const s = useScope();
  const [id, setId] = useState(REPORT_DEFINITIONS[0].id);
  const def = REPORT_DEFINITIONS.find((d) => d.id === id)!;
  const rows = useMemo(() => buildReport(def, { tasks: s.tasks, units: v.units, users: v.users, types: v.taskTypes, wfOf: v.wfOfTask, settings: v.settings, today: v.today, scopeUnitId: s.unitId, progressOf: v.progress }), [def, s, v]);
  const scopeName = s.unit?.parentId === null ? 'Toàn Khoa' : s.unit?.name;

  function exportCsv() {
    const blob = new Blob([toCsv(def, rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${def.id}_${v.today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="screen">
      <PageHead title="Báo cáo & xuất file" sub="Chọn mẫu báo cáo, xem trước rồi xuất file để gửi lên trên."
        actions={<><button className="btn" onClick={exportCsv} disabled={rows.length === 0}>Xuất Excel (CSV)</button><button className="btn pri" onClick={() => window.print()} disabled={rows.length === 0}>Xuất PDF (In → Lưu PDF)</button></>} />
      <div className="g12">
        <div className="col">
          <div className="card">
            <h3>Mẫu báo cáo</h3>
            <div className="tpl" role="radiogroup" aria-label="Mẫu báo cáo">
              {REPORT_DEFINITIONS.map((d) => (
                <button key={d.id} role="radio" aria-checked={d.id === id} className={`fr${d.id === id ? ' on' : ''}`} onClick={() => setId(d.id)}><span><strong>{d.name}</strong><br /><span className="note">{d.description}</span></span></button>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Gửi tự động hằng tháng</h3>
            <div className="alert warn">Chưa được hỗ trợ: gửi email theo lịch cần máy chủ chạy nền (Cloud Functions/Cloud Run) và gói trả phí. Dự án chỉ dùng gói Spark nên tính năng này bị chặn — hãy xuất file và gửi thủ công.</div>
          </div>
        </div>
        <div className="card preview" id="report-preview">
          <h3 style={{ display: 'block' }}>{def.name}<div className="note" style={{ fontWeight: 400 }}>{scopeName} · {s.periodLabel} ({vnDate(s.period.start)} – {vnDate(s.period.end)}) · xuất ngày {vnDate(v.today)}</div></h3>
          {rows.length === 0 ? <div className="empty">Không có dữ liệu trong phạm vi này.</div> : (
            <table className="tbl">
              <thead><tr>{def.columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}>{def.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
      <style>{`@media print{.side,.top,.scope,.hd .tr,.g12>.col{display:none!important}.g12{display:block}.content{padding:0}}`}</style>
    </div>
  );
}
