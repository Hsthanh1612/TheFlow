import type { Assignment, OrgUnit, PermKey, Role, Scopes, UserProfile } from './types';

export const ROOT_SCOPE = '*';

/** unitId + toàn bộ đơn vị con (không lặp, chống vòng lặp parentId). */
export function descendantIds(units: OrgUnit[], unitId: string): string[] {
  const out = new Set<string>([unitId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of units) {
      if (u.parentId && out.has(u.parentId) && !out.has(u.id)) {
        out.add(u.id);
        grew = true;
      }
    }
  }
  return [...out];
}

export function rootUnit(units: OrgUnit[]): OrgUnit | undefined {
  return units.find((u) => u.parentId === null && !u.archived);
}

/**
 * Tính bản denormalized `scopes` lưu trên hồ sơ người dùng để Firestore Rules kiểm tra được
 * (Rules không có lambda). Vai trò gán ở đơn vị gốc => '*'.
 */
export function computeScopes(assignments: Assignment[], roles: Role[], units: OrgUnit[]): Scopes {
  const root = rootUnit(units);
  const sets: Partial<Record<PermKey, Set<string>>> = {};
  for (const a of assignments) {
    const role = roles.find((r) => r.key === a.roleKey && !r.archived);
    if (!role) continue;
    const unit = units.find((u) => u.id === a.unitId && !u.archived);
    if (!unit) continue;
    const ids = root && unit.id === root.id ? [ROOT_SCOPE] : descendantIds(units, unit.id);
    for (const p of role.permissions) {
      const s = (sets[p] ??= new Set());
      ids.forEach((i) => s.add(i));
    }
  }
  const out: Scopes = {};
  for (const [k, v] of Object.entries(sets) as [PermKey, Set<string>][]) {
    out[k] = v.has(ROOT_SCOPE) ? [ROOT_SCOPE] : [...v].sort();
  }
  return out;
}

export interface Principal {
  uid: string;
  isAdmin: boolean;
  scopes: Scopes;
  active: boolean;
}

export function principalOf(user: UserProfile | null, isAdmin: boolean): Principal | null {
  if (!user) return null;
  return { uid: user.uid, isAdmin, scopes: user.scopes ?? {}, active: user.active };
}

/** Có quyền `perm` trên đơn vị `unitId`? (unitId null = chỉ chấp nhận quyền toàn Khoa). */
export function hasPerm(p: Principal | null, perm: PermKey, unitId: string | null): boolean {
  if (!p || !p.active) return false;
  if (p.isAdmin) return true;
  const s = p.scopes[perm] ?? [];
  if (s.includes(ROOT_SCOPE)) return true;
  return unitId !== null && s.includes(unitId);
}

export function hasGlobalPerm(p: Principal | null, perm: PermKey): boolean {
  return hasPerm(p, perm, null);
}

/** Có quyền ở bất kỳ phạm vi nào (dùng để hiện menu). */
export function hasAnyScope(p: Principal | null, perm: PermKey): boolean {
  if (!p || !p.active) return false;
  if (p.isAdmin) return true;
  return (p.scopes[perm] ?? []).length > 0;
}

/** Danh sách unitId có quyền, hoặc '*' nếu toàn Khoa. */
export function scopeUnits(p: Principal | null, perm: PermKey): string[] | '*' {
  if (!p || !p.active) return [];
  if (p.isAdmin) return '*';
  const s = p.scopes[perm] ?? [];
  return s.includes(ROOT_SCOPE) ? '*' : s;
}
