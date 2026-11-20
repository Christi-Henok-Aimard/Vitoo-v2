/** Liste fermée des moyens de paiement acceptés par Vitoo (voir EVOLUTIONS_V3 §2.5). */

export const PAYMENT_METHODS = [
  'Espèces',
  'Wave',
  'Orange Money',
  'MTN MoMo',
  'Moov Money',
  'Carte bancaire',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Tous les moyens sauf « Espèces » passent par GeniusPay. */
export const ONLINE_METHODS = PAYMENT_METHODS.filter((method) => method !== 'Espèces');

const CASH = 'Espèces';

/** Comparaison tolérante (casse et accents) pour accepter « especes » etc. */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const byFold = new Map<string, PaymentMethod>(
  PAYMENT_METHODS.map((method) => [fold(method), method]),
);

/** Ramène une valeur à un moyen connu, ou null si elle est inconnue. */
export const canonicalMethod = (value: unknown): PaymentMethod | null => {
  if (typeof value !== 'string') return null;
  return byFold.get(fold(value)) ?? null;
};

/** Un moyen est « en ligne » dès qu'il n'est pas « Espèces ». */
export const isOnlineMethod = (method: string): boolean =>
  canonicalMethod(method) !== null && fold(method) !== fold(CASH);

/**
 * Déduplique, filtre les valeurs inconnues et garantit au moins « Espèces ».
 * Accepte un tableau ou une chaîne séparée par des virgules (anciens formulaires).
 */
export const normalizeMethods = (input: unknown): string[] => {
  const values: unknown[] = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  const result: string[] = [];
  for (const value of values) {
    const method = canonicalMethod(value);
    if (method && !result.includes(method)) result.push(method);
  }
  if (!result.includes(CASH)) result.unshift(CASH);
  return result;
};
