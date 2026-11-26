import { useSyncExternalStore } from 'react';

export const THEMES = [
  { id: 'ngoc', name: 'Xanh ngọc', swatch: ['#0FB5AE', '#FF6B5E'] },
  { id: 'tim', name: 'Chàm điện', swatch: ['#5B4BF5', '#19D3A2'] },
  { id: 'troi', name: 'Xanh trời', swatch: ['#2F7BFF', '#FFC21A'] },
  { id: 'sen', name: 'Tím sen', swatch: ['#9B4DFF', '#FF3D8B'] },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

const KEY = 'khoa.theme';
const listeners = new Set<() => void>();
let current: ThemeId = 'ngoc';

/** localStorage có thể bị chặn (chế độ riêng tư): luôn bọc try/catch và vẫn chạy được khi không có. */
function read(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (THEMES.some((t) => t.id === v)) return v as ThemeId;
  } catch { /* bỏ qua */ }
  return 'ngoc';
}

export function initTheme(): void {
  current = read();
  document.documentElement.dataset.theme = current;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', THEMES.find((t) => t.id === current)!.swatch[0]);
}

export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

/** Áp dụng chủ đề từ hồ sơ tài khoản (đồng bộ giữa các thiết bị), không ghi ngược lên máy chủ. */
export function applyTheme(id: ThemeId): void {
  if (id === current) return;
  setTheme(id);
}

export function setTheme(id: ThemeId): void {
  current = id;
  try { localStorage.setItem(KEY, id); } catch { /* bỏ qua */ }
  initTheme();
  listeners.forEach((l) => l());
}

export function useTheme(): ThemeId {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
}
