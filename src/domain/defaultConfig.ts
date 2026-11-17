import type { KhoaConfig } from './config';
import type { ActorKind, FieldDef, Workflow } from './types';
import { withDerived } from './workflow';
import { DEFAULT_SETTINGS } from './types';

const f = (key: string, label: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}, order = 0): FieldDef => ({ key, label, type, required: false, options: [], order, archived: false, ...extra });

function wf(id: string, name: string, initialState: string, states: Workflow['states'], tr: [string, string, ActorKind[], boolean?][]): Workflow {
  const transitions = tr.map(([from, to, allowed, requiresComment]) => ({ from, to, allowed, requiresComment: requiresComment ?? false }));
  return withDerived({ id, name, initialState, states, transitions, archived: false });
}

const DO: ActorKind[] = ['assignee', 'collaborator', 'assigner'];

/**
 * Cấu hình khởi tạo, lấy từ ví dụ trong mockup (loại việc, quy trình, vai trò mẫu). Chủ app sửa qua màn Cấu hình
 * hoặc nhập file JSON — không cần đổi code.
 */
export function defaultConfig(): KhoaConfig {
  const workflows: Workflow[] = [
    wf('duyet_1_cap', 'Có duyệt', 'todo', [
      { key: 'todo', label: 'Chờ làm', category: 'todo' },
      { key: 'doing', label: 'Đang làm', category: 'doing' },
      { key: 'review', label: 'Chờ duyệt', category: 'review' },
      { key: 'done', label: 'Hoàn thành', category: 'done' },
    ], [
      ['todo', 'doing', DO],
      ['doing', 'todo', DO],
      ['doing', 'review', ['assignee', 'assigner']],
      ['review', 'done', ['reviewer', 'approver']],
      ['review', 'doing', ['reviewer', 'approver'], true],
      ['done', 'doing', ['assigner', 'approver']],
    ]),
    wf('duyet_2_cap', 'Duyệt 2 cấp (Trưởng bộ môn → Trưởng khoa)', 'todo', [
      { key: 'todo', label: 'Giao việc', category: 'todo' },
      { key: 'doing', label: 'Thực hiện', category: 'doing' },
      { key: 'bm_review', label: 'Trưởng bộ môn duyệt', category: 'review' },
      { key: 'dean_review', label: 'Trưởng khoa duyệt', category: 'review' },
      { key: 'done', label: 'Hoàn thành', category: 'done' },
    ], [
      ['todo', 'doing', DO],
      ['doing', 'todo', DO],
      ['doing', 'bm_review', ['assignee', 'assigner']],
      ['bm_review', 'dean_review', ['reviewer', 'approver']],
      ['bm_review', 'doing', ['reviewer', 'approver'], true],
      ['dean_review', 'done', ['approver_all']],
      ['dean_review', 'doing', ['approver_all'], true],
      ['done', 'doing', ['approver_all']],
    ]),
    wf('khong_duyet', 'Không cần duyệt', 'todo', [
      { key: 'todo', label: 'Chờ làm', category: 'todo' },
      { key: 'doing', label: 'Đang làm', category: 'doing' },
      { key: 'done', label: 'Hoàn thành', category: 'done' },
    ], [
      ['todo', 'doing', DO],
      ['doing', 'todo', DO],
      ['doing', 'done', ['assignee', 'assigner']],
      ['done', 'doing', ['assigner']],
    ]),
  ];
  return {
    version: 1,
    units: [{ id: 'khoa', parentId: null, name: 'Khoa', kind: 'khoa', color: '#2563EB', headId: null, archived: false }],
    roles: [
      { key: 'quan_tri', name: 'Quản trị', permissions: ['task.view_all', 'task.assign', 'task.bulk_assign', 'task.approve', 'task.reassign', 'task.extend', 'manage.view', 'report.export', 'config.edit', 'user.manage'], archived: false },
      { key: 'truong_khoa', name: 'Trưởng khoa', permissions: ['task.view_all', 'task.assign', 'task.bulk_assign', 'task.approve', 'task.reassign', 'task.extend', 'manage.view', 'report.export', 'config.edit'], archived: false },
      { key: 'truong_bo_mon', name: 'Trưởng bộ môn', permissions: ['task.view_all', 'task.assign', 'task.bulk_assign', 'task.approve', 'task.reassign', 'task.extend', 'manage.view', 'report.export'], archived: false },
      { key: 'giang_vien', name: 'Giảng viên', permissions: [], archived: false },
      { key: 'giao_vu', name: 'Giáo vụ', permissions: ['task.view_all'], archived: false },
    ],
    workflows,
    taskTypes: [
      { id: 'bao_cao', name: 'Báo cáo', color: '#2563EB', workflowId: 'duyet_2_cap', archived: false, fields: [
        f('hoc_ky', 'Học kỳ', 'select', { required: true, options: ['HK1', 'HK2', 'HK hè'] }, 1),
        f('don_vi_nop', 'Đơn vị nộp', 'text', {}, 2),
        f('so_trang_toi_da', 'Số trang tối đa', 'number', {}, 3),
        f('tep_bieu_mau', 'Tệp biểu mẫu', 'file', {}, 4),
      ] },
      { id: 'de_thi', name: 'Đề thi', color: '#B45309', workflowId: 'duyet_1_cap', archived: false, fields: [f('hoc_phan', 'Học phần', 'text', { required: true }, 1)] },
      { id: 'hop', name: 'Họp', color: '#6D28D9', workflowId: 'khong_duyet', archived: false, fields: [f('dia_diem', 'Địa điểm', 'text', {}, 1)] },
      { id: 'coi_thi', name: 'Coi thi', color: '#0F766E', workflowId: 'khong_duyet', archived: false, fields: [] },
      { id: 'nckh', name: 'NCKH', color: '#15803D', workflowId: 'duyet_1_cap', archived: false, fields: [] },
      { id: 'tuyen_sinh', name: 'Tuyển sinh', color: '#BE185D', workflowId: 'duyet_1_cap', archived: false, fields: [] },
      { id: 'giao_vu', name: 'Giáo vụ', color: '#4B5563', workflowId: 'duyet_1_cap', archived: false, fields: [] },
      { id: 'chuong_trinh', name: 'Chương trình đào tạo', color: '#1D4ED8', workflowId: 'duyet_1_cap', archived: false, fields: [] },
    ],
    templates: [],
    terms: [],
    settings: DEFAULT_SETTINGS,
  };
}
