import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './state/auth';
import { DataProvider } from './state/data';
import { Layout } from './components/Layout';
import { TaskFormProvider } from './components/TaskForm';
import { Loading } from './components/ui';
import { ConfigErrorPage, FatalPage, LoginPage, PendingPage } from './pages/AuthPages';
import { HomePage } from './pages/Home';
import { TasksPage } from './pages/TasksPage';
import { TaskDetailPage } from './pages/TaskDetail';
import { DocsPage } from './pages/DocsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ManagerShell } from './pages/manage/ManagerShell';
import { OverviewPage } from './pages/manage/Overview';
import { ApprovalsPage } from './pages/manage/Approvals';
import { AssignPage } from './pages/manage/Assign';
import { RisksPage } from './pages/manage/Risks';
import { UnitsPage } from './pages/manage/Units';
import { ReportsPage } from './pages/manage/Reports';
import { useReminders } from './state/useReminders';

function Reminders() {
  useReminders();
  return null;
}

export function App() {
  const { status, profile, error } = useAuth();
  if (status === 'config-error') return <ConfigErrorPage />;
  if (status === 'loading') return <Loading text="Đang kiểm tra phiên đăng nhập…" />;
  if (status === 'signed-out') return <LoginPage />;
  if (status === 'error' || status === 'no-profile') return <FatalPage message={error ?? 'Không tìm thấy hồ sơ tài khoản.'} />;
  if (!profile?.active) return <PendingPage />;

  // key = uid: đổi tài khoản huỷ toàn bộ listener và dữ liệu của người trước.
  return (
    <DataProvider key={profile.uid}>
      <TaskFormProvider>
        <Reminders />
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tasks" element={<Navigate to="/tasks/kanban" replace />} />
            <Route path="/tasks/:view" element={<TasksPage />} />
            <Route path="/task/:id" element={<TaskDetailPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/manage" element={<Navigate to="/manage/overview" replace />} />
            <Route path="/manage/overview" element={<ManagerShell><OverviewPage /></ManagerShell>} />
            <Route path="/manage/approvals" element={<ManagerShell><ApprovalsPage /></ManagerShell>} />
            <Route path="/manage/assign" element={<ManagerShell><AssignPage /></ManagerShell>} />
            <Route path="/manage/risks" element={<ManagerShell><RisksPage /></ManagerShell>} />
            <Route path="/manage/units" element={<ManagerShell><UnitsPage /></ManagerShell>} />
            <Route path="/manage/reports" element={<ManagerShell><ReportsPage /></ManagerShell>} />
            <Route path="*" element={<div className="card"><div className="empty">Không tìm thấy trang.</div></div>} />
          </Routes>
        </Layout>
      </TaskFormProvider>
    </DataProvider>
  );
}
