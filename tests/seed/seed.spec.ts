import { expect, test } from '@playwright/test';
import { expectHome, login, openSession, register } from '../e2e/helpers';
import { ADMIN, MEMBERS, PASSWORD } from './data';

test('nạp dữ liệu mẫu vào Emulator', async ({ browser }) => {
  const admin = await openSession(browser);
  await register(admin.page, ADMIN.name, ADMIN.email, PASSWORD);
  await admin.page.getByRole('button', { name: 'Trở thành quản trị viên' }).click();
  await expectHome(admin.page, ADMIN.name);

  for (const m of MEMBERS) {
    const s = await openSession(browser);
    await register(s.page, m.name, m.email, PASSWORD);
    await expect(s.page.getByRole('heading', { name: 'Đang chờ kích hoạt' })).toBeVisible();
    await s.ctx.close();
  }

  const msg = await admin.page.evaluate(async () => {
    const url = '/tests/seed/api.ts'; // tải từ dev server; dùng biến để TypeScript không phân giải đường dẫn tuyệt đối
    const m = (await import(/* @vite-ignore */ url)) as { seed: () => Promise<string> };
    return m.seed();
  });
  console.log(msg);
  expect(msg).toContain('Đã tạo');

  // Mỗi thành viên ghi giờ công cho việc của mình
  let entries = 0;
  for (const m of MEMBERS) {
    const s = await openSession(browser);
    await login(s.page, m.email, PASSWORD);
    await expect(s.page.getByRole('heading', { level: 1 })).toContainText('Xin chào', { timeout: 30_000 });
    entries += await s.page.evaluate(async () => {
      const url = '/tests/seed/api.ts';
      const mod = (await import(/* @vite-ignore */ url)) as { seedTime: () => Promise<number> };
      return mod.seedTime();
    });
    await s.ctx.close();
  }
  console.log(`Đã ghi ${entries} bản ghi giờ công`);
});
