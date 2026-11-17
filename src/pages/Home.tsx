import { Link } from 'react-router-dom';
import { Loading, PageHead, ErrorBox } from '../components/ui';
import { DueText, ProgressCell, TaskLinkTitle, TaskStatus, TypeTag, useTaskView } from '../components/taskBits';
import { useAuth } from '../state/auth';
import { hasPerm } from '../domain/permissions';
import { daysLeft } from '../domain/taskLogic';
import { diffDays, vnDate } from '../domain/dates';
import { sortByDue } from '../domain/filters';

const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function HomePage() {
  const v = useTaskView();
  const { profile, principal } = useAuth();
  if (!v.ready) return <Loading />;
  const uid = profile!.uid;
  const mine = v.tasks.filter((t) => t.assigneeIds.includes(uid) || t.collaboratorIds.includes(uid));
  const open = mine.filter((t) => v.categoryOfTask(t) !== 'done');
  const doing = open.filter((t) => v.categoryOfTask(t) === 'doing').length;
  const soon = open.filter((t) => { const d = daysLeft(t, v.today); return d !== null && d >= 0 && d <= 3; });
  const late = open.filter((t) => v.status(t) === 'late');
  const toReview = v.tasks.filter((t) => v.categoryOfTask(t) === 'review' && (t.reviewerIds.includes(uid) || hasPerm(principal, 'task.approve', t.unitId)));
  const [y, m, d] = v.today.split('-').map(Number);
  const dow = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const upcoming = sortByDue(open.filter((t) => t.dueAt !== null && diffDays(t.dueAt, v.today) >= 0)).slice(0, 5);
  const list = sortByDue(open).slice(0, 8);
  const firstName = profile!.name.trim().split(/\s+/).slice(-2).join(' ');

  return (
    <div className="screen">
      <PageHead title={`Xin chào, ${firstName}`} sub={`${dow}, ${vnDate(v.today)} · Dưới đây là việc cần chú ý của bạn.`} actions={<Link className="btn" to="/tasks/kanban">Xem bảng Kanban</Link>} />
      <ErrorBox errors={v.errors} />
      <div className="g4">
        <div className="card stat"><span>Đang làm</span><b>{doing}</b><small className="note">việc đang thực hiện</small></div>
        <div className="card stat"><span>Sắp đến hạn ({v.settings.riskDays} ngày)</span><b>{soon.length}</b><small className="note">cần hoàn thành sớm</small></div>
        <div className="card stat"><span>Quá hạn</span><b className={late.length ? 'red' : ''}>{late.length}</b><small className="note">cần xử lý ngay</small></div>
        <div className="card stat"><span>Chờ tôi duyệt</span><b>{toReview.length}</b><small className="note">việc đang chờ phê duyệt</small></div>
      </div>
      <div className="g21">
        <div className="card">
          <h3>Việc của tôi<Link to="/tasks/list">Xem tất cả</Link></h3>
          {list.length === 0 ? (
            <div className="empty">Bạn chưa có việc nào. Bấm “Tạo việc” để bắt đầu.</div>
          ) : (
            <div className="scroll">
              <table className="tbl">
                <thead><tr><th scope="col">Công việc</th><th scope="col">Loại</th><th scope="col">Hạn</th><th scope="col">Trạng thái</th><th scope="col">Tiến độ</th></tr></thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.id}>
                      <td><TaskLinkTitle t={t} /></td>
                      <td><TypeTag typeId={t.typeId} /></td>
                      <td className="nw"><DueText t={t} /></td>
                      <td><TaskStatus t={t} /></td>
                      <td><ProgressCell t={t} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="col">
          <div className="card">
            <h3>Sắp đến hạn<Link to="/tasks/calendar">Mở lịch</Link></h3>
            {upcoming.length === 0 ? <div className="empty">Không có việc sắp đến hạn.</div> : (
              <div className="list">
                {upcoming.map((t) => {
                  const left = daysLeft(t, v.today)!;
                  return (
                    <div className="li" key={t.id}>
                      <div className="dd"><b>{t.dueAt!.slice(8)}</b><small>T{Number(t.dueAt!.slice(5, 7))}</small></div>
                      <div><Link to={`/task/${t.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{t.title}</Link><small>{left === 0 ? 'Hôm nay' : `Còn ${left} ngày`}</small></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card">
            <h3>Thông báo</h3>
            {v.notifications.length === 0 ? <div className="empty">Chưa có thông báo.</div> : (
              <div className="list">
                {v.notifications.slice(0, 4).map((n) => (
                  <div className="li" key={n.id}><div>{n.taskId ? <Link to={`/task/${n.taskId}`}>{n.text}</Link> : n.text}<small>{vnDate(n.createdAt.slice(0, 10))}</small></div></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
