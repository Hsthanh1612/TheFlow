// Chạy lệnh bên trong Firebase Emulator Suite (Firestore + Auth) với project demo-khoa — KHÔNG chạm production.
// Dùng JRE đặt ở .tools/jre (Firestore Emulator cần Java) nếu máy chưa có Java.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const jre = resolve(root, '.tools/jre/Contents/Home');
const env = { ...process.env };
if (existsSync(jre)) {
  env.JAVA_HOME = jre;
  env.PATH = `${jre}/bin:${env.PATH}`;
}
const argv = process.argv.slice(2);
const bin = resolve(root, 'node_modules/.bin/firebase');
const PROJECT = 'demo-khoa'; // tiền tố demo- => emulator không bao giờ nối vào project thật

let args;
if (argv[0] === 'emulators-only') {
  // Dữ liệu thử được giữ lại giữa các lần chạy trong .emulator-data (đã gitignore): nạp khi khởi động, ghi lại khi thoát bằng Ctrl+C.
  const dataDir = resolve(root, '.emulator-data');
  args = ['emulators:start', '--only', 'auth,firestore', '--project', PROJECT, '--export-on-exit', dataDir];
  if (existsSync(resolve(dataDir, 'firebase-export-metadata.json'))) args.push('--import', dataDir);
}
else if (argv.length > 0) {
  const cmd = (argv[0] === 'exec' ? argv.slice(1) : argv).join(' ');
  args = ['emulators:exec', '--only', 'auth,firestore', '--project', PROJECT, cmd];
} else {
  console.error('Cách dùng: run-emulator.mjs <lệnh...> | emulators-only');
  process.exit(2);
}
const r = spawnSync(bin, args, { stdio: 'inherit', env, cwd: root });
process.exit(r.status ?? 1);
