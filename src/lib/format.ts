import type { Trip } from '../types';

export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toLocaleString('fr-FR')} FCFA`;
}

export function formatDate(value: string | null | undefined, withYear = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "à l'instant";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  return `il y a ${days} j`;
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || 'V';
}

export function todayInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function companyName(trip?: Trip | null): string {
  const c = trip?.company;
  if (!c) return 'Vitoo';
  if (typeof c === 'string') return c;
  return c.companyName || c.name || 'Vitoo';
}

export function tripStops(trip?: Trip | null): string[] {
  const s = trip?.stops;
  if (!s) return [];
  if (Array.isArray(s)) return s.map(String);
  try {
    const p: unknown = JSON.parse(s);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
}

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programmé',
  boarding: 'Embarquement',
  in_transit: 'En route',
  completed: 'Terminé',
  cancelled: 'Annulé',
  confirmed: 'Confirmé',
  paid: 'Payé',
  pending: 'En attente',
  failed: 'Échoué',
  active: 'Actif',
  used: 'Utilisé',
  available: 'Disponible',
  on_trip: 'En mission',
  off_duty: 'En repos',
};

export function statusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'primary' | 'neutral' {
  switch (status) {
    case 'completed':
    case 'paid':
    case 'confirmed':
    case 'active':
    case 'available':
      return 'success';
    case 'boarding':
    case 'in_transit':
    case 'on_trip':
    case 'pending':
      return 'primary';
    case 'cancelled':
    case 'failed':
    case 'off_duty':
      return 'danger';
    case 'scheduled':
    case 'warning':
      return 'warning';
    default:
      return 'neutral';
  }
}
