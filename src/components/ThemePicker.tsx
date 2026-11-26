import { useAuth } from '../state/auth';
import { MODES, THEMES, setMode, setTheme, useMode, useTheme, type ModeId, type ThemeId } from '../state/theme';
import { saveTheme } from '../services/firebase/notifyRepo';
import { saveMode } from '../services/firebase/featuresRepo';

/** Chọn chủ đề màu: áp dụng ngay trên máy, và lưu vào hồ sơ để đi theo tài khoản (lỗi lưu không chặn việc đổi màu). */
export function ThemePicker({ withNames = false }: { withNames?: boolean }) {
  const theme = useTheme();
  const mode = useMode();
  const { profile } = useAuth();
  function pick(id: ThemeId) {
    setTheme(id);
    if (profile) void saveTheme(profile.uid, id).catch(() => undefined);
  }
  function pickMode(m: ModeId) {
    setMode(m);
    if (profile) void saveMode(profile.uid, m).catch(() => undefined);
  }
  return (
    <div className="col" style={{ gap: 10 }}>
    <div className="row" style={{ gap: 10 }} role="group" aria-label="Màu giao diện">
      {THEMES.map((t) => (
        <button key={t.id} type="button" className={`sw-btn${withNames ? ' big' : ''}${theme === t.id ? ' on' : ''}`} aria-label={t.name} aria-pressed={theme === t.id} title={t.name} onClick={() => pick(t.id)} style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
      ))}
      {withNames && <span className="note">{THEMES.find((t) => t.id === theme)?.name}</span>}
    </div>
    <div className="seg" role="group" aria-label="Chế độ sáng tối">
      {MODES.map((m) => <button key={m.id} type="button" className={mode === m.id ? 'on' : ''} aria-pressed={mode === m.id} onClick={() => pickMode(m.id)}>{m.name}</button>)}
    </div>
    </div>
  );
}
