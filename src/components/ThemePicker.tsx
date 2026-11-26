import { useAuth } from '../state/auth';
import { THEMES, setTheme, useTheme, type ThemeId } from '../state/theme';
import { saveTheme } from '../services/firebase/notifyRepo';

/** Chọn chủ đề màu: áp dụng ngay trên máy, và lưu vào hồ sơ để đi theo tài khoản (lỗi lưu không chặn việc đổi màu). */
export function ThemePicker({ withNames = false }: { withNames?: boolean }) {
  const theme = useTheme();
  const { profile } = useAuth();
  function pick(id: ThemeId) {
    setTheme(id);
    if (profile) void saveTheme(profile.uid, id).catch(() => undefined);
  }
  return (
    <div className="row" style={{ gap: 10 }} role="group" aria-label="Màu giao diện">
      {THEMES.map((t) => (
        <button key={t.id} type="button" className={`sw-btn${withNames ? ' big' : ''}${theme === t.id ? ' on' : ''}`} aria-label={t.name} aria-pressed={theme === t.id} title={t.name} onClick={() => pick(t.id)} style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
      ))}
      {withNames && <span className="note">{THEMES.find((t) => t.id === theme)?.name}</span>}
    </div>
  );
}
