import { describe, expect, it } from 'vitest';
import { dueOccurrences, recurringDocId } from '../../src/domain/recurrence';

const terms = [{ id: 'hk1_2026', name: 'HK1', startDate: '2026-11-10', endDate: '2027-01-20' }];

describe('dueOccurrences', () => {
  it('không hoạt động => rỗng', () => {
    expect(dueOccurrences({ kind: 'weekly', active: false }, '2026-11-16', [])).toEqual([]);
  });
  it('hằng tuần: các tuần bắt đầu trong cửa sổ, khoá ổn định (chạy lại không đổi)', () => {
    const a = dueOccurrences({ kind: 'weekly', active: true }, '2026-11-16', [], 14);
    expect(a.map((o) => o.key)).toEqual(['w2026-11-02', 'w2026-11-09', 'w2026-11-16']);
    expect(dueOccurrences({ kind: 'weekly', active: true }, '2026-11-16', [], 14)).toEqual(a);
  });
  it('hằng tháng: ngày mùng 1 trong cửa sổ', () => {
    expect(dueOccurrences({ kind: 'monthly', active: true }, '2026-12-03', [], 14).map((o) => o.key)).toEqual(['m2026-12']);
    expect(dueOccurrences({ kind: 'monthly', active: true }, '2026-12-20', [], 14)).toEqual([]);
  });
  it('mỗi học kỳ: ngày bắt đầu kỳ trong cửa sổ', () => {
    expect(dueOccurrences({ kind: 'term', active: true }, '2026-11-16', terms, 14).map((o) => o.key)).toEqual(['thk1_2026']);
    expect(dueOccurrences({ kind: 'term', active: true }, '2026-12-16', terms, 14)).toEqual([]);
  });
  it('ID tài liệu xác định => idempotent', () => {
    const tpl = { id: 'tpl1' } as never;
    expect(recurringDocId(tpl, { key: 'w2026-11-16', startDay: '2026-11-16' })).toBe('rec_tpl1_w2026-11-16');
  });
});
