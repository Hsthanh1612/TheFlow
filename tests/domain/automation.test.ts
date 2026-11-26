import { describe, expect, it } from 'vitest';
import { eventNotices, recipientsOf, renderText, scheduledNotices } from '../../src/domain/automation';
import type { Automation } from '../../src/domain/types';
import { task } from './fixtures';

const ctx = { unitHeadOf: (u: string) => (u === 'bm1' ? 'head1' : null), userName: (id: string) => id.toUpperCase() };
const rule = (over: Partial<Automation> = {}, trig: Partial<Automation['trigger']> = {}, act: Partial<Automation['action']> = {}): Automation => ({
  id: 'r1', name: 'r', enabled: true,
  trigger: { kind: 'state_changed', typeId: null, toCategory: 'review', days: 0, ...trig },
  action: { kind: 'notify', to: ['reviewers'], text: '{actor} nộp “{title}” ({state}, hạn {due})', ...act },
  createdBy: 'dean', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...over,
});

describe('recipientsOf / renderText', () => {
  it('gom người nhận không trùng, bỏ qua Trưởng đơn vị nếu chưa đặt', () => {
    const t = task({ assigneeIds: ['an'], reviewerIds: ['head1'], createdBy: 'head1' });
    expect(recipientsOf(['assignees', 'reviewers', 'creator', 'unit_head'], t, ctx).sort()).toEqual(['an', 'head1']);
    expect(recipientsOf(['unit_head'], task({ unitId: 'bm2' }), ctx)).toEqual([]);
  });
  it('thay biến và giữ nguyên biến lạ; cắt ở 300 ký tự', () => {
    expect(renderText('{title} / {actor} / {state} / {due} / {khac}', { title: 'T', actor: 'A', state: 'S', due: 'D' })).toBe('T / A / S / D / {khac}');
    expect(renderText('x'.repeat(500), { title: '', actor: '', state: '', due: '' })).toHaveLength(300);
  });
});

describe('eventNotices', () => {
  const t = task({ id: 't9', title: 'Ra đề', dueAt: '2026-11-24' });
  const evt = { type: 'state_changed' as const, task: t, toCategory: 'review' as const, toLabel: 'Chờ duyệt', actorId: 'an' };
  it('khớp trạng thái đích và báo đúng người', () => {
    expect(eventNotices([rule()], evt, ctx)).toEqual([{ userId: 'head1', text: 'AN nộp “Ra đề” (Chờ duyệt, hạn 24/11/2026)', taskId: 't9', ruleId: 'r1', key: 'r1:t9:head1' }]);
  });
  it('không khớp khi tắt, khác loại việc, khác trạng thái đích hoặc khác loại sự kiện', () => {
    expect(eventNotices([rule({ enabled: false })], evt, ctx)).toEqual([]);
    expect(eventNotices([rule({}, { typeId: 'hop' })], evt, ctx)).toEqual([]);
    expect(eventNotices([rule({}, { toCategory: 'done' })], evt, ctx)).toEqual([]);
    expect(eventNotices([rule({}, { kind: 'task_created' })], evt, ctx)).toEqual([]);
  });
  it('toCategory = null khớp mọi trạng thái; không báo cho chính người thao tác', () => {
    expect(eventNotices([rule({}, { toCategory: null })], { ...evt, toCategory: 'doing' }, ctx)).toHaveLength(1);
    expect(eventNotices([rule({}, { toCategory: null }, { to: ['assignees'] })], evt, ctx)).toEqual([]); // an là người thao tác và là người phụ trách
  });
  it('sự kiện tạo việc', () => {
    const r = rule({}, { kind: 'task_created' }, { to: ['unit_head'], text: 'Việc mới: {title}' });
    expect(eventNotices([r], { type: 'task_created', task: t, actorId: 'dean' }, ctx).map((n) => n.userId)).toEqual(['head1']);
  });
});

describe('scheduledNotices', () => {
  const open = () => true;
  const TODAY = '2026-11-18';
  it('sắp đến hạn đúng N ngày: chỉ báo cho chính người nhận, ID cố định theo mốc', () => {
    const r = rule({}, { kind: 'due_soon', days: 2 }, { to: ['assignees'], text: '{state}: {title}' });
    const ts = [task({ id: 'a', dueAt: '2026-11-20' }), task({ id: 'b', dueAt: '2026-11-21' })];
    const n = scheduledNotices([r], ts, TODAY, 'an', ctx, open);
    expect(n.map((x) => x.key)).toEqual(['r1:a:d2']);
    expect(n[0].text).toBe('Còn 2 ngày: Ra đề thi');
    expect(scheduledNotices([r], ts, TODAY, 'ha', ctx, open)).toEqual([]);
  });
  it('quá hạn: một thông báo cho mỗi việc còn mở; việc đã xong thì bỏ qua', () => {
    const r = rule({}, { kind: 'overdue' }, { to: ['assignees', 'reviewers'] });
    const ts = [task({ id: 'a', dueAt: '2026-11-10' }), task({ id: 'b', dueAt: '2026-11-10' })];
    expect(scheduledNotices([r], ts, TODAY, 'head1', ctx, (t) => t.id === 'a').map((x) => x.key)).toEqual(['r1:a:late']);
  });
});
