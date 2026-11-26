import { useMemo, useState, type FormEvent } from 'react';
import { Field } from './ui';
import { useAuth } from '../state/auth';
import { useData } from '../state/data';
import { useToast } from '../state/toast';
import { useElapsedSeconds, useTimerActions } from '../state/timer';
import { addManualEntry, deleteTimeEntry } from '../services/firebase/featuresRepo';
import { AppError } from '../services/errors';
import { formatClock, formatMinutes, groupMinutes, parseDuration, sumMinutes } from '../domain/time';
import { vnDate } from '../domain/dates';
import type { Task } from '../domain/types';

/** Thẻ "Thời gian thực hiện" trong chi tiết việc: bấm giờ, ghi tay, xem giờ công theo người. */
export function TimeTracker({ task }: { task: Task }) {
  const { profile } = useAuth();
  const { timeEntries, timer, userName, today } = useData();
  const toast = useToast();
  const act = useTimerActions();
  const [dur, setDur] = useState('');
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const running = timer?.taskId === task.id;
  const secs = useElapsedSeconds(running ? timer!.startedAt : null);
  const entries = useMemo(() => timeEntries.filter((e) => e.taskId === task.id).sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt)), [timeEntries, task.id]);
  const perUser = useMemo(() => [...groupMinutes(entries, (e) => e.userId)].sort((a, b) => b[1] - a[1]), [entries]);
  if (!profile) return null;

  async function addManual(e: FormEvent) {
    e.preventDefault();
    const m = parseDuration(dur);
    if (m === null) return toast.fail(new AppError('data', 'Chưa hiểu thời gian. Ví dụ: 90, 1:30, 1h30, 45p.'));
    setBusy(true);
    const r = await toast.run(() => addManualEntry(profile!.uid, task, day, m, note), `Đã ghi ${formatMinutes(m)}.`);
    setBusy(false);
    if (r.ok) { setDur(''); setNote(''); }
  }

  return (
    <div className="card" aria-label="Thời gian thực hiện">
      <h3>Thời gian thực hiện <span className="note">Tổng {formatMinutes(sumMinutes(entries))}</span></h3>
      <div className="row timer-row">
        {running ? (
          <>
            <span className="timer-clock" role="timer" aria-label="Thời gian đang bấm">{formatClock(secs)}</span>
            <button className="btn pri" onClick={() => void act.stop()}>Dừng và ghi giờ</button>
            <button className="btn" onClick={() => void act.discard()}>Bỏ</button>
          </>
        ) : (
          <button className="btn pri" onClick={() => void act.start(task)}>{timer ? 'Chuyển bấm giờ sang việc này' : 'Bắt đầu bấm giờ'}</button>
        )}
        {timer && !running && <span className="note">Đang bấm giờ: {timer.title}</span>}
      </div>
      <form className="timer-form" onSubmit={addManual} noValidate aria-label="Ghi giờ thủ công">
        <Field label="Thời gian" htmlFor="te-dur"><input id="te-dur" className="inp" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="1h30" /></Field>
        <Field label="Ngày" htmlFor="te-day"><input id="te-day" type="date" className="inp" value={day} max={today} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label="Ghi chú" htmlFor="te-note"><input id="te-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Đã làm gì?" /></Field>
        <button className="btn" type="submit" disabled={busy || dur.trim() === ''}>Ghi giờ</button>
      </form>
      {perUser.length > 1 && <div className="chips" style={{ marginTop: 8 }}>{perUser.map(([u, m]) => <span className="tg" key={u}>{userName(u)}: {formatMinutes(m)}</span>)}</div>}
      <div className="list" style={{ marginTop: 6 }}>
        {entries.length === 0 && <div className="note">Chưa có giờ công nào.</div>}
        {entries.slice(0, 12).map((e) => (
          <div className="li te-row" key={e.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{formatMinutes(e.minutes)}</strong> · {userName(e.userId)} · {vnDate(e.day)}{e.source === 'timer' && <span className="note"> (bấm giờ)</span>}
              {e.note && <small>{e.note}</small>}
            </div>
            {e.userId === profile.uid && <button className="linkbtn" aria-label={`Xoá ${formatMinutes(e.minutes)} ngày ${vnDate(e.day)}`} onClick={() => void toast.run(() => deleteTimeEntry(e.id), 'Đã xoá bản ghi giờ.')}>Xoá</button>}
          </div>
        ))}
        {entries.length > 12 && <div className="note">…và {entries.length - 12} bản ghi cũ hơn.</div>}
      </div>
    </div>
  );
}
