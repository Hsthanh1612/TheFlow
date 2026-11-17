import { useMemo, useState } from 'react';
import { PageHead, ErrorBox } from '../../components/ui';
import { useTaskView } from '../../components/taskBits';
import { useScope } from './ManagerShell';
import { breakdown, memberStats, pct } from '../../domain/stats';
import { descendantIds } from '../../domain/permissions';

export function UnitsPage() {
  const v = useTaskView();
  const s = useScope();
  const [pick, setPick] = useState('');
  const units = s.childUnits;
  const cur = units.find((u) => u.id === pick) ?? units[0];
  const cards = useMemo(() => units.map((u) => { const ids = new Set(descendantIds(v.units, u.id)); const ts = s.tasks.filter((t) => ids.has(t.unitId)); return { u, b: breakdown(ts, v.wfOfTask, v.today), ts }; }), [units, s.tasks, v]);
  const sel = cards.find((c) => c.u.id === cur?.id);
  const members = useMemo(() => {
    if (!cur) return [];
    const ids = new Set(descendantIds(v.units, cur.id));
    const people = v.users.filter((x) => x.active && x.unitId && ids.has(x.unitId));
    return memberStats(sel?.ts ?? [], people.map((p) => p.uid), v.wfOfTask, v.today);
  }, [cur, sel, v]);

  return (
    <div className="screen">
      <PageHead title="Tiến độ đơn vị" sub="Chọn một đơn vị để xem chi tiết theo từng thành viên." />
      <ErrorBox errors={v.errors} />
      <div className="g4">
        {cards.map(({ u, b }) => (
          <button key={u.id} className={`card stat unit-card${cur?.id === u.id ? ' on' : ''}`} aria-pressed={cur?.id === u.id} onClick={() => setPick(u.id)}>
            <span><i className="dot" style={{ background: u.color }} /> {u.name}</span>
            <b>{pct(b.done, b.total)}%</b>
            <small className="note">{b.done}/{b.total} xong · {b.doing} đang làm · {b.review} chờ duyệt · <span style={{ color: b.late ? 'var(--danger)' : undefined }}>{b.late} quá hạn</span></small>
          </button>
        ))}
        {cards.length === 0 && <div className="empty">Chưa có đơn vị nào.</div>}
      </div>
      <div className="card">
        <h3>Thành viên — {cur?.name}</h3>
        {members.length === 0 ? <div className="empty">Đơn vị chưa có thành viên được kích hoạt.</div> : (
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th scope="col">Thành viên</th><th scope="col">Đang làm</th><th scope="col">Chờ duyệt</th><th scope="col">Hoàn thành</th><th scope="col">Quá hạn</th><th scope="col">Tỉ lệ đúng hạn</th></tr></thead>
              <tbody>{members.map((m) => <tr key={m.userId}><td>{v.userName(m.userId)}</td><td>{m.doing}</td><td>{m.review}</td><td>{m.done}</td><td style={{ color: m.late ? 'var(--danger)' : undefined }}>{m.late}</td><td>{m.onTimeRate === null ? '—' : `${m.onTimeRate}%`}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
