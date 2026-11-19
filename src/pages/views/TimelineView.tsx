import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTaskView } from '../../components/taskBits';
import { addDays, dayOfIso, vnDayMonth, weekStart } from '../../domain/dates';
import { timelineSpan, type Span } from '../../domain/timeline';
import type { Task } from '../../domain/types';

const WEEKS = 8;
type Row = { t: Task; span: Span };

export function TimelineView({ tasks, group }: { tasks: Task[]; group: 'none' | 'unit' | 'type' }) {
  const v = useTaskView();
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStart(v.today), (offset - 3) * 7); // tuần hiện tại ở cột thứ 4 như mockup
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(start, i * 7));
  const nowIdx = weeks.indexOf(weekStart(v.today));
  const rows: Row[] = [];
  for (const t of tasks) {
    const span = timelineSpan(t.startAt ?? dayOfIso(t.createdAt), t.dueAt, start, WEEKS);
    if (span) rows.push({ t, span });
  }
  rows.sort((a, b) => a.span.firstCol - b.span.firstCol || (a.t.dueAt ?? '').localeCompare(b.t.dueAt ?? ''));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = group === 'unit' ? (v.unitById(r.t.unitId)?.name ?? '—') : group === 'type' ? (v.typeById(r.t.typeId)?.name ?? '—') : '';
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const noDue = tasks.filter((t) => !t.dueAt).length;

  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn sm" onClick={() => setOffset(offset - 4)} aria-label="Lùi 4 tuần">‹</button>
        <button className="btn sm" onClick={() => setOffset(0)}>Tuần này</button>
        <button className="btn sm" onClick={() => setOffset(offset + 4)} aria-label="Tiến 4 tuần">›</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="scroll">
          <div className="gt" style={{ gridTemplateColumns: `260px repeat(${WEEKS}, minmax(84px, 1fr))` }} role="table" aria-label="Timeline">
            <div className="gh" style={{ borderLeft: 0, textAlign: 'left' }} role="columnheader">Công việc</div>
            {weeks.map((w, i) => <div key={w} className={`gh${i === nowIdx ? ' now' : ''}`} role="columnheader">Tuần {vnDayMonth(w)}</div>)}
            {rows.length === 0 && <div className="empty" style={{ gridColumn: `1 / ${WEEKS + 2}` }}>Không có việc nào trong khoảng thời gian này.</div>}
            {[...groups.entries()].map(([g, list]) => (
              <Group key={g} name={g} list={list} show={group !== 'none'} status={v.status} />
            ))}
            {nowIdx >= 0 && <div className="now-ov" aria-hidden="true" style={{ left: `calc(260px + (100% - 260px) * ${nowIdx} / ${WEEKS})`, width: `calc((100% - 260px) / ${WEEKS})` }} />}
          </div>
        </div>
      </div>
      <p className="note">Cột tô nhạt là tuần hiện tại. Màu thanh theo trạng thái; số % là tiến độ checklist. {noDue > 0 ? `${noDue} việc chưa có hạn chót nên không hiện trên timeline.` : ''} Kéo đổi ngày và phụ thuộc giữa các việc: giai đoạn sau (theo BRIEF).</p>
    </>
  );
}

function Group({ name, list, show, status }: { name: string; list: Row[]; show: boolean; status: (t: Task) => string }) {
  const v = useTaskView();
  return (
    <>
      {show && <div role="row" style={{ gridColumn: `1 / ${WEEKS + 2}`, padding: '6px 10px', background: 'var(--cream-sunk-2)', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--line)' }}>{name}</div>}
      {list.map(({ t, span }) => {
        const s = status(t);
        const pct = v.progress(t);
        return (
          <div key={t.id} style={{ display: 'contents' }} role="row">
            <Link className="gl" to={`/task/${t.id}`} role="cell" title={t.title}><span>{t.title}</span></Link>
            {span.firstCol > 0 && <div className="gr" style={{ gridColumn: `2 / ${2 + span.firstCol}` }} role="cell" />}
            <div className="gr" style={{ gridColumn: `${2 + span.firstCol} / ${2 + span.lastCol + 1}` }} role="cell">
              <div className={`gb ${s === 'review' ? 'rev' : s}`} aria-label={`${t.title}: ${pct}%`}>{pct > 0 ? `${pct}%` : ''}</div>
            </div>
            {span.lastCol < WEEKS - 1 && <div className="gr" style={{ gridColumn: `${2 + span.lastCol + 1} / ${WEEKS + 2}` }} role="cell" />}
          </div>
        );
      })}
    </>
  );
}


