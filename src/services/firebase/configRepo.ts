import { doc, writeBatch, type WriteBatch } from 'firebase/firestore';
import { getServices } from './init';
import { newId, nowIso } from './ids';
import { AppError, classify } from '../errors';
import type { KhoaConfig } from '../../domain/config';
import { diffConfig, validateConfig } from '../../domain/config';
import { computeScopes } from '../../domain/permissions';
import type { OrgUnit, Role, UserProfile, Workflow } from '../../domain/types';
import { withDerived } from '../../domain/workflow';

type Section = 'units' | 'roles' | 'workflows' | 'taskTypes' | 'templates' | 'terms';
const COLL: Record<Section, string> = { units: 'units', roles: 'roles', workflows: 'workflows', taskTypes: 'taskTypes', templates: 'templates', terms: 'terms' };

function idOf(section: Section, item: { id?: string; key?: string }): string {
  return (section === 'roles' ? item.key : item.id) ?? '';
}

/** Dữ liệu ghi vào Firestore: bỏ các trường dẫn xuất không cần thiết, không có undefined. */
function clean<T extends object>(v: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(v));
}

function versionDoc(entity: string, entityId: string, before: unknown, after: unknown, actor: string, note: string) {
  return { entity, entityId, before: before === null ? null : JSON.stringify(before), after: JSON.stringify(after), changedBy: actor, createdAt: nowIso(), note };
}

/** Lưu một thực thể cấu hình + ghi phiên bản (before/after) trong cùng một batch. */
export async function saveConfigItem(section: Section, item: object, before: object | null, actor: string, note = ''): Promise<void> {
  const { db } = getServices();
  const typed = item as { id?: string; key?: string };
  const id = idOf(section, typed);
  const data = section === 'workflows' ? withDerived(item as Omit<Workflow, 'allowed' | 'needsComment' | 'doneStates'>) : item;
  try {
    const b = writeBatch(db);
    b.set(doc(db, COLL[section], id), clean(data));
    b.set(doc(db, 'configVersions', newId()), versionDoc(section, id, before, data, actor, note));
    await b.commit();
  } catch (e) {
    throw classify(e);
  }
}

export async function saveSettings(settings: object, before: object | null, actor: string): Promise<void> {
  const { db } = getServices();
  try {
    const b = writeBatch(db);
    b.set(doc(db, 'settings', 'app'), clean(settings));
    b.set(doc(db, 'configVersions', newId()), versionDoc('settings', 'app', before, settings, actor, ''));
    await b.commit();
  } catch (e) {
    throw classify(e);
  }
}

function setAll(b: WriteBatch, cfg: KhoaConfig): number {
  const { db } = getServices();
  let n = 0;
  for (const s of ['units', 'roles', 'workflows', 'taskTypes', 'templates', 'terms'] as Section[]) {
    for (const item of cfg[s] as { id?: string; key?: string }[]) {
      b.set(doc(db, COLL[s], idOf(s, item)), clean(item));
      n++;
    }
  }
  b.set(doc(db, 'settings', 'app'), clean(cfg.settings));
  return n + 1;
}

/** Nạp cấu hình mặc định lần đầu (quản trị viên). */
export async function seedConfigBatch(cfg: KhoaConfig, actor: string): Promise<void> {
  const { db } = getServices();
  const b = writeBatch(db);
  const n = setAll(b, cfg);
  if (n > 450) throw new AppError('data', 'Cấu hình quá lớn cho một batch.');
  b.set(doc(db, 'configVersions', newId()), versionDoc('import', 'seed', null, cfg, actor, 'Nạp cấu hình mặc định'));
  await b.commit();
}

/**
 * Áp dụng một cấu hình mới (nhập file / đề xuất từ AI). Kiểm tra lại toàn bộ, chỉ ghi những thực thể thay đổi,
 * thực thể bị bỏ khỏi file được LƯU TRỮ (archived) chứ không xoá — không làm mất dữ liệu cũ (BRIEF mục 7).
 */
export async function applyConfig(current: KhoaConfig, next: unknown, actor: string, note: string): Promise<{ changed: number }> {
  const v = validateConfig(next);
  if (!v.ok) throw new AppError('data', `Cấu hình không hợp lệ: ${v.errors.slice(0, 5).join(' · ')}`);
  const changes = diffConfig(current, v.config);
  if (changes.length === 0) return { changed: 0 };
  if (changes.length > 400) throw new AppError('data', 'Quá nhiều thay đổi cho một lần áp dụng (tối đa 400).');
  const { db } = getServices();
  try {
    const b = writeBatch(db);
    for (const c of changes) {
      if (c.section === 'settings') {
        b.set(doc(db, 'settings', 'app'), clean(v.config.settings));
        continue;
      }
      const sec = c.section as Section;
      const list = v.config[sec] as { id?: string; key?: string; archived?: boolean }[];
      const item = list.find((x) => idOf(sec, x) === c.id);
      if (c.kind === 'remove') {
        const old = (current[sec] as { id?: string; key?: string }[]).find((x) => idOf(sec, x) === c.id);
        if (old && sec !== 'terms') b.set(doc(db, COLL[sec], c.id), clean({ ...old, archived: true }));
      } else if (item) b.set(doc(db, COLL[sec], c.id), clean(item));
    }
    b.set(doc(db, 'configVersions', newId()), versionDoc('import', 'apply', current, v.config, actor, note));
    await b.commit();
    return { changed: changes.length };
  } catch (e) {
    throw classify(e);
  }
}

/** Danh sách cập nhật `scopes` cần ghi lại cho người dùng (sau khi đổi vai trò/cây tổ chức/gán vai trò). */
export function scopeUpdates(users: UserProfile[], roles: Role[], units: OrgUnit[]): { uid: string; scopes: UserProfile['scopes'] }[] {
  const out: { uid: string; scopes: UserProfile['scopes'] }[] = [];
  for (const u of users) {
    const next = computeScopes(u.assignments, roles, units);
    if (JSON.stringify(sortObj(next)) !== JSON.stringify(sortObj(u.scopes))) out.push({ uid: u.uid, scopes: next });
  }
  return out;
}

function sortObj(o: object): object {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

export async function syncScopes(users: UserProfile[], roles: Role[], units: OrgUnit[]): Promise<number> {
  const ups = scopeUpdates(users, roles, units);
  if (ups.length === 0) return 0;
  const { db } = getServices();
  try {
    for (let i = 0; i < ups.length; i += 400) {
      const b = writeBatch(db);
      for (const u of ups.slice(i, i + 400)) b.update(doc(db, 'users', u.uid), { scopes: u.scopes });
      await b.commit();
    }
    return ups.length;
  } catch (e) {
    throw classify(e);
  }
}

export async function saveUserAccess(uid: string, patch: { active: boolean; unitId: string | null; assignments: UserProfile['assignments'] }, roles: Role[], units: OrgUnit[]): Promise<void> {
  const { db } = getServices();
  try {
    const b = writeBatch(db);
    b.update(doc(db, 'users', uid), { ...patch, scopes: computeScopes(patch.assignments, roles, units) });
    await b.commit();
  } catch (e) {
    throw classify(e);
  }
}
