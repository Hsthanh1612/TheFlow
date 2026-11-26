import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Avatar } from './ui';
import { useAuth } from '../state/auth';
import { useData } from '../state/data';
import { useToast } from '../state/toast';
import { useTaskForm } from './TaskForm';
import { signOut } from '../services/firebase/authService';
import { markRead } from '../services/firebase/notifyRepo';
import { hasAnyScope, hasPerm } from '../domain/permissions';
import { riskList } from '../domain/stats';
import { vnDayMonth } from '../domain/dates';
import { applyMode, applyTheme, isModeId, isThemeId } from '../state/theme';
import { CommandPalette } from './CommandPalette';
import { TimerChip } from './TimerChip';
import { ThemePicker } from './ThemePicker';

function NavItem({ to, icon, children, badge, badgeClass }: { to: string; icon: string; children: ReactNode; badge?: number; badgeClass?: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav${isActive ? ' on' : ''}`}>
      <Icon name={icon} />
      {children}
      {badge !== undefined && badge > 0 && <span className={`b ${badgeClass ?? 'rev'}`}>{badge}</span>}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { principal, profile } = useAuth();
  const { units, tasks, today, settings, wfOfTask, categoryOfTask } = useData();
  const showManage = hasAnyScope(principal, 'manage.view');
  const canBulk = hasAnyScope(principal, 'task.bulk_assign');
  const canReport = hasAnyScope(principal, 'report.export');
  const canConfig = hasPerm(principal, 'config.edit', null);
  const canUsers = hasPerm(principal, 'user.manage', null);

  const myApprovals = useMemo(() => tasks.filter((t) => categoryOfTask(t) === 'review' && (t.reviewerIds.includes(profile?.uid ?? '') || hasPerm(principal, 'task.approve', t.unitId))).length, [tasks, categoryOfTask, profile, principal]);
  const risks = useMemo(() => (showManage ? riskList(tasks, wfOfTask, settings, today).length : 0), [showManage, tasks, wfOfTask, settings, today]);

  return (
    <div className="app">
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Bỏ qua tới nội dung</a>
      <aside className="side" aria-label="Điều hướng chính">
        <div className="brand"><span className="logo" aria-hidden="true">K</span>Việc của Khoa</div>
        <nav className="col" style={{ gap: 4 }} aria-label="Menu">
          <NavItem to="/" icon="home">Việc của tôi</NavItem>
          <NavItem to="/tasks/kanban" icon="kanban">Bảng Kanban</NavItem>
          <NavItem to="/tasks/calendar" icon="calendar">Lịch Khoa</NavItem>
          <NavItem to="/tasks/timeline" icon="timeline">Timeline</NavItem>
          <NavItem to="/goals" icon="target">Mục tiêu</NavItem>
          <NavItem to="/docs" icon="doc">Tài liệu</NavItem>
          {(canConfig || canUsers) && <NavItem to="/settings" icon="settings">Cấu hình</NavItem>}
          {showManage && (
            <>
              <div className="sec">Quản lý</div>
              <NavItem to="/manage/overview" icon="chart">Tổng quan</NavItem>
              <NavItem to="/manage/approvals" icon="inbox" badge={myApprovals}>Chờ duyệt</NavItem>
              {canBulk && <NavItem to="/manage/assign" icon="users">Giao công việc</NavItem>}
              <NavItem to="/manage/risks" icon="warn" badge={risks} badgeClass="late">Cảnh báo quá hạn</NavItem>
              <NavItem to="/manage/units" icon="users">Tiến độ đơn vị</NavItem>
              <NavItem to="/manage/workload" icon="workload">Khối lượng công việc</NavItem>
              <NavItem to="/manage/time" icon="clock">Giờ công</NavItem>
              <NavItem to="/manage/trends" icon="trend">Xu hướng</NavItem>
              {canReport && <NavItem to="/manage/reports" icon="doc">Báo cáo &amp; xuất file</NavItem>}
            </>
          )}
        </nav>
        <div className="sec">Bộ môn / Tổ</div>
        {units.filter((u) => u.parentId !== null && !u.archived).map((u) => (
          <div className="unit" key={u.id}><i className="dot" style={{ background: u.color }} />{u.name}</div>
        ))}
      </aside>
      <div className="main">
        <Topbar />
        <main className="content" id="main" tabIndex={-1} style={{ outline: 'none' }}>{children}</main>
      </div>
    </div>
  );
}

function Topbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { profile } = useAuth();
  const { notifications, tasks, userName } = useData();
  const toast = useToast();
  const form = useTaskForm();
  const [q, setQ] = useState('');
  const [openBell, setOpenBell] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const unread = notifications.filter((n) => !n.readAt);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  useEffect(() => { setOpenBell(false); setOpenMenu(false); setPalette(false); }, [loc.pathname]);
  // Chủ đề màu đã lưu trong hồ sơ tài khoản được áp dụng khi đăng nhập (đồng bộ giữa các thiết bị).
  useEffect(() => { if (isThemeId(profile?.theme)) applyTheme(profile.theme); }, [profile?.theme]);
  useEffect(() => { if (isModeId(profile?.mode)) applyMode(profile.mode); }, [profile?.mode]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); } };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    const h = (e: PointerEvent) => { if (!(e.target as Element).closest?.('.rel')) { setOpenBell(false); setOpenMenu(false); } };
    addEventListener('pointerdown', h);
    return () => removeEventListener('pointerdown', h);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpenBell(false); setOpenMenu(false); } };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, []);

  const taskTitle = (id: string | null) => tasks.find((t) => t.id === id)?.title;

  return (
    <header className="top">
      <form role="search" className="search" onSubmit={(e) => { e.preventDefault(); nav(`/tasks/list?q=${encodeURIComponent(q)}`); }}>
        <Icon name="search" size={16} />
        <input type="search" placeholder="Tìm việc theo tiêu đề…" aria-label="Tìm kiếm việc" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="kbd-hint" onClick={() => setPalette(true)} aria-label="Mở tìm kiếm nhanh (Ctrl hoặc Cmd + K)" title="Tìm kiếm nhanh"><kbd>⌘</kbd><kbd>K</kbd></button>
      </form>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <div className="tr">
        <TimerChip />
        <span className={`sync${online && toast.pending === 0 ? '' : ' warn'}`} role="status">
          {!online ? 'Mất kết nối — chưa đồng bộ' : toast.pending > 0 ? 'Đang gửi lên máy chủ…' : 'Đã đồng bộ'}
        </span>
        <div className="rel">
          <button className="ib" aria-label={`Thông báo${unread.length ? `, ${unread.length} chưa đọc` : ''}`} aria-haspopup="dialog" aria-expanded={openBell} onClick={() => setOpenBell((v) => !v)}>
            <Icon name="bell" />{unread.length > 0 && <em />}
          </button>
          {openBell && (
            <div className="menu" role="dialog" aria-label="Thông báo">
              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <strong>Thông báo</strong>
                {unread.length > 0 && <button className="linkbtn" onClick={() => profile && void toast.run(() => markRead(profile.uid, unread.map((n) => n.id)), 'Đã đánh dấu đã đọc.')}>Đánh dấu đã đọc</button>}
              </div>
              {notifications.length === 0 && <div className="empty">Chưa có thông báo.</div>}
              <div className="list">
                {notifications.map((n) => (
                  <div key={n.id} className={`li${n.readAt ? '' : ' unread'}`}>
                    <Avatar name={userName(n.actorId)} label={false} />
                    <div>
                      {n.taskId && taskTitle(n.taskId) ? <Link to={`/task/${n.taskId}`}>{n.text}</Link> : n.text}
                      <small>{vnDayMonth(n.createdAt.slice(0, 10))} {n.createdAt.slice(11, 16)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button className="btn cta" onClick={() => form.open()}><Icon name="plus" size={16} />Tạo việc</button>
        <div className="rel">
          <button className="ib" style={{ borderRadius: '50%' }} aria-label={`Tài khoản ${profile?.name ?? ''}`} aria-haspopup="menu" aria-expanded={openMenu} onClick={() => setOpenMenu((v) => !v)}>
            <Avatar name={profile?.name ?? '?'} label={false} />
          </button>
          {openMenu && (
            <div className="menu" style={{ width: 240 }}>
              <div style={{ padding: '8px 0' }}><strong>{profile?.name}</strong><div className="note">{profile?.email}</div></div>
              <div className="themes">
                <span className="note">Màu giao diện</span>
                <ThemePicker />
              </div>
              <Link to="/profile" className="btn" style={{ width: '100%', marginBottom: 8 }}>Hồ sơ cá nhân</Link>
              <button className="btn" style={{ width: '100%' }} onClick={() => void signOut()}>Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
