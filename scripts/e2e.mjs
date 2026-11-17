// Chạy E2E: Firebase Emulator (Auth+Firestore) + Vite dev server (VITE_USE_EMULATOR) + Playwright.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const r = spawnSync('node', ['scripts/run-emulator.mjs', 'npx playwright test ' + process.argv.slice(2).join(' ')], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);
