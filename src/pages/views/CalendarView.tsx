import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTaskView } from '../../components/taskBits';
import { monthGrid, shiftMonth } from '../../domain/calendar';
import { holidayOn } from '../../domain/holidays';
import { addDays, diffDays, vnDate, weekStart } from '../../domain/dates';
import { sortByDue } from '../../domain/filters';
import type { Task } from '../../domain/types';

const HEAD = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const v = useTaskView();
  const [ym, setYm] = useState(() => ({ year: Number(v.today.slice(0, 4)), month: Number(v.today.slice(5, 7)) }));
  const cells = monthGrid(ym.year, ym.month);
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) if (t.dueAt) byDay.set(t.dueAt, [...(byDay.get(t.dueAt) ?? []), t]);
  const ws = weekStart(v.today);
  const thisWeek = sortByDue(tasks.filter((t) => t.dueAt && diffDays(t.dueAt, ws) >= 0 && diffDays(t.dueAt, addDays(ws, 6)) <= 0));
  const label = (t: Task) => (v.categoryOfTask(t) === 'done' ? t.title : `Hạn: ${t.title}`);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="h1" style={{ fontSize: 17 }}>Tháng {ym.month}/{ym.year}</h2>
        <div className="row">
          <button className="btn sm" onClick={() => setYm(shiftMonth(ym.year, ym.month, -1))} aria-label="Tháng trước">‹</button>
          <button className="btn sm" onClick={() => setYm({ year: Number(v.today.slice(0, 4)), month: Number(v.today.slice(5, 7)) })}>Hôm nay</button>
          <button className="btn sm" onClick={() => setYm(shiftMonth(ym.year, ym.month, 1))} aria-label="Tháng sau">›</button>
        </div>
      </div>
      <div className="g12">
        <div className="cal" role="group" aria-label={`Lịch tháng ${ym.month}/${ym.year}`}>
          {HEAD.map((h) => <div className="cw" key={h}>{h}</div>)}
          {cells.map((c) => {
            const items = byDay.get(c.day) ?? [];
            const hol = holidayOn(c.day);
            return (
              <div key={c.day} className={`cd${c.inMonth ? '' : ' o'}${c.day === v.today ? ' t' : ''}`}>
                <span className="n" aria-label={vnDate(c.day)}>{Number(c.day.slice(8))}</span>
                {hol && <div className="ev hol">{hol}</div>}
                {items.slice(0, 3).map((t) => <Link key={t.id} to={`/task/${t.id}`} className={`ev b ${v.status(t) === 'review' ? 'rev' : v.status(t)}`} title={t.title}>{label(t)}</Link>)}
                {items.length > 3 && <span className="note">+{items.length - 3} việc</span>}
              </div>
            );
          })}
        </div>
        <div className="col">
          <div className="card">
            <h3>Chú giải</h3>
            <div className="col" style={{ gap: 8 }}>
              <span className="b todo">Chờ làm</span><span className="b doing">Đang làm</span><span className="b rev">Chờ duyệt</span><span className="b done">Hoàn thành</span><span className="b late">Quá hạn</span><span className="b hol">Ngày lễ / sự kiện</span>
            </div>
          </div>
          <div className="card">
            <h3>Tuần này</h3>
            {thisWeek.length === 0 ? <div className="empty">Không có việc đến hạn trong tuần.</div> : (
              <div className="list">
                {thisWeek.map((t) => {
                  const left = diffDays(t.dueAt!, v.today);
                  return (
                    <div className="li" key={t.id}>
                      <div className="dd"><b>{t.dueAt!.slice(8)}</b><small>T{Number(t.dueAt!.slice(5, 7))}</small></div>
                      <div><Link to={`/task/${t.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{t.title}</Link><small>{left === 0 ? 'Hôm nay' : left < 0 ? `Trễ ${-left} ngày` : `Còn ${left} ngày`}</small></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="note">Ngày lễ theo dương lịch cố định; ngày lễ âm lịch chưa được hỗ trợ.</p>
    </>
  );
}
