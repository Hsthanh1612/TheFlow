// Quét bí mật trong các file được theo dõi bởi git (hoặc toàn bộ thư mục nếu chưa có git). Thoát mã 1 nếu phát hiện.
// Lưu ý: cấu hình Firebase Web (apiKey, projectId…) KHÔNG phải bí mật và có thể nằm ở frontend; thứ cần chặn là khoá riêng, token, service account.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const PATTERNS = [
  ['Khoá riêng (PEM)', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/],
  ['Service account Google', /"type"\s*:\s*"service_account"/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Anthropic/OpenAI key', /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}/],
  ['Mật khẩu/bí mật gán trực tiếp', /\b(?:password|passwd|secret|api[_-]?secret|private[_-]?key)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i],
];
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', '.tools', 'test-results', 'playwright-report', 'coverage', '.firebase']);
const SKIP_FILE = /\.(png|jpe?g|gif|ico|woff2?|zip|gz|tar|pdf)$|package-lock\.json$|check-secrets\.mjs$|\.test\.ts$/;

function listFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
    return out.split('\0').filter(Boolean);
  } catch {
    const acc = [];
    const walk = (dir) => {
      for (const n of readdirSync(join(root, dir))) {
        if (SKIP_DIR.has(n)) continue;
        const rel = join(dir, n);
        if (statSync(join(root, rel)).isDirectory()) walk(rel);
        else acc.push(rel);
      }
    };
    walk('');
    return acc;
  }
}

const bad = [];
for (const f of listFiles()) {
  if (SKIP_FILE.test(f) || f.split('/').some((p) => SKIP_DIR.has(p))) continue;
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) bad.push(`${f}: tệp .env không được theo dõi`);
  let text;
  try {
    text = readFileSync(join(root, f), 'utf8');
  } catch {
    continue;
  }
  for (const [name, re] of PATTERNS) if (re.test(text)) bad.push(`${f}: ${name}`);
}
if (bad.length > 0) {
  console.error('PHÁT HIỆN BÍ MẬT TIỀM ẨN:\n' + bad.map((b) => ` - ${b}`).join('\n'));
  process.exit(1);
}
console.log('Không phát hiện bí mật trong các tệp được quét.');
