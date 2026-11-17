import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setDoc, doc, type Firestore } from 'firebase/firestore';
import { cfg, task, units, users } from '../domain/fixtures';
import type { Task } from '../../src/domain/types';

export const PROJECT_ID = 'demo-khoa';

export async function makeEnv(): Promise<RulesTestEnvironment> {
  const host = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Phải chạy trong emulator (npm run test:rules) — không bao giờ nối production.');
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: host[0], port: Number(host[1]), rules: readFileSync('firestore.rules', 'utf8') },
  });
}

export async function seed(env: RulesTestEnvironment, extraTasks: Task[] = []): Promise<void> {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const w = (path: string, data: object) => setDoc(doc(db, path), data);
    for (const u of units) await w(`units/${u.id}`, u);
    for (const r of cfg.roles) await w(`roles/${r.key}`, r);
    for (const wf of cfg.workflows) await w(`workflows/${wf.id}`, wf);
    for (const t of cfg.taskTypes) await w(`taskTypes/${t.id}`, t);
    await w('settings/app', cfg.settings);
    for (const u of users) await w(`users/${u.uid}`, { name: u.name, email: u.email, active: u.active, unitId: u.unitId, assignments: u.assignments, scopes: u.scopes, createdAt: u.createdAt });
    // quản trị viên
    await w('users/admin', { name: 'Admin', email: 'admin@x.vn', active: true, unitId: 'khoa', assignments: [{ roleKey: 'quan_tri', unitId: 'khoa' }], scopes: {}, createdAt: '2026-01-01T00:00:00.000Z' });
    await w('admins/admin', { createdAt: '2026-01-01T00:00:00.000Z' });
    await w('meta/bootstrap', { adminUid: 'admin', createdAt: '2026-01-01T00:00:00.000Z' });
    // việc mẫu
    await w('tasks/t1', task({ id: 't1' })); // bm1, assignee an, reviewer head1, doing
    await w('tasks/t2', task({ id: 't2', unitId: 'bm2', assigneeIds: ['lan'], reviewerIds: ['head2'], participantIds: ['lan', 'head2'], createdBy: 'head2' }));
    await w('tasks/t3', task({ id: 't3', stateKey: 'review' })); // chờ duyệt, bm1
    for (const t of extraTasks) await w(`tasks/${t.id}`, t);
  });
}

export const NOW = '2026-11-16T09:00:00.000Z';
