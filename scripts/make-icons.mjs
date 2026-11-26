// Tạo biểu tượng PWA (PNG) từ một SVG bằng Chromium của Playwright. Chạy: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(import.meta.dirname, '../public/icons');
mkdirSync(out, { recursive: true });
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0FB5AE"/><stop offset="1" stop-color="#067A75"/></linearGradient></defs>
<rect width="512" height="512" fill="url(#g)"/>
<circle cx="${400 - pad / 2}" cy="${112 + pad / 2}" r="${44}" fill="#FF6B5E"/>
<text x="256" y="${352 - pad / 6}" font-family="Inter, Arial, sans-serif" font-size="${300 - pad}" font-weight="800" text-anchor="middle" fill="#fff">K</text></svg>`;
const jobs = [['icon-192.png', 192, 0, false], ['icon-512.png', 512, 0, false], ['icon-maskable-512.png', 512, 60, false], ['apple-touch-icon.png', 180, 0, false]];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg(pad)}`);
  await page.screenshot({ path: resolve(out, name), omitBackground: false });
  console.log('đã tạo', name);
}
await browser.close();
