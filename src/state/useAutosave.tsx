import { useCallback, useEffect, useRef, useState } from 'react';
import { messageOf } from '../services/errors';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * Tự lưu có debounce cho một giá trị. `remote` là giá trị đã được máy chủ xác nhận.
 *  - Chỉ gửi khi giá trị khác `remote` (không tạo vòng lặp listener → ghi → listener).
 *  - Khi người khác sửa (remote đổi) và mình không có thay đổi dở dang thì nhận giá trị mới.
 *  - Chỉ báo "Đã lưu" sau khi `save` resolve; lỗi thì giữ nguyên bản nháp và báo lỗi.
 */
export function useAutosave<T>(remote: T, save: (v: T) => Promise<void>, enabled: boolean, delay = 800) {
  const [value, setValue] = useState<T>(remote);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const dirty = useRef(false);
  const latest = useRef(value);
  const timer = useRef<number | undefined>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;
  const eq = (a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

  useEffect(() => {
    if (!dirty.current) setValue(remote);
    else if (eq(remote, latest.current)) { dirty.current = false; setState('saved'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(remote)]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    setState('saving');
    try {
      await saveRef.current(latest.current);
      setState('saved');
      setError('');
      if (eq(latest.current, latest.current)) dirty.current = false;
    } catch (e) {
      setState('error');
      setError(messageOf(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = useCallback((v: T) => {
    if (!enabled) return;
    latest.current = v;
    dirty.current = true;
    setValue(v);
    setState('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), delay);
  }, [enabled, delay, flush]);

  // Lưu nốt khi rời trang/đóng component để không mất chữ vừa gõ.
  useEffect(() => () => { if (dirty.current) void flush(); }, [flush]);

  return { value, change, state, error, flush };
}

export function SaveHint({ state, error }: { state: SaveState; error: string }) {
  const text = state === 'dirty' ? 'Chưa lưu…' : state === 'saving' ? 'Đang lưu…' : state === 'saved' ? 'Đã lưu' : state === 'error' ? `Lỗi: ${error}` : '';
  return text ? <span className={`note${state === 'error' ? ' err' : ''}`} role={state === 'error' ? 'alert' : 'status'} style={state === 'error' ? { color: 'var(--danger)' } : undefined}>{text}</span> : null;
}
