import { useEffect, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react';
import { STATUS_LABEL, statusTone } from './format';
import { useApp } from './context';

export function Spinner({ label }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Loader2 className="spinner" size={16} />
      {label}
    </span>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return <div className="loading-page"><Spinner label={label} /></div>;
}

export function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={30} style={{ opacity: 0.5, marginBottom: 8 }} />
      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      {text && <div style={{ marginTop: 4, fontSize: 13 }}>{text}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'error' | 'warning';
}) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  const tone = statusTone(status);
  return (
    <span className={`badge ${tone === 'neutral' ? '' : `badge-${tone}`}`}>
      <span className="dot" />
      {STATUS_LABEL[status || ''] || status || '—'}
    </span>
  );
}

export function Stars({ value, size = 14 }: { value?: number | null; size?: number }) {
  const v = Math.round(value || 0);
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= v ? '#f59e0b' : 'none'} color={i <= v ? '#f59e0b' : 'var(--border)'} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className={`star-btn ${i <= value ? 'on' : ''}`}
          onClick={() => onChange(i)}
          aria-label={`${i} étoiles`}
        >
          <Star size={28} fill={i <= value ? '#f59e0b' : 'none'} />
        </button>
      ))}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span className="label">
        {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </span>
      {children}
      {hint && <span className="muted" style={{ fontSize: 11 }}>{hint}</span>}
    </label>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 19 }}>{title}</h2>
            {subtitle && <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        {children}
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmer',
  onConfirm,
  onClose,
  danger,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => void onConfirm()}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--muted)' }}>{message}</p>
    </Modal>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'primary',
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  hint?: string;
}) {
  const colors: Record<string, { bg: string; fg: string }> = {
    primary: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
    danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  };
  const c = colors[tone];
  return (
    <div className="card stat-card">
      <span className="stat-icon" style={{ background: c.bg, color: c.fg }}><Icon size={21} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="muted" style={{ fontSize: 12 }}>{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="muted" style={{ fontSize: 11 }}>{hint}</div>}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => {
        const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;
        return (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1 }}>{t.message}</span>
            <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24 }} onClick={() => dismissToast(t.id)} aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ErrorView({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Notice tone="error">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <span>{message}</span>
        {retry && <button className="btn btn-sm" onClick={retry}>Réessayer</button>}
      </div>
    </Notice>
  );
}
