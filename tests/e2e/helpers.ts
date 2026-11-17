import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export interface Session { ctx: BrowserContext; page: Page; errors: string[] }

/** Mở một phiên trình duyệt riêng (cookie/IndexedDB riêng) và thu thập lỗi console/request. */
export async function openSession(browser: Browser, viewport = { width: 1366, height: 900 }): Promise<Session> {
  const ctx = await browser.newContext({ viewport, locale: 'vi-VN' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource.*(40[0-9])/.test(t)) return; // yêu cầu auth bị từ chối khi kiểm thử âm tính được ghi riêng
    errors.push(`console: ${t}`);
  });
  page.on('requestfailed', (r) => {
    if (/127\.0\.0\.1:(8080|9099)/.test(r.url()) && /ERR_ABORTED/.test(r.failure()?.errorText ?? '')) return; // stream bị đóng khi đổi trang
    errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  return { ctx, page, errors };
}

export async function register(page: Page, name: string, email: string, password = 'matkhau123') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
  await page.getByLabel('Họ và tên').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
}

/** `navigate=false`: đang ở màn đăng nhập sau khi đăng xuất — không tải lại trang (tránh đua với việc ghi phiên vào IndexedDB). */
export async function login(page: Page, email: string, password = 'matkhau123', navigate = true) {
  if (navigate) await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

export async function expectHome(page: Page, name?: string) {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Xin chào', { timeout: 20_000 });
  if (name) await expect(page.getByRole('heading', { level: 1 })).toContainText(name.split(' ').slice(-2).join(' '));
}

/** Độ tràn ngang của trang (px) và các phần tử gây tràn (ngoài vùng cuộn ngang hợp lệ), để báo lỗi dễ hiểu. */
export async function horizontalOverflow(page: Page): Promise<{ overflow: number; culprits: string[] }> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const culprits: string[] = [];
    document.querySelectorAll('body *').forEach((el) => {
      const b = el.getBoundingClientRect();
      let p: Element | null = el.parentElement;
      let scrolls = false;
      while (p) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') { scrolls = true; break; }
        p = p.parentElement;
      }
      if (!scrolls && b.right > vw + 1 && b.width > 0) culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} (right=${Math.round(b.right)})`);
    });
    return { overflow: document.documentElement.scrollWidth - vw, culprits: culprits.slice(0, 6) };
  });
}
