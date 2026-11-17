import { writeFileSync } from 'node:fs';
import { defaultConfig } from '../src/domain/defaultConfig';
import { validateConfig } from '../src/domain/config';

const cfg = defaultConfig();
const r = validateConfig(cfg);
if (!r.ok) {
  console.error(r.errors.join('\n'));
  process.exit(1);
}
writeFileSync('config/khoa.config.json', JSON.stringify(cfg, null, 2) + '\n');
console.log('Đã ghi config/khoa.config.json');
