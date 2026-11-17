import { describe, expect, it } from 'vitest';
import { activityPatch, buildTask, extendPatch, peoplePatch, stripUndefined, transitionPatch } from '../../src/domain/taskBuilder';
import { cfg, task } from './fixtures';

const type = cfg.taskTypes.find((t) => t.id === 'bao_cao')!;
const workflow = cfg.workflows.find((w) => w.id === type.workflowId)!;
const NOW = '2026-11-16T09:00:00.000Z';
let n = 0;

describe('buildTask', () => {
  const t = buildTask({
    id: 'x1', type, workflow, title: '  Nộp báo cáo  ', description: ' mô tả ', priority: 'high', labels: ['hk1', ' hk1 ', '', 'bc'], startAt: null, dueAt: '2026-11-19', unitId: 'bm1',
    assigneeIds: ['an', 'an'], collaboratorIds: ['ha', 'an', 'ha'], reviewerIds: ['head1'], checklist: ['  Thu số liệu ', '', 'Nộp'], customFields: { hoc_ky: 'HK1', rac: 'xoá', so_trang_toi_da: 20 },
    templateId: null, bulkId: null, createdBy: 'head1', now: NOW, newItemId: () => `c${++n}`,
  });
  it('chuẩn hoá chuỗi, bỏ trùng, trạng thái khởi đầu theo quy trình', () => {
    expect(t.title).toBe('Nộp báo cáo');
    expect(t.stateKey).toBe('todo');
    expect(t.workflowId).toBe('duyet_2_cap');
    expect(t.labels).toEqual(['hk1', 'bc']);
    expect(t.assigneeIds).toEqual(['an']);
    expect(t.collaboratorIds).toEqual(['ha']); // người phụ trách không đồng thời là phối hợp
    expect(t.checklist.map((c) => c.text)).toEqual(['Thu số liệu', 'Nộp']);
  });
  it('participantIds là hợp của ba nhóm (Rules yêu cầu)', () => {
    expect(t.participantIds.sort()).toEqual(['an', 'ha', 'head1']);
  });
  it('chỉ giữ trường động được định nghĩa', () => {
    expect(t.customFields).toEqual({ hoc_ky: 'HK1', so_trang_toi_da: 20 });
  });
  it('không có undefined (Firestore không nhận)', () => {
    expect(JSON.stringify(t)).not.toContain('undefined');
    expect(t.completedAt).toBeNull();
  });
});

describe('transitionPatch', () => {
  const wf = cfg.workflows.find((w) => w.id === 'duyet_1_cap')!;
  it('hoàn thành đặt completedAt; rời hoàn thành đặt null', () => {
    const p = transitionPatch({ task: task({ stateKey: 'review' }), workflow: wf, to: 'done', note: '', actorId: 'head1', now: NOW, activityId: 'a1' });
    expect(p).toMatchObject({ stateKey: 'done', completedAt: NOW, statusNoteAt: NOW, lastActivityId: 'a1' });
    const q = transitionPatch({ task: task({ stateKey: 'done' }), workflow: wf, to: 'doing', note: 'Làm lại', actorId: 'head1', now: NOW, activityId: 'a2' });
    expect(q.completedAt).toBeNull();
    expect(q.statusNote).toBe('Làm lại');
  });
  it('mục nhật ký đúng định dạng Rules yêu cầu', () => {
    const p = transitionPatch({ task: task(), workflow: wf, to: 'review', note: 'ok', actorId: 'an', now: NOW, activityId: 'a3' });
    expect(p['activity.a3']).toMatchObject({ actorId: 'an', action: 'transition', createdAt: NOW });
    expect(String((p['activity.a3'] as { detail: string }).detail)).toContain('Đang làm → Chờ duyệt');
  });
  it('trạng thái không tồn tại => lỗi', () => {
    expect(() => transitionPatch({ task: task(), workflow: wf, to: 'ma', note: '', actorId: 'an', now: NOW, activityId: 'a' })).toThrow();
  });
});

describe('peoplePatch / extendPatch / activityPatch', () => {
  it('đổi người: tính lại participantIds, loại trùng phụ trách/phối hợp', () => {
    const p = peoplePatch({ assigneeIds: ['ha'], collaboratorIds: ['an', 'ha'], reviewerIds: ['head1'] }, 'head1', 'Đổi', NOW, 'a1');
    expect(p.assigneeIds).toEqual(['ha']);
    expect(p.collaboratorIds).toEqual(['an']);
    expect((p.participantIds as string[]).sort()).toEqual(['an', 'ha', 'head1']);
  });
  it('gia hạn ghi lý do vào lịch sử', () => {
    const p = extendPatch('2026-12-01', 'Chờ số liệu', '2026-11-24', 'head1', NOW, 'a2');
    expect(p.dueAt).toBe('2026-12-01');
    expect(JSON.stringify(p)).toContain('Chờ số liệu');
  });
  it('detail dài bị cắt 500 ký tự; stripUndefined', () => {
    const p = activityPatch('an', 'x', 'a'.repeat(900), NOW, 'z');
    expect((p['activity.z'] as { detail: string }).detail.length).toBe(500);
    expect(stripUndefined({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});
