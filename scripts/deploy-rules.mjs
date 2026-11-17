// Triển khai CHỈ Firestore Rules + Indexes lên project Firebase đã chọn. KHÔNG bao giờ triển khai Hosting/Functions.
// Cách dùng: FIREBASE_PROJECT=<project-id> npm run deploy:rules   (cần `firebase login` trước, tài khoản có quyền sửa Rules)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const project = process.env.FIREBASE_PROJECT;
if (!project || project.startsWith('demo-')) {
  console.error('Đặt FIREBASE_PROJECT=<project-id thật> (không dùng project demo-*).');
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
if (cfg.hosting || cfg.functions || cfg.apphosting) {
  console.error('firebase.json có hosting/functions/apphosting — dự án cấm các dịch vụ này (chỉ Spark).');
  process.exit(2);
}
console.log(`Sẽ triển khai Firestore rules + indexes lên project "${project}" (chỉ đọc cấu hình, không động tới dữ liệu).`);
const r = spawnSync(resolve(root, 'node_modules/.bin/firebase'), ['deploy', '--only', 'firestore:rules,firestore:indexes', '--project', project], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);
