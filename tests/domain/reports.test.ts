import { describe, expect, it } from 'vitest';
import { buildReport, REPORT_DEFINITIONS, toCsv } from '../../src/domain/reports';
import { DEFAULT_SETTINGS } from '../../src/domain/types';
import { cfg, task, units, users, wfOf } from './fixtures';

const ctx = (scope: string, tasks = [
  task({ id: '1', unitId: 'bm1', assigneeIds: ['an'], stateKey: 'done', completedAt: '2026-11-10T08:00:00.000Z', dueAt: '2026-11-12' }),
  task({ id: '2', unitId: 'bm1a', assigneeIds: ['ha'], stateKey: 'doing', dueAt: '2026-11-10' }),
  task({ id: '3', unitId: 'bm2', assigneeIds: ['lan'], stateKey: 'review', dueAt: '2026-12-20', typeId: 'bao_cao' }),
]) => ({ tasks, units, users, types: cfg.taskTypes, wfOf, settings: DEFAULT_SETTINGS, today: '2026-11-16', scopeUnitId: scope, progressOf: () => 0 });
const def = (id: string) => REPORT_DEFINITIONS.find((d) => d.id === id)!;

describe('buildReport', () => {
  it('tiến độ theo đơn vị: toàn Khoa liệt kê các đơn vị con, gộp cả đơn vị cháu', () => {
    const rows = buildReport(def('unit_progress'), ctx('khoa'));
    const bm1 = rows.find((r) => r.name === 'Bộ môn 1')!;
    expect(bm1).toMatchObject({ total: 2, done: 1, late: 1, pct: 50 });
    expect(rows.find((r) => r.name === 'Bộ môn 2')).toMatchObject({ total: 1, review: 1 });
  });
  it('phạm vi một bộ môn không lộ dữ liệu bộ môn khác', () => {
    const rows = buildReport(def('unit_progress'), ctx('bm2'));
    expect(rows.map((r) => r.name)).toEqual(['Bộ môn 2']);
    expect(buildReport(def('overdue_list'), ctx('bm2'))).toEqual([]);
  });
  it('danh sách quá hạn', () => {
    const rows = buildReport(def('overdue_list'), ctx('khoa'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ unit: 'Tổ 1A', kind: 'Quá hạn' });
  });
  it('theo loại việc bỏ loại không có việc', () => {
    const rows = buildReport(def('by_type'), ctx('khoa'));
    expect(rows.map((r) => r.name).sort()).toEqual(['Báo cáo', 'Đề thi']);
  });
  it('theo thành viên chỉ gồm người active trong phạm vi', () => {
    const rows = buildReport(def('by_member'), ctx('bm2'));
    expect(rows.map((r) => r.name).sort()).toEqual(['HEAD2', 'LAN']); // 'off' chưa kích hoạt bị loại;
  });
});

describe('toCsv', () => {
  it('có BOM, tiêu đề cột, escape dấu nháy', () => {
    const csv = toCsv(def('by_type'), [{ name: 'Họp "lớn"', total: 1, done: 0, late: 0, pct: 0 }]);
    expect(csv.startsWith('﻿"Loại việc"')).toBe(true);
    expect(csv).toContain('"Họp ""lớn"""');
  });
  it('chặn CSV injection (ô bắt đầu bằng = + - @)', () => {
    const csv = toCsv(def('by_type'), [{ name: '=HYPERLINK("http://x")', total: 0, done: 0, late: 0, pct: 0 }]);
    expect(csv).toContain(`"'=HYPERLINK`);
  });
});
