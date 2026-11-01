import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Card({ title, action, children, className = '', testId }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`card ${className}`} data-testid={testId}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Progress({ value, max, label, detail, band, testId }: { value: number | null; max: number | null; label: string; detail?: ReactNode; band?: [number, number]; testId?: string }) {
  const scaleMax = band ? band[1] * 1.15 : max ?? 0;
  const pct = value != null && scaleMax ? Math.min(100, (value / scaleMax) * 100) : 0;
  return (
    <div className="progress" data-testid={testId}>
      <div className="progress-top">
        <span className="progress-label">{label}</span>
        <span className="progress-detail">{detail}</span>
      </div>
      <div className="bar" role="progressbar" aria-label={label} aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={scaleMax || 100}>
        {band && scaleMax > 0 && (
          <div className="bar-band" style={{ left: `${(band[0] / scaleMax) * 100}%`, width: `${((band[1] - band[0]) / scaleMax) * 100}%` }} />
        )}
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Numeric input that saves on every valid change; empty = not logged (null). */
export function NumField({ label, value, onChange, unit, step = 1, min = 0, max, testId, placeholder, wide }: {
  label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; step?: number; min?: number; max?: number; testId?: string; placeholder?: string; wide?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : String(value));
  }, [value]);
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="field-box">
        <input
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          type="text"
          pattern="[0-9]*[.,]?[0-9]*"
          value={text}
          placeholder={placeholder ?? '—'}
          data-testid={testId}
          aria-label={label}
          onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
          onBlur={() => { focused.current = false; setText(value == null ? '' : String(value)); }}
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.');
            setText(e.target.value);
            if (raw.trim() === '') return onChange(null);
            const n = Number(raw);
            if (!Number.isFinite(n) || n < min || (max != null && n > max)) return;
            onChange(n);
          }}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </span>
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder, multiline, testId }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; testId?: string }) {
  return (
    <label className="field field-wide">
      <span className="field-label">{label}</span>
      {multiline ? (
        <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} data-testid={testId} />
      ) : (
        <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
      )}
    </label>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label, testId, allowClear = true }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T | null) => void; label: string; testId?: string; allowClear?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(value === o.value && allowClear ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} data-testid={testId}>
      <span />
    </button>
  );
}

export function Stat({ label, value, sub, testId }: { label: string; value: ReactNode; sub?: ReactNode; testId?: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const p: Record<string, ReactNode> = {
    today: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>,
    food: <><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4" /><path d="M17 21V3c-2 1.5-3 4-3 7v4h3" /></>,
    activity: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    health: <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" /><path d="M9.5 9.5l5 5" /></>,
    results: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    left: <path d="M15 18l-6-6 6-6" />,
    right: <path d="M9 18l6-6-6-6" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16v4z" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  );
}

// ---------- toast with optional undo ----------
type ToastMsg = { id: number; text: string; undo?: () => void };
let pushToast: (t: Omit<ToastMsg, 'id'>) => void = () => {};
export const toast = (text: string, undo?: () => void) => pushToast({ text, undo });

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    let n = 0;
    pushToast = (t) => {
      const id = ++n;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
    };
  }, []);
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id} role="status">
          <span>{t.text}</span>
          {t.undo && (
            <button type="button" onClick={() => { t.undo!(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** In-page confirmation sheet (avoids window.confirm, which is suppressed in some iOS standalone contexts). */
export function ConfirmSheet({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="sheet-body">{body}</div>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} data-testid="confirm-yes">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
