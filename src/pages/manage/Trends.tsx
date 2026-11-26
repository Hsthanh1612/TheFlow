import { useMemo, useState } from 'react';
import { PageHead, ErrorBox } from '../../components/ui';
import { useTaskView } from '../../components/taskBits';
import { useScope } from './ManagerShell';
import { useData } from '../../state/data';
import { useAuth } from '../../state/auth';
import { useToast } from '../../state/toast';
import { LineChart, Legend } from '../../components/charts';
import { takeSnapshot } from '../../services/firebase/featuresRepo';
import { hasGlobalPerm } from '../../domain/permissions';
import { burndown, makeSnapshot, openOf, sumCounts, weekKey } from '../../domain/snapshot';
import { vnDate, vnDayMonth } from '../../domain/dates';
import { nowIso } from '../../services/firebase/ids';

/** Xu hướng: burndown của kỳ đang chọn (tính lại từ ngày hoàn thành) và ảnh chụp tình trạng theo tuần (đếm cả "quá hạn" tại thời điểm chụp). */
export function TrendsPage() {
  const v = useTaskView();
  const s = useScope();
  const d = useData();
  const { profile, principal } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const canSnap = hasGlobalPerm(principal, 'task.view_all');
  const burn = useMemo(() => burndown(s.tasks, s.period, v.today), [s.tasks, s.period, v.today]);
  const snaps = useMemo(() => [...d.snapshots].sort((a, b) => a.week.localeCompare(b.week)), [d.snapshots]);
  const isRoot = s.unit?.parentId === null;
  const series = snaps.map((x) => sumCounts(x, isRoot ? '*' : s.unitIds));
  const labels = burn.map((p) => vnDayMonth(p.week));
  const burnMax = Math.max(1, ...burn.map((p) => Math.max(p.remaining ?? 0, p.ideal)));
  const snapMax = Math.max(1, ...series.map((c) => Math.max(openOf(c), c.done)));
  const thisWeek = weekKey(v.today);
  const haveThisWeek = snaps.some((x) => x.week === thisWeek);

  async function snapNow() {
    if (!profile) return;
    setBusy(true);
    try {
      const ok = await takeSnapshot(makeSnapshot(d.tasks, v.wfOfTask, v.today, profile.uid, nowIso()));
      toast.ok(ok ? 'Đã chụp tình trạng tuần này.' : 'Tuần này đã có ảnh chụp rồi (mỗi tuần chỉ chụp một lần).');
    } catch (e) {
      toast.fail(e);
    }
    setBusy(false);
  }

  return (
    <div className="screen">
      <PageHead title="Xu hướng" sub={`${s.periodLabel} · ${isRoot ? 'Toàn Khoa' : s.unit?.name}`}
        actions={canSnap && <button className="btn" disabled={busy || haveThisWeek} onClick={() => void snapNow()}>{haveThisWeek ? 'Tuần này đã chụp' : 'Chụp tình trạng tuần này'}</button>} />
      <ErrorBox errors={v.errors} />
      <div className="card">
        <h3>Burndown: số việc còn lại</h3>
        {burn.length === 0 || burnMax === 1 && burn.every((p) => p.ideal === 0) ? <div className="empty">Chưa có việc nào có hạn trong kỳ này.</div> : (
          <>
            <Legend items={[{ name: 'Còn lại (thực tế)', color: '#2F6BE0' }, { name: 'Đường lý tưởng', color: '#8A93AB', dashed: true }]} />
            <LineChart labels={labels} max={Math.max(2, Math.ceil(burnMax))} unit="" series={[
              { name: 'Còn lại (thực tế)', color: '#2F6BE0', values: burn.filter((p) => p.remaining !== null).map((p) => p.remaining as number) },
              { name: 'Đường lý tưởng', color: '#8A93AB', values: burn.map((p) => p.ideal), dashed: true },
            ]} />
            <p className="note">Tính trên các việc có hạn chót trong kỳ. Đường thực tế đi xuống khi việc được hoàn thành; nếu nằm trên đường lý tưởng nghĩa là đang chậm so với kế hoạch.</p>
          </>
        )}
      </div>
      <div className="card">
        <h3>Ảnh chụp theo tuần: việc đang mở và quá hạn</h3>
        {snaps.length === 0 ? (
          <div className="empty">Chưa có ảnh chụp nào. Hệ thống tự chụp khi người quản lý có quyền xem toàn Khoa mở app lần đầu mỗi tuần{canSnap ? ' — hoặc bạn bấm “Chụp tình trạng tuần này”.' : '.'}</div>
        ) : (
          <>
            <Legend items={[{ name: 'Đang mở', color: '#2F6BE0' }, { name: 'Quá hạn', color: '#D93036' }, { name: 'Hoàn thành (tích luỹ)', color: '#1E8A55' }]} />
            <LineChart labels={snaps.map((x) => vnDayMonth(x.week))} max={snapMax} unit="" series={[
              { name: 'Đang mở', color: '#2F6BE0', values: series.map(openOf) },
              { name: 'Quá hạn', color: '#D93036', values: series.map((c) => c.late) },
              { name: 'Hoàn thành (tích luỹ)', color: '#1E8A55', values: series.map((c) => c.done) },
            ]} />
            <p className="note">Mỗi tuần một ảnh chụp, lấy tại thời điểm chụp đầu tiên trong tuần (mới nhất: {vnDate(snaps[snaps.length - 1].week)}). Khác với burndown, số “quá hạn” theo tuần không tính lại được từ dữ liệu cũ nên cần ảnh chụp.</p>
          </>
        )}
      </div>
    </div>
  );
}
