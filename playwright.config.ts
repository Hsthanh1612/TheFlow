import { defineConfig, devices } from '@playwright/test';

// E2E chạy trên Firebase Emulator (project demo-khoa) — KHÔNG chạm production. Xem scripts/run-emulator.mjs.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5173 --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: { VITE_USE_EMULATOR: 'true' },
  },
});
