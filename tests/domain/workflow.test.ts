import { describe, expect, it } from 'vitest';
import { allowedTargets, buildAllowedMap, checkTransition, firstReachableInCategory, validateWorkflow } from '../../src/domain/workflow';
import { cfg, principal, task, users } from './fixtures';

const P = (uid: string) => principal(users.find((u) => u.uid === uid)!);
const wf1 = cfg.workflows.find((w) => w.id === 'duyet_1_cap')!;
const wf2 = cfg.workflows.find((w) => w.id === 'duyet_2_cap')!;

describe('checkTransition', () => {
  it('người phụ trách nộp để duyệt: doing → review', () => {
    expect(checkTransition(wf1, task(), 'review', P('an')).ok).toBe(true);
  });
  it('người khác không liên quan không được chuyển trạng thái', () => {
    const r = checkTransition(wf1, task(), 'review', P('lan'));
    expect(r.ok).toBe(false);
  });
  it('người phụ trách không tự duyệt xong việc của mình', () => {
    expect(checkTransition(wf1, task({ stateKey: 'review' }), 'done', P('an')).ok).toBe(false);
  });
  it('người duyệt duyệt được; trả lại bắt buộc ý kiến', () => {
    const t = task({ stateKey: 'review' });
    expect(checkTransition(wf1, t, 'done', P('head1'))).toMatchObject({ ok: true, requiresComment: false });
    expect(checkTransition(wf1, t, 'doing', P('head1'))).toMatchObject({ ok: true, requiresComment: true });
  });
  it('Trưởng bộ môn khác đơn vị không duyệt được', () => {
    expect(checkTransition(wf1, task({ stateKey: 'review', reviewerIds: ['head1'] }), 'done', P('head2')).ok).toBe(false);
  });
  it('bước không có trong quy trình bị từ chối', () => {
    expect(checkTransition(wf1, task({ stateKey: 'todo' }), 'done', P('dean')).ok).toBe(false);
  });
  it('cùng trạng thái bị từ chối', () => {
    expect(checkTransition(wf1, task(), 'doing', P('an')).ok).toBe(false);
  });
  it('duyệt 2 cấp: bước cuối chỉ Trưởng khoa (toàn Khoa)', () => {
    const t = task({ typeId: 'bao_cao', stateKey: 'dean_review' });
    expect(checkTransition(wf2, t, 'done', P('head1')).ok).toBe(false);
    expect(checkTransition(wf2, t, 'done', P('dean')).ok).toBe(true);
  });
  it('tài khoản chưa kích hoạt bị từ chối', () => {
    expect(checkTransition(wf1, task(), 'review', { ...P('an'), active: false }).ok).toBe(false);
  });
});

describe('allowedTargets / firstReachableInCategory', () => {
  it('liệt kê đúng đích cho người phụ trách', () => {
    const keys = allowedTargets(wf1, task(), P('an')).map((x) => x.state.key).sort();
    expect(keys).toEqual(['review', 'todo']);
  });
  it('tìm trạng thái đầu tiên theo nhóm', () => {
    expect(firstReachableInCategory(wf2, task({ typeId: 'bao_cao', stateKey: 'doing' }), 'review', P('an'))?.key).toBe('bm_review');
    expect(firstReachableInCategory(wf2, task({ typeId: 'bao_cao', stateKey: 'doing' }), 'done', P('an'))).toBeNull();
  });
});

describe('buildAllowedMap / validateWorkflow', () => {
  it('gộp kinds theo "from>to"', () => {
    const m = buildAllowedMap([
      { from: 'a', to: 'b', allowed: ['assignee'], requiresComment: false },
      { from: 'a', to: 'b', allowed: ['assignee', 'reviewer'], requiresComment: false },
    ]);
    expect(m['a>b']).toEqual(['assignee', 'reviewer']);
  });
  it('phát hiện quy trình sai', () => {
    expect(validateWorkflow({ initialState: 'x', states: [{ key: 'a', label: 'A', category: 'todo' }], transitions: [] }).length).toBeGreaterThan(0);
    const errs = validateWorkflow({
      initialState: 'a',
      states: [{ key: 'a', label: 'A', category: 'todo' }, { key: 'b', label: 'B', category: 'doing' }],
      transitions: [{ from: 'a', to: 'z', allowed: ['assignee'], requiresComment: false }],
    });
    expect(errs.join()).toContain('không tồn tại');
    expect(errs.join()).toContain('Hoàn thành');
  });
  it('cấu hình mặc định hợp lệ', () => {
    for (const w of cfg.workflows) expect(validateWorkflow(w)).toEqual([]);
  });
});
