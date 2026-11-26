import { useSyncExternalStore } from 'react';

export const THEMES = [
  { id: 'ngoc', name: 'Xanh ngọc', swatch: ['#0FB5AE', '#FF6B5E'] },
  { id: 'tim', name: 'Chàm điện', swatch: ['#5B4BF5', '#19D3A2'] },
  { id: 'troi', name: 'Xanh trời', swatch: ['#2F7BFF', '#FFC21A'] },
  { id: 'sen', name: 'Tím sen', swatch: ['#9B4DFF', '#FF3D8B'] },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

const KEY = 'khoa.theme';
const MODE_KEY = 'khoa.mode';
export type ModeId = 'light' | 'dark' | 'auto';
export const MODES: { id: ModeId; name: string }[] = [{ id: 'light', name: 'Sáng' }, { id: 'dark', name: 'Tối' }, { id: 'auto', name: 'Tự động' }];
export const isModeId = (v: unknown): v is ModeId => v === 'light' || v === 'dark' || v === 'auto';
let mode: ModeId = 'auto';
let mq: MediaQueryList | null = null;
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

function readMode(): ModeId {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (isModeId(v)) return v;
  } catch { /* bỏ qua */ }
  return 'auto';
}

/** 'auto' theo hệ điều hành; còn lại cố định. Đặt data-mode = 'light' | 'dark' để CSS dùng. */
const resolved = (): 'light' | 'dark' => (mode === 'auto' ? (mq?.matches ? 'dark' : 'light') : mode);

function paint(): void {
  const root = document.documentElement;
  root.dataset.theme = current;
  root.dataset.mode = resolved();
  const meta = document.querySelector('meta[name="theme-color"]');
  const dark = resolved() === 'dark';
  meta?.setAttribute('content', dark ? '#0F1424' : THEMES.find((t) => t.id === current)!.swatch[0]);
}

export function initTheme(): void {
  current = read();
  mode = readMode();
  if (!mq && typeof matchMedia === 'function') {
    mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => { if (mode === 'auto') { paint(); listeners.forEach((l) => l()); } });
  }
  paint();
}

export function setMode(m: ModeId): void {
  mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch { /* bỏ qua */ }
  paint();
  listeners.forEach((l) => l());
}

/** Áp dụng chế độ từ hồ sơ tài khoản, không ghi ngược lên máy chủ. */
export function applyMode(m: ModeId): void {
  if (m !== mode) setMode(m);
}

export function useMode(): ModeId {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => mode);
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
  paint();
  listeners.forEach((l) => l());
}

export function useTheme(): ThemeId {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
}
