import { describe, expect, it } from 'vitest';
import { fold, rank, scoreMatch } from '../../src/domain/search';

const items = [
  { id: '1', title: 'Báo cáo tổng kết học kỳ 1', extra: ['Báo cáo', 'Lê Quang Cường', 'quan trọng'] },
  { id: '2', title: 'Ra đề thi Cơ sở dữ liệu', extra: ['Đề thi', 'Hoàng Minh Đức'] },
  { id: '3', title: 'Họp giao ban Khoa', extra: ['Họp', 'Nguyễn Văn An'] },
];

describe('fold', () => {
  it('bỏ dấu, đ → d, hạ chữ thường', () => {
    expect(fold('  Đề  THI Cơ sở Dữ liệu ')).toBe('de thi co so du lieu');
    expect(fold('Nguyễn Văn Ấn')).toBe('nguyen van an');
  });
});

describe('scoreMatch / rank', () => {
  it('khớp không dấu và không phân biệt hoa thường', () => {
    expect(rank('de thi', items, 5).map((x) => x.id)).toEqual(['2']);
    expect(rank('BAO CAO', items, 5).map((x) => x.id)).toEqual(['1']);
  });
  it('mọi từ khoá phải xuất hiện (AND), kể cả ở trường phụ như tên người phụ trách', () => {
    expect(rank('cuong bao', items, 5).map((x) => x.id)).toEqual(['1']);
    expect(rank('cuong hop', items, 5)).toEqual([]);
  });
  it('tiêu đề bắt đầu bằng từ khoá xếp trên khớp ở trường phụ', () => {
    const list = [{ id: 'a', title: 'Họp bộ môn', extra: [] }, { id: 'b', title: 'Báo cáo', extra: ['Họp'] }];
    expect(rank('hop', list, 5).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('rỗng hoặc không khớp thì không có kết quả; tôn trọng giới hạn', () => {
    expect(scoreMatch('', items[0])).toBe(0);
    expect(rank('zzz', items, 5)).toEqual([]);
    expect(rank('o', items, 2)).toHaveLength(2);
  });
});
