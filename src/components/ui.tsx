import { useEffect, useRef, useState, type ReactNode } from 'react';
import { initials } from '../state/data';
import type { DisplayStatus } from '../domain/taskLogic';

const PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  kanban: 'M3 3h5v16H3zM10 3h5v10h-5zM17 3h4v13h-4z',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  timeline: 'M4 6h9M8 12h12M6 18h8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  msg: 'M4 5h16v11H9l-5 4z',
  inbox: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 19a6 6 0 0112 0M17 8a3 3 0 010 6M21 19a5 5 0 00-4-5',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  send: 'M4 12l16-8-6 16-3-7z',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5h.01',
  workload: 'M4 20V9M10 20V4M16 20v-8M22 20v-5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

export function Avatar({ name, label = true }: { name: string; label?: boolean }) {
  return (
    <span className="av" role={label ? 'img' : undefined} aria-label={label ? name : undefined} aria-hidden={label ? undefined : true} title={name}>
      {initials(name)}
    </span>
  );
}

export function Avatars({ names }: { names: string[] }) {
  return (
    <span className="avs">
      {names.slice(0, 3).map((n, i) => (
        <Avatar key={i} name={n} label={false} />
      ))}
      {names.length > 3 && <span className="av" aria-hidden="true">+{names.length - 3}</span>}
      <span className="sr-only">{names.join(', ')}</span>
    </span>
  );
}

export function StatusBadge({ status, label }: { status: DisplayStatus; label: string }) {
  return <span className={`b ${status === 'review' ? 'rev' : status}`}>{label}</span>;
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Số đếm tăng dần khi xuất hiện (bỏ qua khi người dùng tắt hiệu ứng). */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (value <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min((now - t0) / 700, 1);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

export function Loading({ text = 'Đang tải…' }: { text?: string }) {
  return <div className="empty" role="status">{text}</div>;
}

export function ErrorBox({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="alert err" role="alert">
      {errors.map((e, i) => (
        <div key={i}>{e}</div>
      ))}
    </div>
  );
}

export function Field({ label, htmlFor, error, children, hint }: { label: string; htmlFor: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="fld">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="note">{hint}</span>}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}

/** Hộp thoại dùng thẻ <dialog> gốc: có bẫy focus, Esc để đóng, nhãn truy cập. */
export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby="dlg-title" onClose={onClose} style={wide ? { maxWidth: 'min(860px,94vw)' } : undefined}>
      {open && (
        <div className="dlg">
          <h2 id="dlg-title">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { key: T; label: string }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={(e) => {
      const idx = items.findIndex((x) => x.key === value);
      const next = e.key === 'ArrowRight' ? idx + 1 : e.key === 'ArrowLeft' ? idx - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null;
      if (next === null) return;
      e.preventDefault();
      const t = items[(next + items.length) % items.length];
      onChange(t.key);
      requestAnimationFrame(() => (e.currentTarget.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus());
    }}>
      {items.map((i) => (
        <button key={i.key} role="tab" tabIndex={value === i.key ? 0 : -1} aria-selected={value === i.key} className={`tab${value === i.key ? ' on' : ''}`} onClick={() => onChange(i.key)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="hd">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="tr">{actions}</div>}
    </div>
  );
}
