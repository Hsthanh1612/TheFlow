import { describe, expect, it } from 'vitest';
import { elapsedMinutes, entriesInPeriod, formatClock, formatMinutes, groupMinutes, parseDuration, sumMinutes, toHours } from '../../src/domain/time';

describe('elapsedMinutes', () => {
  it('làm tròn, tối thiểu 1 phút, tối đa 24 giờ', () => {
    expect(elapsedMinutes('2026-11-16T08:00:00.000Z', '2026-11-16T09:30:20.000Z')).toBe(90);
    expect(elapsedMinutes('2026-11-16T08:00:00.000Z', '2026-11-16T08:00:10.000Z')).toBe(1);
    expect(elapsedMinutes('2026-11-16T08:00:00.000Z', '2026-11-20T08:00:00.000Z')).toBe(1440);
    expect(elapsedMinutes('2026-11-16T09:00:00.000Z', '2026-11-16T08:00:00.000Z')).toBe(1); // đồng hồ lùi
  });
});

describe('định dạng', () => {
  it('formatMinutes / toHours / formatClock', () => {
    expect(formatMinutes(0)).toBe('0 phút');
    expect(formatMinutes(45)).toBe('45 phút');
    expect(formatMinutes(120)).toBe('2 giờ');
    expect(formatMinutes(135)).toBe('2 giờ 15 phút');
    expect(toHours(90)).toBe(1.5);
    expect(formatClock(3725)).toBe('01:02:05');
  });
});

describe('parseDuration', () => {
  it('hiểu các kiểu nhập thông dụng', () => {
    const cases: [string, number][] = [['90', 90], ['1:30', 90], ['1h30', 90], ['1g30p', 90], ['1.5h', 90], ['1,5 giờ', 90], ['45p', 45], ['45 phút', 45], ['2 giờ 15 phút', 135], [' 2H ', 120]];
    for (const [s, m] of cases) expect(parseDuration(s), s).toBe(m);
  });
  it('từ chối rỗng, 0, vượt 24 giờ và chuỗi vô nghĩa', () => {
    for (const s of ['', '0', '1441', '25h', 'abc', '-5', '1h60x']) expect(parseDuration(s), s).toBeNull();
  });
});

describe('tổng hợp', () => {
  const es = [{ day: '2026-11-16', minutes: 30, userId: 'a' }, { day: '2026-11-17', minutes: 60, userId: 'b' }, { day: '2026-11-30', minutes: 15, userId: 'a' }];
  it('sumMinutes / groupMinutes / entriesInPeriod', () => {
    expect(sumMinutes(es)).toBe(105);
    expect([...groupMinutes(es, (e) => e.userId)]).toEqual([['a', 45], ['b', 60]]);
    expect(entriesInPeriod(es, { start: '2026-11-16', end: '2026-11-22' })).toHaveLength(2);
  });
});
