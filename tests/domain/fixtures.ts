import { defaultConfig } from '../../src/domain/defaultConfig';
import type { OrgUnit, Task, UserProfile } from '../../src/domain/types';
import { computeScopes, type Principal } from '../../src/domain/permissions';

export const cfg = defaultConfig();

export const units: OrgUnit[] = [
  { id: 'khoa', parentId: null, name: 'Khoa', kind: 'khoa', color: '#2563EB', headId: 'dean', archived: false },
  { id: 'bm1', parentId: 'khoa', name: 'Bộ môn 1', kind: 'bomon', color: '#2a78d6', headId: 'head1', archived: false },
  { id: 'bm2', parentId: 'khoa', name: 'Bộ môn 2', kind: 'bomon', color: '#eb6834', headId: 'head2', archived: false },
  { id: 'bm1a', parentId: 'bm1', name: 'Tổ 1A', kind: 'to', color: '#1baf7a', headId: null, archived: false },
  { id: 'gv', parentId: 'khoa', name: 'Tổ giáo vụ', kind: 'to', color: '#eda100', headId: null, archived: false },
];

export function user(uid: string, unitId: string | null, roleKey: string | null, active = true): UserProfile {
  const assignments = roleKey && unitId ? [{ roleKey, unitId }] : [];
  return { uid, name: uid.toUpperCase(), email: `${uid}@x.vn`, active, unitId, assignments, scopes: computeScopes(assignments, cfg.roles, units), createdAt: '2026-01-01T00:00:00.000Z' };
}

export const users: UserProfile[] = [
  user('dean', 'khoa', 'truong_khoa'),
  user('head1', 'bm1', 'truong_bo_mon'),
  user('head2', 'bm2', 'truong_bo_mon'),
  user('an', 'bm1', 'giang_vien'),
  user('ha', 'bm1a', 'giang_vien'),
  user('lan', 'bm2', 'giang_vien'),
  user('off', 'bm2', 'giang_vien', false),
  user('nounit', null, 'giang_vien'),
];

export function principal(u: UserProfile, isAdmin = false): Principal {
  return { uid: u.uid, isAdmin, scopes: u.scopes, active: u.active };
}

export const wfOf = (t: Task) => cfg.workflows.find((w) => w.id === t.workflowId);

export function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1', typeId: 'de_thi', workflowId: 'duyet_1_cap', title: 'Ra đề thi', description: '', stateKey: 'doing', priority: 'normal', labels: [], startAt: null, dueAt: '2026-11-24', unitId: 'bm1',
    assigneeIds: ['an'], collaboratorIds: [], reviewerIds: ['head1'], participantIds: ['an', 'head1'], checklist: [], links: [], customFields: {}, activity: {}, lastActivityId: null, statusNote: '', statusNoteAt: null, templateId: null, bulkId: null,
    createdBy: 'head1', createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z', completedAt: null, ...over,
  };
}
