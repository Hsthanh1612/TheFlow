import { describe, expect, it } from 'vitest';
import { daysLeft, displayStatus, participantsOf, progressOf, riskOf } from '../../src/domain/taskLogic';
import { DEFAULT_SETTINGS } from '../../src/domain/types';
import { cfg, task } from './fixtures';

const wf = cfg.workflows.find((w) => w.id === 'duyet_1_cap');
const TODAY = '2026-11-16';
const items = (done: number, total: number) => Array.from({ length: total }, (_, i) => ({ id: String(i), text: 'x', done: i < done }));

describe('progressOf', () => {
  it('theo checklist, làm tròn (3/5 = 60%)', () => {
    expect(progressOf({ checklist: items(3, 5) }, 'doing')).toBe(60);
    expect(progressOf({ checklist: items(1, 3) }, 'doing')).toBe(33);
  });
  it('không checklist: xong = 100, còn lại = 0', () => {
    expect(progressOf({ checklist: [] }, 'done')).toBe(100);
    expect(progressOf({ checklist: [] }, 'doing')).toBe(0);
  });
});

describe('displayStatus / daysLeft', () => {
  it('quá hạn khi hạn < hôm nay và chưa xong', () => {
    expect(displayStatus({ dueAt: '2026-11-12' }, 'doing', TODAY)).toBe('late');
    expect(displayStatus({ dueAt: '2026-11-12' }, 'done', TODAY)).toBe('done');
  });
  it('hạn đúng hôm nay chưa quá hạn', () => {
    expect(displayStatus({ dueAt: TODAY }, 'doing', TODAY)).toBe('doing');
  });
  it('không có hạn thì không quá hạn', () => {
    expect(displayStatus({ dueAt: null }, 'todo', TODAY)).toBe('todo');
    expect(daysLeft({ dueAt: null }, TODAY)).toBeNull();
  });
  it('daysLeft đúng khi qua tháng', () => {
    expect(daysLeft({ dueAt: '2026-12-02' }, TODAY)).toBe(16);
  });
});

describe('riskOf', () => {
  const s = DEFAULT_SETTINGS;
  it('quá hạn', () => expect(riskOf(task({ dueAt: '2026-11-12' }), wf, s, TODAY)).toBe('overdue'));
  it('còn ≤3 ngày và tiến độ <50% => nguy cơ', () => {
    expect(riskOf(task({ dueAt: '2026-11-19', checklist: items(1, 5) }), wf, s, TODAY)).toBe('at_risk');
  });
  it('biên: đúng 3 ngày là nguy cơ, 4 ngày thì không', () => {
    expect(riskOf(task({ dueAt: '2026-11-19' }), wf, s, TODAY)).toBe('at_risk');
    expect(riskOf(task({ dueAt: '2026-11-20' }), wf, s, TODAY)).toBeNull();
  });
  it('biên: tiến độ đúng 50% thì không nguy cơ', () => {
    expect(riskOf(task({ dueAt: '2026-11-18', checklist: items(1, 2) }), wf, s, TODAY)).toBeNull();
  });
  it('đã xong hoặc không có hạn: không rủi ro', () => {
    expect(riskOf(task({ stateKey: 'done', dueAt: '2026-11-01' }), wf, s, TODAY)).toBeNull();
    expect(riskOf(task({ dueAt: null }), wf, s, TODAY)).toBeNull();
  });
  it('ngưỡng lấy từ cấu hình', () => {
    expect(riskOf(task({ dueAt: '2026-11-20' }), wf, { ...s, riskDays: 5 }, TODAY)).toBe('at_risk');
  });
});

describe('participantsOf', () => {
  it('gộp không trùng', () => {
    expect(participantsOf({ assigneeIds: ['a'], collaboratorIds: ['b', 'a'], reviewerIds: ['b', 'c'] }).sort()).toEqual(['a', 'b', 'c']);
  });
});
