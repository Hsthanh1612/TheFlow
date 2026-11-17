import { describe, expect, it } from 'vitest';
import { monthGrid, shiftMonth } from '../../src/domain/calendar';
import { holidayOn } from '../../src/domain/holidays';

describe('monthGrid', () => {
  it('tháng 11/2026 bắt đầu thứ Hai 26/10 và kết thúc 06/12 (42 ô), đúng như mockup', () => {
    const g = monthGrid(2026, 11);
    expect(g[0].day).toBe('2026-10-26');
    expect(g).toHaveLength(42);
    expect(g[g.length - 1].day).toBe('2026-12-06');
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(g[6].day).toBe('2026-11-01'); // Chủ nhật 1/11
  });
  it('tháng bắt đầu đúng thứ Hai không có ô thừa phía trước', () => {
    expect(monthGrid(2026, 6)[0].day).toBe('2026-06-01');
  });
  it('luôn là bội số của 7 và qua năm', () => {
    for (let m = 1; m <= 12; m++) expect(monthGrid(2027, m).length % 7).toBe(0);
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('holidayOn', () => {
  it('nhận ngày cố định, bỏ qua ngày thường', () => {
    expect(holidayOn('2026-11-20')).toBe('Ngày Nhà giáo VN');
    expect(holidayOn('2026-11-21')).toBeNull();
  });
});

import { timelineSpan } from '../../src/domain/timeline';

describe('timelineSpan', () => {
  const ws = '2026-10-26'; // cửa sổ 8 tuần, tuần hiện tại 16/11 là cột 3
  it('trong cửa sổ', () => {
    expect(timelineSpan('2026-11-02', '2026-11-19', ws, 8)).toEqual({ firstCol: 1, lastCol: 3 });
  });
  it('cắt theo biên cửa sổ', () => {
    expect(timelineSpan('2026-09-01', '2026-11-02', ws, 8)).toEqual({ firstCol: 0, lastCol: 1 });
    expect(timelineSpan('2026-12-14', '2027-02-01', ws, 8)).toEqual({ firstCol: 7, lastCol: 7 });
  });
  it('ngoài cửa sổ hoặc không có hạn => null', () => {
    expect(timelineSpan('2026-01-01', '2026-02-01', ws, 8)).toBeNull();
    expect(timelineSpan('2027-03-01', '2027-04-01', ws, 8)).toBeNull();
    expect(timelineSpan('2026-11-01', null, ws, 8)).toBeNull();
  });
  it('bắt đầu sau hạn => coi như một ngày tại hạn', () => {
    expect(timelineSpan('2026-12-01', '2026-11-19', ws, 8)).toEqual({ firstCol: 3, lastCol: 3 });
  });
});
