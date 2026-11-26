import { useAuth } from '../state/auth';
import { setMode, useMode } from '../state/theme';
import { saveMode } from '../services/firebase/featuresRepo';

const isDark = (m: string) => m === 'dark' || (m === 'auto' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);

/** Nút gạt sáng/tối nhỏ gọn trên thanh trên. */
export function ModeToggle() {
  const mode = useMode();
  const { profile } = useAuth();
  const dark = isDark(mode);
  function flip() {
    const next = dark ? 'light' : 'dark';
    setMode(next);
    if (profile) void saveMode(profile.uid, next).catch(() => undefined);
  }
  return (
    <button type="button" className={`modetog${dark ? ' dark' : ''}`} role="switch" aria-checked={dark} aria-label="Chế độ tối" title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} onClick={flip}>
      <svg className="mt-sun" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      <svg className="mt-moon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <span className="mt-knob" />
    </button>
  );
}
