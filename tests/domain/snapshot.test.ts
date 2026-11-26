import { describe, expect, it } from 'vitest';
import { burndown, countTasks, makeSnapshot, openOf, sumCounts, weekKey } from '../../src/domain/snapshot';
import { task, wfOf } from './fixtures';

const TODAY = '2026-11-18';
const ts = [
  task({ id: 'a', stateKey: 'todo', dueAt: '2026-11-30' }),
  task({ id: 'b', stateKey: 'doing', dueAt: '2026-11-30' }),
  task({ id: 'c', stateKey: 'review', dueAt: '2026-11-30', unitId: 'bm2' }),
  task({ id: 'd', stateKey: 'done', dueAt: '2026-11-10', completedAt: '2026-11-09T05:00:00.000Z', unitId: 'bm2' }),
  task({ id: 'e', stateKey: 'doing', dueAt: '2026-11-10', unitId: 'bm2' }), // quá hạn
];

describe('snapshot', () => {
  it('countTasks phân loại như màn Tổng quan (quá hạn thay vì đang làm)', () => {
    expect(countTasks(ts, wfOf, TODAY)).toEqual({ todo: 1, doing: 1, review: 1, done: 1, late: 1 });
    expect(openOf(countTasks(ts, wfOf, TODAY))).toBe(4);
  });
  it('makeSnapshot: ID = thứ Hai đầu tuần, có số liệu theo đơn vị', () => {
    const s = makeSnapshot(ts, wfOf, TODAY, 'dean', '2026-11-18T01:00:00.000Z');
    expect(s.id).toBe('2026-11-16');
    expect(weekKey('2026-11-22')).toBe('2026-11-16');
    expect(s.byUnit.bm2).toEqual({ todo: 0, doing: 0, review: 1, done: 1, late: 1 });
    expect(s.byUnit.bm1.todo).toBe(1);
  });
  it('sumCounts cộng đúng các đơn vị được chọn', () => {
    const s = makeSnapshot(ts, wfOf, TODAY, 'dean', '2026-11-18T01:00:00.000Z');
    expect(sumCounts(s, new Set(['bm2']))).toEqual({ todo: 0, doing: 0, review: 1, done: 1, late: 1 });
    expect(sumCounts(s, '*')).toEqual(s.total);
  });
});

describe('burndown', () => {
  it('số việc còn lại cuối mỗi tuần và đường lý tưởng; tuần tương lai là null', () => {
    const cohort = [
      task({ id: '1', dueAt: '2026-11-05', completedAt: '2026-11-04T01:00:00.000Z', stateKey: 'done' }),
      task({ id: '2', dueAt: '2026-11-12', completedAt: '2026-11-17T01:00:00.000Z', stateKey: 'done' }),
      task({ id: '3', dueAt: '2026-11-26' }),
      task({ id: '4', dueAt: '2026-11-27' }),
    ];
    const b = burndown(cohort, { start: '2026-11-02', end: '2026-11-29' }, TODAY);
    expect(b.map((p) => p.week)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(b.map((p) => p.remaining)).toEqual([3, 3, 2, null]);
    expect(b.map((p) => p.ideal)).toEqual([3, 2, 1, 0]);
  });
  it('kỳ không có việc: toàn 0, không lỗi', () => {
    expect(burndown([], { start: '2026-11-02', end: '2026-11-08' }, TODAY)).toEqual([{ week: '2026-11-02', remaining: 0, ideal: 0 }]);
  });
});
