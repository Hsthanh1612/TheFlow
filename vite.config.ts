import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages phục vụ tại /<tên-repo>/ — đặt VITE_BASE khi build (xem .github/workflows/ci.yml).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022' },
});
