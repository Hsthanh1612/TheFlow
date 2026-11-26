import { useAuth } from '../../state/auth';
import { useData } from '../../state/data';
import { useToast } from '../../state/toast';
import { saveConfigItem, saveSettings, syncScopes } from '../../services/firebase/configRepo';
import type { KhoaConfig } from '../../domain/config';

export const PERM_LABELS: Record<string, string> = {
  'task.view_all': 'Xem việc của đơn vị', 'task.assign': 'Giao/sửa việc', 'task.bulk_assign': 'Giao công việc', 'task.approve': 'Duyệt',
  'task.reassign': 'Đổi người phụ trách', 'task.extend': 'Gia hạn', 'manage.view': 'Xem khu vực Quản lý', 'report.export': 'Xuất báo cáo', 'config.edit': 'Sửa cấu hình', 'user.manage': 'Quản lý người dùng',
};

export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'muc';
}

export function currentConfig(d: ReturnType<typeof useData>): KhoaConfig {
  return { version: 1, units: d.units, roles: d.roles, workflows: d.workflows, taskTypes: d.taskTypes, templates: d.templates, terms: d.terms, settings: d.settings };
}

/** Lưu cấu hình + ghi phiên bản; sau khi đổi vai trò/cây tổ chức thì đồng bộ lại `scopes` của người dùng (nếu có quyền). */
export function useConfigSave() {
  const { profile, principal } = useAuth();
  const d = useData();
  const toast = useToast();
  const canSync = principal?.isAdmin === true || (principal?.scopes['user.manage'] ?? []).includes('*');
  return {
    async save(section: Parameters<typeof saveConfigItem>[0], item: object, before: object | null, okText = 'Đã lưu cấu hình.') {
      if (!profile) return false;
      const r = await toast.run(() => saveConfigItem(section, item, before, profile.uid), okText);
      return r.ok;
    },
    async saveSettings(next: object) {
      if (!profile) return false;
      const r = await toast.run(() => saveSettings(next, d.settings, profile.uid), 'Đã lưu thiết lập.');
      return r.ok;
    },
    /** gọi SAU khi roles/units đã được ghi và listener đã nhận bản mới */
    async resync(roles = d.roles, units = d.units) {
      if (!canSync) return;
      await toast.run(() => syncScopes(d.users, roles, units).then((n) => n), 'Đã cập nhật quyền của người dùng.');
    },
    canSync,
  };
}
