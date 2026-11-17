import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { messageOf } from '../services/errors';

interface ToastItem { id: number; text: string; err: boolean }
interface ToastApi {
  ok: (text: string) => void;
  fail: (e: unknown) => void;
  /** Chạy một thao tác ghi dữ liệu: chỉ báo thành công sau khi máy chủ xác nhận; lỗi thì báo lỗi thật. */
  run: <T>(op: () => Promise<T>, okText: string) => Promise<{ ok: true; value: T } | { ok: false }>;
  pending: number;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState(0);
  const seq = useRef(0);
  const push = useCallback((text: string, err: boolean) => {
    const id = ++seq.current;
    setItems((x) => [...x.slice(-3), { id, text, err }]);
    window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), err ? 7000 : 3500);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      ok: (t) => push(t, false),
      fail: (e) => push(messageOf(e), true),
      run: async (op, okText) => {
        setPending((n) => n + 1);
        try {
          const value = await op();
          push(okText, false);
          return { ok: true as const, value };
        } catch (e) {
          push(messageOf(e), true);
          return { ok: false as const };
        } finally {
          setPending((n) => n - 1);
        }
      },
      pending,
    }),
    [push, pending],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast${i.err ? ' err' : ''}`}>{i.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast ngoài ToastProvider');
  return c;
}
