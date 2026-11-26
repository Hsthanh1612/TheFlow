import { Link } from 'react-router-dom';
import { useData } from '../state/data';
import { useElapsedSeconds, useTimerActions } from '../state/timer';
import { formatClock } from '../domain/time';

/** Đồng hồ đang chạy hiện ở thanh trên mọi trang, để không quên dừng. */
export function TimerChip() {
  const { timer } = useData();
  const secs = useElapsedSeconds(timer?.startedAt ?? null);
  const act = useTimerActions();
  if (!timer) return null;
  return (
    <div className="timer-chip" role="group" aria-label="Đang bấm giờ">
      <span className="timer-dot" aria-hidden="true" />
      <Link to={`/task/${timer.taskId}`} className="timer-title" title={timer.title}>{timer.title}</Link>
      <span className="timer-clock sm" role="timer">{formatClock(secs)}</span>
      <button className="btn sm" onClick={() => void act.stop()}>Dừng</button>
    </div>
  );
}
