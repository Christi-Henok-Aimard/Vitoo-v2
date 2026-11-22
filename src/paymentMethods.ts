import type { Lang } from './i18n';

// Liste fermée des moyens de paiement (identique côté backend).
export const PAYMENT_METHODS = [
  'Espèces',
  'Wave',
  'Orange Money',
  'MTN MoMo',
  'Moov Money',
  'Carte bancaire',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ONLINE_METHODS: PaymentMethod[] = PAYMENT_METHODS.filter(
  (method) => method !== 'Espèces',
);

export const isOnlineMethod = (method: string): boolean => method !== 'Espèces';

const KNOWN = new Set<string>(PAYMENT_METHODS);

function toArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String);
  if (typeof input !== 'string') return [];
  const raw = input.trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (typeof parsed === 'string') return [parsed];
  } catch {
    /* chaîne séparée par des virgules */
  }
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

/**
 * Déduplique, ne garde que les valeurs connues et garantit au moins « Espèces ».
 * Accepte un tableau, une chaîne JSON ou une liste séparée par des virgules.
 */
/** Libellé affiché d'un moyen (les valeurs stockées restent inchangées). */
export function paymentMethodLabel(method: string, lang: Lang): string {
  if (lang === 'fr') return method;
  const labels: Record<string, Record<Exclude<Lang, 'fr'>, string>> = {
    'Espèces': { en: 'Cash', dyu: 'Wari', bci: 'Wari' },
    'Wave': { en: 'Wave', dyu: 'Wave', bci: 'Wave' },
    'Orange Money': { en: 'Orange Money', dyu: 'Orange Money', bci: 'Orange Money' },
    'MTN MoMo': { en: 'MTN MoMo', dyu: 'MTN MoMo', bci: 'MTN MoMo' },
    'Moov Money': { en: 'Moov Money', dyu: 'Moov Money', bci: 'Moov Money' },
    'Carte bancaire': { en: 'Bank card', dyu: 'Kart', bci: 'Kart' },
  };
  return labels[method]?.[lang as Exclude<Lang, 'fr'>] ?? method;
}

export function normalizeMethods(input: unknown): string[] {
  const result: string[] = [];
  for (const item of toArray(input)) {
    const method = item.trim();
    if (KNOWN.has(method) && !result.includes(method)) result.push(method);
  }
  if (!result.includes('Espèces')) result.unshift('Espèces');
  return result;
}
