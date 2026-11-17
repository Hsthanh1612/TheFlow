import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ColumnChart, DataTable, Legend, LineChart } from '../../components/charts';
import { PageHead, ErrorBox } from '../../components/ui';
import { useTaskView } from '../../components/taskBits';
import { useScope } from './ManagerShell';
import { breakdown, pct, riskList, weeklySeries } from '../../domain/stats';
import { descendantIds } from '../../domain/permissions';
import { diffDays, vnDate, vnDayMonth, weekStart } from '../../domain/dates';

const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#7b5cd6', '#c2417c'];

export function OverviewPage() {
  const v = useTaskView();
  const s = useScope();
  const [asTable, setAsTable] = useState(false);
  const cohort = useMemo(() => s.tasks.filter((t) => t.dueAt && diffDays(t.dueAt, s.period.start) >= 0 && diffDays(t.dueAt, s.period.end) <= 0), [s]);
  const all = useMemo(() => weeklySeries(s.tasks, s.period), [s]);
  const perUnit = useMemo(() => s.childUnits.map((u, i) => {
    const ids = new Set(descendantIds(v.units, u.id));
    const ts = s.tasks.filter((t) => ids.has(t.unitId));
    return { unit: u, color: u.color || COLORS[i % COLORS.length], series: weeklySeries(ts, s.period), bd: breakdown(ts, v.wfOfTask, v.today) };
  }), [s, v]);
  const bd = useMemo(() => breakdown(s.tasks, v.wfOfTask, v.today), [s, v]);
  const curWeek = weekStart(v.today);
  const idx = Math.max(0, all.findIndex((p) => p.week === curWeek));
  const actual = all[idx]?.actualPct ?? 0;
  const plan = all[idx]?.planPct ?? 0;
  const risks = riskList(s.tasks, v.wfOfTask, v.settings, v.today).slice(0, 5);
  const labels = all.map((p) => vnDayMonth(p.week));
  const lines = [
    ...perUnit.map((u) => ({ name: u.unit.name, color: u.color, values: u.series.map((p) => p.actualPct) })),
    { name: 'Kế hoạch', color: '#6B7280', values: all.map((p) => p.planPct), dashed: true },
  ];

  return (
    <div className="screen">
      <PageHead title={<>Tổng quan · {s.unit?.parentId === null ? 'Toàn Khoa' : s.unit?.name}</>} sub={`${s.periodLabel} · ${vnDate(s.period.start)} – ${vnDate(s.period.end)} · ${cohort.length} việc có hạn trong kỳ`}
        actions={<><Link className="btn" to="/manage/reports">Xuất báo cáo</Link><Link className="btn pri" to="/manage/assign">Giao việc</Link></>} />
      <ErrorBox errors={v.errors} />
      <div className="g4">
        <div className="card stat"><span>% hoàn thành so với kế hoạch</span><b>{actual}%</b><small className={actual >= plan ? 'note' : 'note'} style={{ color: actual >= plan ? 'var(--done-ink)' : 'var(--danger)' }}>{actual >= plan ? '+' : ''}{actual - plan} điểm so với kế hoạch ({plan}%)</small></div>
        <div className="card stat"><span>Đang làm</span><b>{bd.doing}</b><small className="note">việc đang thực hiện</small></div>
        <div className="card stat"><span>Quá hạn</span><b className={bd.late ? 'red' : ''}>{bd.late}</b><small className="note">cần xử lý</small></div>
        <div className="card stat"><span>Chờ duyệt</span><b>{bd.review}</b><small className="note">đang chờ phê duyệt</small></div>
      </div>
      <div className="g21">
        <div className="card">
          <h3>Tiến độ hoàn thành theo thời gian <button className="linkbtn" aria-pressed={asTable} onClick={() => setAsTable((x) => !x)}>{asTable ? 'Xem dạng biểu đồ' : 'Xem dạng bảng'}</button></h3>
          {all.length === 0 || cohort.length === 0 ? <div className="empty">Chưa có việc nào có hạn trong kỳ này.</div> : asTable ? <DataTable labels={labels} series={lines} unit="%" /> : (<><Legend items={lines} /><LineChart labels={labels} series={lines} /></>)}
          <p className="note">% số việc của kỳ (có hạn chót trong kỳ) đã hoàn thành, cộng dồn theo tuần. Đường đứt nét là kế hoạch: % việc đã đến hạn.</p>
        </div>
        <div className="card">
          <h3>Tiến độ từng đơn vị <Link to="/manage/units">Chi tiết</Link></h3>
          <Legend items={[{ name: 'Hoàn thành', color: '#15803D' }, { name: 'Đang làm', color: '#2563EB' }, { name: 'Chờ duyệt', color: '#B45309' }, { name: 'Quá hạn', color: '#B42318' }]} />
          <div className="ub">
            {perUnit.map((u) => (
              <div className="u-row" key={u.unit.id}>
                <span>{u.unit.name}</span>
                <div className="stack" role="img" aria-label={`${u.unit.name}: ${u.bd.done} xong, ${u.bd.doing} đang làm, ${u.bd.review} chờ duyệt, ${u.bd.late} quá hạn`}>
                  {[['#15803D', u.bd.done], ['#2563EB', u.bd.doing], ['#B45309', u.bd.review], ['#B42318', u.bd.late]].map(([c, n], i) => <i key={i} style={{ background: c as string, width: `${pct(n as number, Math.max(u.bd.total - u.bd.todo, 1))}%` }} />)}
                </div>
                <b>{pct(u.bd.done, u.bd.total)}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="g21">
        <div className="card">
          <h3>Số việc tạo mới và hoàn thành mỗi tuần</h3>
          <Legend items={[{ name: 'Hoàn thành', color: '#15803D' }, { name: 'Tạo mới', color: '#93C5FD' }]} />
          <ColumnChart labels={labels} series={[{ name: 'Hoàn thành', color: '#15803D', values: all.map((p) => p.done) }, { name: 'Tạo mới', color: '#93C5FD', values: all.map((p) => p.created) }]} />
        </div>
        <div className="card">
          <h3>Cần chú ý <Link to="/manage/risks">Xem tất cả</Link></h3>
          {risks.length === 0 ? <div className="empty">Không có việc rủi ro.</div> : (
            <div className="list">{risks.map(({ task, kind }) => <div className="li" key={task.id}><div><Link to={`/task/${task.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{task.title}</Link><small>{v.unitById(task.unitId)?.name} · hạn {vnDayMonth(task.dueAt)}</small></div><span className={`b ${kind === 'overdue' ? 'late' : 'rev'}`} style={{ marginLeft: 'auto' }}>{kind === 'overdue' ? 'Quá hạn' : 'Nguy cơ'}</span></div>)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
