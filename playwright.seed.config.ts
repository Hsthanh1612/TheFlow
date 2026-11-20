import { defineConfig, devices } from '@playwright/test';

// Nạp dữ liệu mẫu vào Emulator đang chạy sẵn (npm run emulators). KHÔNG dùng cho production.
export default defineConfig({
  testDir: 'tests/seed',
  timeout: 300_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npx vite --port 5173 --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true, env: { VITE_USE_EMULATOR: 'true' } },
});
