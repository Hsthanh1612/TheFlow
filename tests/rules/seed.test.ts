import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { makeEnv, NOW } from './helpers';
import { defaultConfig } from '../../src/domain/defaultConfig';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await makeEnv(); });
afterAll(async () => { await env.cleanup(); });

describe('khởi tạo hệ thống lần đầu (đúng như claimFirstAdmin)', () => {
  it('batch bootstrap rồi batch nạp toàn bộ cấu hình mặc định bởi quản trị viên mới', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/first'), { name: 'Người đầu', email: 'first@x.vn', active: false, unitId: null, assignments: [], scopes: {}, createdAt: NOW }));
    const db = env.authenticatedContext('first', { email: 'first@x.vn' }).firestore();
    const b1 = writeBatch(db);
    b1.set(doc(db, 'meta/bootstrap'), { adminUid: 'first', createdAt: NOW });
    b1.set(doc(db, 'admins/first'), { createdAt: NOW });
    b1.update(doc(db, 'users/first'), { active: true });
    await assertSucceeds(b1.commit());
    const cfg = defaultConfig();
    const b2 = writeBatch(db);
    for (const u of cfg.units) b2.set(doc(db, `units/${u.id}`), u);
    for (const r of cfg.roles) b2.set(doc(db, `roles/${r.key}`), r);
    for (const w of cfg.workflows) b2.set(doc(db, `workflows/${w.id}`), w);
    for (const t of cfg.taskTypes) b2.set(doc(db, `taskTypes/${t.id}`), t);
    b2.set(doc(db, 'settings/app'), cfg.settings);
    b2.set(doc(db, 'configVersions/v1'), { entity: 'import', entityId: 'seed', before: null, after: '{}', changedBy: 'first', createdAt: NOW, note: '' });
    await assertSucceeds(b2.commit());
  });
});
