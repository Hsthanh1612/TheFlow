import { describe, expect, it } from 'vitest';
import { commonUnit, MAX_BULK_TASKS, planBulkAssign } from '../../src/domain/assign';
import { units, users } from './fixtures';

describe('commonUnit', () => {
  it('tổ tiên chung thấp nhất', () => {
    expect(commonUnit(units, ['bm1', 'bm1a'])).toBe('bm1');
    expect(commonUnit(units, ['bm1a', 'bm2'])).toBe('khoa');
    expect(commonUnit(units, ['bm2'])).toBe('bm2');
    expect(commonUnit(units, [])).toBeNull();
  });
});

describe('planBulkAssign — mỗi người một việc', () => {
  it('mỗi người nhận một việc, đúng đơn vị, người duyệt là Trưởng đơn vị', () => {
    const p = planBulkAssign({ mode: 'each', userIds: ['an', 'lan'], unitIds: [], reviewerMode: 'unit_head' }, users, units);
    expect(p.errors).toEqual([]);
    expect(p.drafts.map((d) => [d.assigneeIds[0], d.unitId, d.reviewerIds])).toEqual([['an', 'bm1', ['head1']], ['lan', 'bm2', ['head2']]]);
  });
  it('Trưởng bộ môn tự nhận việc thì lên cấp trên duyệt (không tự duyệt)', () => {
    const p = planBulkAssign({ mode: 'each', userIds: ['head1'], unitIds: [], reviewerMode: 'unit_head' }, users, units);
    expect(p.drafts[0].reviewerIds).toEqual(['dean']);
  });
  it('tổ không có trưởng => dùng trưởng đơn vị cha', () => {
    const p = planBulkAssign({ mode: 'each', userIds: ['ha'], unitIds: [], reviewerMode: 'unit_head' }, users, units);
    expect(p.drafts[0].reviewerIds).toEqual(['head1']);
  });
  it('tick cả đơn vị bung ra toàn bộ thành viên (gồm đơn vị con), không trùng với người chọn lẻ', () => {
    const p = planBulkAssign({ mode: 'each', userIds: ['an'], unitIds: ['bm1'], reviewerMode: 'none' }, users, units);
    expect(p.drafts.map((d) => d.assigneeIds[0]).sort()).toEqual(['an', 'ha', 'head1']);
    expect(p.drafts.every((d) => d.reviewerIds.length === 0)).toBe(true);
  });
  it('bỏ qua người chưa kích hoạt, chưa có đơn vị, không tồn tại — và nói rõ lý do', () => {
    const p = planBulkAssign({ mode: 'each', userIds: ['off', 'nounit', 'ghost', 'an'], unitIds: [], reviewerMode: 'none' }, users, units);
    expect(p.drafts).toHaveLength(1);
    expect(p.skipped.map((s) => s.reason).join('|')).toMatch(/chưa được kích hoạt.*Chưa thuộc đơn vị.*Không tìm thấy/);
  });
  it('không người nhận => lỗi', () => {
    expect(planBulkAssign({ mode: 'each', userIds: [], unitIds: [], reviewerMode: 'none' }, users, units).errors).toHaveLength(1);
  });
});

describe('planBulkAssign — việc chung', () => {
  it('một việc, người đầu phụ trách, còn lại phối hợp, đơn vị là tổ tiên chung', () => {
    const p = planBulkAssign({ mode: 'shared', userIds: ['an', 'lan', 'ha'], unitIds: [], reviewerMode: 'dean' }, users, units);
    expect(p.drafts).toHaveLength(1);
    expect(p.drafts[0]).toMatchObject({ unitId: 'khoa', assigneeIds: ['an'], collaboratorIds: ['lan', 'ha'], reviewerIds: ['dean'] });
  });
});

describe('planBulkAssign — mỗi đơn vị một việc', () => {
  it('giao cho Trưởng đơn vị; đơn vị chưa có trưởng bị bỏ qua có báo lý do', () => {
    const p = planBulkAssign({ mode: 'unit', userIds: [], unitIds: ['bm1', 'bm2', 'gv', 'bm1'], reviewerMode: 'dean' }, users, units);
    expect(p.drafts.map((d) => [d.unitId, d.assigneeIds[0]])).toEqual([['bm1', 'head1'], ['bm2', 'head2']]);
    expect(p.skipped[0].label).toBe('Tổ giáo vụ');
  });
});

describe('giới hạn', () => {
  it(`quá ${MAX_BULK_TASKS} việc bị chặn`, () => {
    const many = Array.from({ length: MAX_BULK_TASKS + 1 }, (_, i) => ({ ...users[3], uid: `u${i}`, name: `U${i}` }));
    const p = planBulkAssign({ mode: 'each', userIds: many.map((u) => u.uid), unitIds: [], reviewerMode: 'none' }, many, units);
    expect(p.errors.join()).toContain('Tối đa');
  });
});
