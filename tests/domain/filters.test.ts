import { describe, expect, it } from 'vitest';
import { applyFilter, EMPTY_FILTER, sortByDue } from '../../src/domain/filters';
import { descendantIds } from '../../src/domain/permissions';
import { task, units, wfOf } from './fixtures';

const TODAY = '2026-11-16';
const ts = [
  task({ id: '1', title: 'Họp bộ môn tháng 11', typeId: 'hop', unitId: 'bm1', dueAt: '2026-11-18', assigneeIds: ['an'], labels: ['hk1'] }),
  task({ id: '2', title: 'Ra đề thi', typeId: 'de_thi', unitId: 'bm1a', dueAt: '2026-11-10', assigneeIds: ['ha'] }),
  task({ id: '3', title: 'Đăng ký NCKH', typeId: 'nckh', unitId: 'bm2', dueAt: null, assigneeIds: ['lan'] }),
  task({ id: '4', title: 'Xong rồi', typeId: 'de_thi', unitId: 'bm2', dueAt: '2026-11-01', stateKey: 'done', assigneeIds: ['lan'] }),
];
const run = (f: Partial<typeof EMPTY_FILTER>) => applyFilter(ts, { ...EMPTY_FILTER, ...f }, wfOf, TODAY, (id) => descendantIds(units, id)).map((t) => t.id);

describe('applyFilter', () => {
  it('không lọc trả về tất cả', () => expect(run({})).toEqual(['1', '2', '3', '4']));
  it('lọc theo đơn vị gồm đơn vị con', () => expect(run({ unitId: 'bm1' })).toEqual(['1', '2']));
  it('lọc theo người phụ trách, loại việc, nhãn', () => {
    expect(run({ assigneeId: 'lan' })).toEqual(['3', '4']);
    expect(run({ typeId: 'de_thi' })).toEqual(['2', '4']);
    expect(run({ label: 'hk1' })).toEqual(['1']);
  });
  it('tìm theo tiêu đề không phân biệt dấu/hoa thường (kể cả đ)', () => {
    expect(run({ text: 'hop bo mon' })).toEqual(['1']);
    expect(run({ text: 'DE THI' })).toEqual(['2']);
    expect(run({ text: 'dang ky' })).toEqual(['3']);
  });
  it('lọc theo hạn', () => {
    expect(run({ due: 'overdue' })).toEqual(['2']); // việc đã xong không tính quá hạn
    expect(run({ due: 'week' })).toEqual(['1']);
    expect(run({ due: 'none' })).toEqual(['3']);
    expect(run({ due: 'month' })).toEqual(['1', '2', '4']);
  });
});

describe('sortByDue', () => {
  it('việc không hạn xuống cuối', () => {
    expect(sortByDue(ts).map((t) => t.id)).toEqual(['4', '2', '1', '3']);
  });
});
