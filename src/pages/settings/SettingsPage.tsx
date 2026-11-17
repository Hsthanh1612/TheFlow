import { useState } from 'react';
import { PageHead, Tabs, Loading } from '../../components/ui';
import { useAuth } from '../../state/auth';
import { useData } from '../../state/data';
import { hasPerm } from '../../domain/permissions';
import { TypesTab } from './TypesTab';
import { WorkflowsTab } from './WorkflowsTab';
import { RolesTab } from './RolesTab';
import { TemplatesTab } from './TemplatesTab';
import { UnitsTab } from './UnitsTab';
import { UsersTab } from './UsersTab';
import { GeneralTab } from './GeneralTab';
import { AiTab } from './AiTab';
import { HistoryTab } from './HistoryTab';

type Tab = 'types' | 'workflows' | 'roles' | 'templates' | 'units' | 'users' | 'general' | 'ai' | 'history';

export function SettingsPage() {
  const { principal } = useAuth();
  const d = useData();
  const canConfig = hasPerm(principal, 'config.edit', null);
  const canUsers = hasPerm(principal, 'user.manage', null);
  const items: { key: Tab; label: string }[] = [
    ...(canConfig ? ([{ key: 'types', label: 'Loại việc' }, { key: 'workflows', label: 'Quy trình duyệt' }, { key: 'roles', label: 'Vai trò & quyền' }, { key: 'templates', label: 'Mẫu việc & lặp' }, { key: 'units', label: 'Cây tổ chức' }] as { key: Tab; label: string }[]) : []),
    ...(canUsers ? [{ key: 'users' as Tab, label: 'Người dùng' }] : []),
    ...(canConfig ? ([{ key: 'general', label: 'Thiết lập chung' }, { key: 'ai', label: 'Nhờ AI chỉnh cấu hình' }, { key: 'history', label: 'Lịch sử' }] as { key: Tab; label: string }[]) : []),
  ];
  const [tab, setTab] = useState<Tab>(items[0]?.key ?? 'users');
  if (!d.ready) return <Loading />;
  if (items.length === 0) return <div className="card"><div className="empty">Bạn không có quyền sửa cấu hình.</div></div>;
  return (
    <div className="screen">
      <PageHead title="Cấu hình" sub="Loại việc, trường dữ liệu, quy trình và quyền đều là cấu hình, có thể sửa mà không cần viết lại code." />
      <Tabs value={tab} onChange={setTab} items={items} label="Mục cấu hình" />
      {tab === 'types' && <TypesTab />}
      {tab === 'workflows' && <WorkflowsTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'units' && <UnitsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'general' && <GeneralTab />}
      {tab === 'ai' && <AiTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}
