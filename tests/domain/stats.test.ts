import { describe, expect, it } from 'vitest';
import { breakdown, lastWeeksPeriod, memberStats, pct, riskList, weeklySeries, weekStarts } from '../../src/domain/stats';
import { DEFAULT_SETTINGS } from '../../src/domain/types';
import { task, wfOf } from './fixtures';

const TODAY = '2026-11-16';

describe('period / weeks', () => {
  it('N tuần gần nhất gồm cả tuần hiện tại', () => {
    const p = lastWeeksPeriod(TODAY, 4);
    expect(p).toEqual({ start: '2026-10-26', end: '2026-11-22' });
    expect(weekStarts(p)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
  });
});

describe('weeklySeries', () => {
  const period = { start: '2026-11-02', end: '2026-11-22' };
  const mk = (id: string, due: string, completed: string | null, created = '2026-10-30T08:00:00.000Z') =>
    task({ id, dueAt: due, stateKey: completed ? 'done' : 'doing', completedAt: completed, createdAt: created });
  const tasks = [
    mk('a', '2026-11-05', '2026-11-04T10:00:00.000Z'), // xong đúng hạn tuần 1
    mk('b', '2026-11-12', '2026-11-13T10:00:00.000Z'), // xong tuần 2
    mk('c', '2026-11-20', null), // chưa xong
    mk('d', '2026-11-21', null),
    mk('out', '2026-12-30', null), // ngoài kỳ => không thuộc cohort
  ];
  const s = weeklySeries(tasks, period);
  it('cộng dồn % hoàn thành theo tuần trên cohort có hạn trong kỳ', () => {
    expect(s.map((x) => x.actualPct)).toEqual([25, 50, 50]);
  });
  it('đường kế hoạch = % việc đã đến hạn', () => {
    expect(s.map((x) => x.planPct)).toEqual([25, 50, 100]);
  });
  it('đếm hoàn thành và tạo mới theo tuần', () => {
    expect(s.map((x) => x.done)).toEqual([1, 1, 0]);
    expect(s[0].created).toBe(0);
  });
  it('kỳ không có việc: 0% và không chia cho 0', () => {
    expect(weeklySeries([], period).every((p) => p.actualPct === 0 && p.planPct === 0)).toBe(true);
  });
});

describe('breakdown / pct', () => {
  it('phân loại: quá hạn tách riêng khỏi đang làm/chờ duyệt', () => {
    const tasks = [
      task({ id: '1', stateKey: 'done' }),
      task({ id: '2', stateKey: 'doing', dueAt: '2026-11-30' }),
      task({ id: '3', stateKey: 'review', dueAt: '2026-11-30' }),
      task({ id: '4', stateKey: 'doing', dueAt: '2026-11-01' }),
      task({ id: '5', stateKey: 'todo', dueAt: null }),
    ];
    expect(breakdown(tasks, wfOf, TODAY)).toEqual({ total: 5, done: 1, doing: 1, review: 1, late: 1, todo: 1 });
  });
  it('pct làm tròn và xử lý tổng 0', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(0, 0)).toBe(0);
  });
});

describe('memberStats', () => {
  it('tỉ lệ đúng hạn trên số việc đã xong; null nếu chưa xong việc nào', () => {
    const tasks = [
      task({ id: '1', assigneeIds: ['an'], stateKey: 'done', dueAt: '2026-11-10', completedAt: '2026-11-09T09:00:00.000Z' }),
      task({ id: '2', assigneeIds: ['an'], stateKey: 'done', dueAt: '2026-11-10', completedAt: '2026-11-11T09:00:00.000Z' }),
      task({ id: '3', assigneeIds: ['an'], stateKey: 'doing', dueAt: '2026-11-01' }),
      task({ id: '4', assigneeIds: ['lan'], stateKey: 'doing', dueAt: '2026-11-30' }),
    ];
    const rows = memberStats(tasks, ['an', 'lan', 'ha'], wfOf, TODAY);
    expect(rows[0]).toMatchObject({ userId: 'an', done: 2, late: 1, onTimeRate: 50 });
    expect(rows[1]).toMatchObject({ doing: 1, onTimeRate: null });
    expect(rows[2]).toMatchObject({ doing: 0, done: 0, late: 0, onTimeRate: null });
  });
  it('xong đúng ngày hạn vẫn là đúng hạn', () => {
    const t = task({ stateKey: 'done', dueAt: '2026-11-10', completedAt: '2026-11-10T23:30:00.000Z' });
    expect(memberStats([t], ['an'], wfOf, TODAY)[0].onTimeRate).toBe(100);
  });
});

describe('riskList', () => {
  it('sắp theo hạn, gắn loại rủi ro', () => {
    const tasks = [task({ id: 'x', dueAt: '2026-11-18' }), task({ id: 'y', dueAt: '2026-11-10' }), task({ id: 'z', dueAt: '2027-01-01' })];
    const r = riskList(tasks, wfOf, DEFAULT_SETTINGS, TODAY);
    expect(r.map((x) => [x.task.id, x.kind])).toEqual([['y', 'overdue'], ['x', 'at_risk']]);
  });
});
