import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead, ErrorBox } from '../../components/ui';
import { useTaskView } from '../../components/taskBits';
import { useScope } from './ManagerShell';
import { useData } from '../../state/data';
import { DEFAULT_CAPACITY, loadLevel, workloadRows, type LoadLevel } from '../../domain/workload';
import { entriesInPeriod, formatMinutes, sumMinutes } from '../../domain/time';
import { addDays, vnDayMonth } from '../../domain/dates';
import { weekStart } from '../../domain/dates';

const LEVEL_TEXT: Record<LoadLevel, string> = { free: 'Trống', ok: 'Vừa sức', high: 'Gần đầy', over: 'Quá tải' };

/** Khối lượng công việc theo người: ai đang gánh bao nhiêu trong 4 tuần tới, để phân việc cân bằng. */
export function WorkloadPage() {
  const v = useTaskView();
  const s = useScope();
  const d = useData();
  const [cap, setCap] = useState(DEFAULT_CAPACITY);
  const people = useMemo(() => v.users.filter((u) => u.active && u.unitId && s.unitIds.has(u.unitId)), [v.users, s.unitIds]);
  const rows = useMemo(() => workloadRows(v.tasks, people.map((p) => p.uid), v.wfOfTask, v.today, 4).sort((a, b) => b.points - a.points || b.open - a.open), [v.tasks, people, v.wfOfTask, v.today]);
  const w0 = weekStart(v.today);
  const thisWeek = { start: w0, end: addDays(w0, 6) };
  const hours = useMemo(() => new Map(people.map((p) => [p.uid, sumMinutes(entriesInPeriod(d.timeEntries.filter((e) => e.userId === p.uid), thisWeek))])), [people, d.timeEntries, w0]); // eslint-disable-line react-hooks/exhaustive-deps
  const over = rows.filter((r) => r.weeks.some((w) => loadLevel(w.points, cap) === 'over'));

  return (
    <div className="screen">
      <PageHead title="Khối lượng công việc" sub="Mỗi việc đang mở tính vào tuần đến hạn của người phụ trách; việc quá hạn dồn vào tuần này. Ưu tiên cao = 3 điểm, bình thường = 2, thấp = 1." />
      <ErrorBox errors={v.errors} />
      <div className="row">
        <label className="row" style={{ gap: 8 }}>Mức đầy tải (điểm/tuần)
          <input type="number" className="inp" style={{ width: 80 }} min={1} max={50} value={cap} onChange={(e) => setCap(Math.max(1, Math.min(50, Number(e.target.value) || DEFAULT_CAPACITY)))} />
        </label>
        <span className="legend" aria-label="Chú giải">
          {(['ok', 'high', 'over'] as const).map((l) => <span key={l}><i className={`sw wl-${l}`} /> {LEVEL_TEXT[l]}</span>)}
        </span>
        {over.length > 0 && <span className="b late">{over.length} người có tuần quá tải</span>}
      </div>
      <div className="card">
        {rows.length === 0 ? <div className="empty">Đơn vị này chưa có thành viên được kích hoạt.</div> : (
          <div className="scroll">
            <table className="tbl wl-table">
              <thead>
                <tr>
                  <th scope="col">Thành viên</th><th scope="col">Đang mở</th><th scope="col">Quá hạn</th><th scope="col">Chưa có hạn</th>
                  {rows[0].weeks.map((w, i) => <th scope="col" key={w.week}>{i === 0 ? 'Tuần này' : `Tuần ${vnDayMonth(w.week)}`}</th>)}
                  <th scope="col">Giờ tuần này</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId}>
                    <th scope="row" className="wl-name">{v.userName(r.userId)}<small className="note">{v.unitById(v.userById(r.userId)?.unitId)?.name}</small></th>
                    <td>{r.open}</td>
                    <td style={{ color: r.overdue ? 'var(--danger)' : undefined, fontWeight: r.overdue ? 700 : undefined }}>{r.overdue}</td>
                    <td>{r.undated}</td>
                    {r.weeks.map((w) => {
                      const lv = loadLevel(w.points, cap);
                      return <td key={w.week}><span className={`wl-cell wl-${lv}`} title={`${w.tasks} việc, ${w.points} điểm — ${LEVEL_TEXT[lv]}`} aria-label={`${w.tasks} việc, ${w.points} điểm, ${LEVEL_TEXT[lv]}`}>{w.points > 0 ? `${w.points}đ` : '–'}{w.tasks > 0 && <small>{w.tasks} việc</small>}</span></td>;
                    })}
                    <td>{formatMinutes(hours.get(r.userId) ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="note">Muốn cân lại tải: mở việc của người quá tải rồi dùng “Đổi người” trong <Link to="/manage/risks">Cảnh báo quá hạn</Link> hoặc trang chi tiết việc. Số giờ lấy từ mục “Thời gian thực hiện” của từng việc.</p>
    </div>
  );
}
