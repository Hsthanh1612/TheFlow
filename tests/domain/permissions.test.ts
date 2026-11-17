import { describe, expect, it } from 'vitest';
import { computeScopes, descendantIds, hasAnyScope, hasGlobalPerm, hasPerm, scopeUnits } from '../../src/domain/permissions';
import { cfg, principal, units, users } from './fixtures';

describe('descendantIds', () => {
  it('gồm chính nó và mọi đơn vị con nhiều cấp', () => {
    expect(descendantIds(units, 'bm1').sort()).toEqual(['bm1', 'bm1a']);
    expect(descendantIds(units, 'khoa').sort()).toEqual(['bm1', 'bm1a', 'bm2', 'gv', 'khoa']);
  });
  it('không lặp vô hạn khi dữ liệu có vòng parentId', () => {
    const loop = [
      { ...units[1], parentId: 'bm1a' },
      { ...units[3], parentId: 'bm1' },
    ];
    expect(descendantIds(loop, 'bm1').sort()).toEqual(['bm1', 'bm1a']);
  });
});

describe('computeScopes', () => {
  it('vai trò ở đơn vị gốc => phạm vi toàn Khoa (*)', () => {
    const s = computeScopes([{ roleKey: 'truong_khoa', unitId: 'khoa' }], cfg.roles, units);
    expect(s['task.approve']).toEqual(['*']);
  });
  it('vai trò ở bộ môn => bộ môn và đơn vị con', () => {
    const s = computeScopes([{ roleKey: 'truong_bo_mon', unitId: 'bm1' }], cfg.roles, units);
    expect(s['task.approve']).toEqual(['bm1', 'bm1a']);
    expect(s['config.edit']).toBeUndefined();
  });
  it('gộp nhiều vai trò, bỏ vai trò/đơn vị không tồn tại hoặc đã lưu trữ', () => {
    const s = computeScopes(
      [
        { roleKey: 'truong_bo_mon', unitId: 'bm1' },
        { roleKey: 'giao_vu', unitId: 'gv' },
        { roleKey: 'khong_co', unitId: 'bm2' },
        { roleKey: 'giao_vu', unitId: 'khong_co' },
      ],
      cfg.roles,
      units,
    );
    expect(s['task.view_all']).toEqual(['bm1', 'bm1a', 'gv']);
  });
  it('giảng viên không có quyền quản lý nào', () => {
    expect(computeScopes([{ roleKey: 'giang_vien', unitId: 'bm1' }], cfg.roles, units)).toEqual({});
  });
});

describe('hasPerm', () => {
  const head1 = principal(users.find((u) => u.uid === 'head1')!);
  const dean = principal(users.find((u) => u.uid === 'dean')!);
  it('Trưởng bộ môn chỉ có quyền trong đơn vị mình', () => {
    expect(hasPerm(head1, 'task.approve', 'bm1')).toBe(true);
    expect(hasPerm(head1, 'task.approve', 'bm1a')).toBe(true);
    expect(hasPerm(head1, 'task.approve', 'bm2')).toBe(false);
    expect(hasGlobalPerm(head1, 'task.approve')).toBe(false);
  });
  it('Trưởng khoa có quyền mọi đơn vị', () => {
    expect(hasPerm(dean, 'task.approve', 'bm2')).toBe(true);
    expect(scopeUnits(dean, 'manage.view')).toBe('*');
  });
  it('tài khoản chưa kích hoạt hoặc null không có quyền nào, kể cả admin', () => {
    expect(hasPerm(null, 'task.approve', 'bm1')).toBe(false);
    expect(hasPerm({ ...dean, active: false }, 'task.approve', 'bm1')).toBe(false);
    expect(hasPerm({ uid: 'x', isAdmin: true, scopes: {}, active: false }, 'config.edit', null)).toBe(false);
  });
  it('quản trị viên có mọi quyền', () => {
    const adm = { uid: 'a', isAdmin: true, scopes: {}, active: true };
    expect(hasPerm(adm, 'config.edit', null)).toBe(true);
    expect(hasAnyScope(adm, 'user.manage')).toBe(true);
  });
  it('unitId null chỉ chấp nhận quyền toàn Khoa', () => {
    expect(hasPerm(head1, 'task.approve', null)).toBe(false);
  });
});
