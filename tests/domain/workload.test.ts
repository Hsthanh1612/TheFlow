import { describe, expect, it } from 'vitest';
import { loadLevel, workloadRows } from '../../src/domain/workload';
import { task, wfOf } from './fixtures';

const TODAY = '2026-11-18'; // thứ Tư; tuần bắt đầu 2026-11-16
const rows = (ts: ReturnType<typeof task>[]) => workloadRows(ts, ['an', 'ha'], wfOf, TODAY, 4);

describe('workloadRows', () => {
  it('quy điểm theo ưu tiên và dồn vào tuần đến hạn', () => {
    const r = rows([
      task({ id: 'a', dueAt: '2026-11-20', priority: 'high' }), // tuần 0: 3 điểm
      task({ id: 'b', dueAt: '2026-11-25', priority: 'normal' }), // tuần 1: 2 điểm
      task({ id: 'c', dueAt: '2026-12-09', priority: 'low' }), // tuần 3: 1 điểm
    ]).find((x) => x.userId === 'an')!;
    expect(r.weeks.map((w) => w.points)).toEqual([3, 2, 0, 1]);
    expect(r.open).toBe(3);
    expect(r.points).toBe(6);
    expect(r.weeks[0].week).toBe('2026-11-16');
  });
  it('việc quá hạn dồn vào tuần này và được đếm riêng; việc không hạn chỉ đếm vào "chưa có hạn"', () => {
    const r = rows([task({ id: 'a', dueAt: '2026-11-10' }), task({ id: 'b', dueAt: null })]).find((x) => x.userId === 'an')!;
    expect(r.overdue).toBe(1);
    expect(r.undated).toBe(1);
    expect(r.weeks[0].tasks).toBe(1);
    expect(r.open).toBe(2);
  });
  it('bỏ việc đã xong; việc hạn xa hơn khung nhìn vẫn tính là đang mở nhưng không vào tuần nào', () => {
    const r = rows([task({ id: 'a', stateKey: 'done', completedAt: '2026-11-17T01:00:00.000Z' }), task({ id: 'b', dueAt: '2027-03-01' })]).find((x) => x.userId === 'an')!;
    expect(r.open).toBe(1);
    expect(r.points).toBe(0);
  });
  it('chỉ tính người phụ trách (không tính người duyệt/phối hợp) và chỉ những người được yêu cầu', () => {
    const r = rows([task({ id: 'a', assigneeIds: ['ha'], collaboratorIds: ['an'], reviewerIds: ['head1'] })]);
    expect(r.find((x) => x.userId === 'an')!.open).toBe(0);
    expect(r.find((x) => x.userId === 'ha')!.open).toBe(1);
    expect(r.some((x) => x.userId === 'head1')).toBe(false);
  });
});

describe('loadLevel', () => {
  it('phân mức theo ngưỡng', () => {
    expect([0, 5, 8, 9].map((p) => loadLevel(p, 8))).toEqual(['free', 'ok', 'high', 'over']);
  });
});
