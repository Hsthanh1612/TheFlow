// Mở bản thử cục bộ: Firebase Emulator (nhớ dữ liệu trong .emulator-data) + giao diện, rồi mở trình duyệt.
// Đăng nhập thử: test_case / 123123 (xem tests/seed/data.ts). Nhấn Ctrl+C để dừng và lưu dữ liệu.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (!existsSync(resolve(root, '.emulator-data/firebase-export-metadata.json'))) {
  console.log('Chưa có dữ liệu mẫu. Chạy: npm run emulators (cửa sổ 1) rồi npm run seed:demo (cửa sổ 2), sau đó Ctrl+C cửa sổ 1 để lưu.');
}
const emu = spawn('node', ['scripts/run-emulator.mjs', 'emulators-only'], { cwd: root, stdio: 'inherit' });
const vite = spawn('npx', ['vite', '--port', '5173', '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_USE_EMULATOR: 'true' } });
setTimeout(() => spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', ['http://127.0.0.1:5173']), 8000);
const stop = () => { vite.kill('SIGINT'); emu.kill('SIGINT'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
emu.on('exit', () => vite.kill());
