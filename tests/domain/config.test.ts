import { describe, expect, it } from 'vitest';
import { diffConfig, validateConfig } from '../../src/domain/config';
import { defaultConfig } from '../../src/domain/defaultConfig';
import { readFileSync } from 'node:fs';

const clone = () => JSON.parse(JSON.stringify(defaultConfig()));

describe('validateConfig', () => {
  it('cấu hình mặc định hợp lệ và sinh bảng allowed cho Rules', () => {
    const r = validateConfig(clone());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.workflows[0].allowed['doing>review']).toContain('assignee');
  });
  it('file config/khoa.config.json khớp cấu hình mặc định (không bị lệch)', () => {
    const file = JSON.parse(readFileSync('config/khoa.config.json', 'utf8'));
    expect(file).toEqual(JSON.parse(JSON.stringify(defaultConfig())));
  });
  it('loại việc trỏ tới quy trình không tồn tại', () => {
    const c = clone();
    c.taskTypes[0].workflowId = 'khong_co';
    const r = validateConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('quy trình không tồn tại');
  });
  it('khoá trùng, khoá sai định dạng', () => {
    const c = clone();
    c.taskTypes.push({ ...c.taskTypes[0] });
    expect(validateConfig(c).ok).toBe(false);
    const d = clone();
    d.taskTypes[0].id = 'Có Dấu';
    expect(validateConfig(d).ok).toBe(false);
  });
  it('trường select không có lựa chọn', () => {
    const c = clone();
    c.taskTypes[0].fields[0].options = [];
    expect(validateConfig(c).ok).toBe(false);
  });
  it('cây tổ chức phải có đúng một gốc và cha tồn tại', () => {
    const c = clone();
    c.units.push({ id: 'x', parentId: 'khong_co', name: 'X', kind: 'to', color: '#112233', headId: null, archived: false });
    expect(validateConfig(c).ok).toBe(false);
    const d = clone();
    d.units.push({ id: 'y', parentId: null, name: 'Y', kind: 'khoa', color: '#112233', headId: null, archived: false });
    expect(validateConfig(d).ok).toBe(false);
  });
  it('quyền không thuộc danh sách bị từ chối; kiểu sai bị từ chối; đầu vào rác', () => {
    const c = clone();
    c.roles[0].permissions.push('hack.all');
    expect(validateConfig(c).ok).toBe(false);
    expect(validateConfig({}).ok).toBe(false);
    expect(validateConfig(null).ok).toBe(false);
    expect(validateConfig('x').ok).toBe(false);
  });
  it('bước chuyển trỏ tới trạng thái không tồn tại', () => {
    const c = clone();
    c.workflows[0].transitions[0].to = 'ma';
    expect(validateConfig(c).ok).toBe(false);
  });
});

describe('diffConfig', () => {
  it('liệt kê thêm/sửa/xoá và thiết lập', () => {
    const a = validateConfig(clone());
    const raw = clone();
    raw.taskTypes.push({ id: 'kiem_dinh', name: 'Kiểm định', color: '#112233', workflowId: 'duyet_1_cap', fields: [], archived: false });
    raw.taskTypes[0].name = 'Báo cáo (đổi tên)';
    raw.taskTypes.splice(1, 1);
    raw.settings.riskDays = 5;
    const b = validateConfig(raw);
    if (!a.ok || !b.ok) throw new Error('cấu hình test sai');
    const d = diffConfig(a.config, b.config).map((x) => `${x.section}:${x.kind}:${x.id}`).sort();
    expect(d).toEqual(['settings:update:app', 'taskTypes:add:kiem_dinh', 'taskTypes:remove:de_thi', 'taskTypes:update:bao_cao']);
  });
  it('không đổi gì thì diff rỗng', () => {
    const a = validateConfig(clone());
    if (!a.ok) throw new Error('x');
    expect(diffConfig(a.config, a.config)).toEqual([]);
  });
});
