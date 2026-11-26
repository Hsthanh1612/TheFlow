import { describe, expect, it } from 'vitest';
import { goalHealth, goalProgress, krPercent } from '../../src/domain/goals';
import { task } from './fixtures';

const kr = (current: number, target: number) => ({ id: 'k', text: 'x', current, target, unit: '' });
const done = (t: { stateKey: string }) => t.stateKey === 'done';

describe('krPercent', () => {
  it('kẹp 0–100 và không chia cho 0', () => {
    expect(krPercent(kr(1, 3))).toBe(33);
    expect(krPercent(kr(5, 3))).toBe(100);
    expect(krPercent(kr(-2, 3))).toBe(0);
    expect(krPercent(kr(1, 0))).toBe(0);
  });
});

describe('goalProgress', () => {
  const tasks = new Map([['t1', task({ id: 't1', stateKey: 'done' })], ['t2', task({ id: 't2' })]]);
  it('có KR: lấy trung bình KR; đồng thời báo tiến độ theo việc', () => {
    const p = goalProgress({ keyResults: [kr(1, 2), kr(3, 3)], taskIds: ['t1', 't2'] }, tasks, done);
    expect(p).toMatchObject({ pct: 75, krPct: 75, taskPct: 50, tasksDone: 1, tasksTotal: 2, missingTasks: 0 });
  });
  it('không có KR: theo việc liên kết; việc không thấy được thì báo riêng, không tính vào phần trăm', () => {
    const p = goalProgress({ keyResults: [], taskIds: ['t1', 't2', 'ngoai'] }, tasks, done);
    expect(p).toMatchObject({ pct: 50, krPct: null, tasksTotal: 2, missingTasks: 1 });
  });
  it('không có gì để đo: 0%', () => {
    expect(goalProgress({ keyResults: [], taskIds: [] }, tasks, done).pct).toBe(0);
  });
});

describe('goalHealth', () => {
  const g = (over: object = {}) => ({ status: 'active' as const, dueDate: '2026-12-01', createdAt: '2026-11-01T00:00:00.000Z', ...over });
  it('hoàn thành khi xong hoặc đạt 100%', () => {
    expect(goalHealth(g({ status: 'done' }), 10, '2026-11-10')).toBe('done');
    expect(goalHealth(g(), 100, '2026-11-10')).toBe('done');
  });
  it('quá hạn; chưa đặt hạn', () => {
    expect(goalHealth(g(), 50, '2026-12-05')).toBe('late');
    expect(goalHealth(g({ dueDate: null }), 50, '2026-12-05')).toBe('no_deadline');
  });
  it('so với kế hoạch tuyến tính: giữa kỳ (50% thời gian) mà mới 20% là có nguy cơ, 40% là đúng tiến độ', () => {
    expect(goalHealth(g(), 20, '2026-11-16')).toBe('at_risk');
    expect(goalHealth(g(), 40, '2026-11-16')).toBe('on_track');
  });
});
