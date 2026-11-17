import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isValidDay, parseDay, todayLocal, weekStart } from '../../src/domain/dates';

describe('dates', () => {
  it('addDays qua tháng/năm/năm nhuận', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffDays', () => {
    expect(diffDays('2026-11-19', '2026-11-16')).toBe(3);
    expect(diffDays('2026-11-12', '2026-11-16')).toBe(-4);
  });
  it('weekStart là thứ Hai (CN thuộc tuần trước)', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // Thứ Hai
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Chủ nhật
    expect(weekStart('2026-11-18')).toBe('2026-11-16');
  });
  it('ngày không hợp lệ', () => {
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('2026-13-01')).toBe(false);
    expect(isValidDay('hôm nay')).toBe(false);
    expect(() => parseDay('2026-1-1')).toThrow();
  });
  it('todayLocal dùng ngày địa phương', () => {
    expect(todayLocal(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
  });
});
