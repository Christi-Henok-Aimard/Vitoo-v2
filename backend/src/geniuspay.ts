/**
 * Intégration GeniusPay (unique passerelle de paiement en ligne).
 * - Création de checkout : POST {baseUrl}/payments avec X-API-Key / X-API-Secret
 * - Vérification : GET {baseUrl}/payments/{reference}
 * - Webhook : HMAC-SHA256 sur `timestamp.rawBody`
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://geniuspay.ci/api/v1/merchant';
const CURRENCY = 'XOF';

const config = () => ({
  apiKey: process.env.GENIUSPAY_API_KEY || '',
  apiSecret: process.env.GENIUSPAY_API_SECRET || '',
  baseUrl: (process.env.GENIUSPAY_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
});

export const isGeniusPayConfigured = (): boolean => {
  const { apiKey, apiSecret } = config();
  return Boolean(apiKey && apiSecret);
};

export const frontendUrl = (): string =>
  (process.env.FRONTEND_URL || process.env.CLIENT_ORIGINS || 'http://localhost:5173')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const { apiKey, apiSecret, baseUrl } = config();
  if (!apiKey || !apiSecret) {
    throw new Error('GeniusPay n\'est pas configuré (GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET).');
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-API-Secret': apiSecret,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GeniusPay ${path} → HTTP ${response.status}`);
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Réponse GeniusPay illisible (${response.status}).`);
  }
};

export interface CheckoutInput {
  amount: number;
  description: string;
  customer: { name: string; email?: string; phone: string; country?: string };
  metadata: Record<string, string>;
  successUrl: string;
  errorUrl: string;
}

/** Crée un checkout et renvoie la référence + l'URL de paiement. */
export const createCheckout = async (
  input: CheckoutInput,
): Promise<{ reference: string; paymentUrl: string }> => {
  const payload = await request<{
    success?: boolean;
    data?: { reference?: string; checkout_url?: string; payment_url?: string };
    message?: string;
  }>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      currency: CURRENCY,
      description: input.description.slice(0, 500),
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        country: input.customer.country || 'CI',
      },
      success_url: input.successUrl,
      error_url: input.errorUrl,
      metadata: input.metadata,
    }),
  });
  const data = payload.data || {};
  const reference = data.reference || '';
  const paymentUrl = data.checkout_url || data.payment_url || '';
  if (!reference || !paymentUrl) {
    throw new Error(String(payload.message || 'GeniusPay : création de paiement refusée.'));
  }
  return { reference, paymentUrl };
};

export type GeniusPayStatus = 'paid' | 'failed' | 'pending' | 'unknown';

export interface CheckResult {
  status: GeniusPayStatus;
  paymentMethod?: string;
}

/** Statut normalisé chez GeniusPay pour une référence donnée. */
export const verifyTransaction = async (reference: string): Promise<CheckResult> => {
  const payload = await request<{
    data?: { status?: string; payment_method?: string | null; payment_provider?: string | null };
  }>(`/payments/${encodeURIComponent(reference)}`, { method: 'GET' });
  const raw = String(payload.data?.status || '').toLowerCase();
  let status: GeniusPayStatus = 'unknown';
  if (raw === 'completed' || raw === 'paid' || raw === 'success') status = 'paid';
  else if (['failed', 'expired', 'cancelled'].includes(raw)) status = 'failed';
  else if (['pending', 'processing', 'initiated'].includes(raw)) status = 'pending';
  return {
    status,
    paymentMethod:
      payload.data?.payment_method || payload.data?.payment_provider || undefined,
  };
};

export type WebhookCheck = 'ok' | 'invalid' | 'expired';

/** Vérifie la signature HMAC du webhook sur le corps brut. */
export const verifyWebhookSignature = (
  rawBody: Buffer | undefined,
  signature: string,
  timestamp: string,
): WebhookCheck => {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET || '';
  if (!secret || !signature || !timestamp || !rawBody || rawBody.length === 0) return 'invalid';
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return 'expired';
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return 'invalid';
  }
  return 'ok';
};

/** Libellé lisible d'un canal de paiement GeniusPay. */
export const paymentMethodLabel = (channel?: string | null): string => {
  const raw = (channel || '').toLowerCase();
  if (raw.includes('wave')) return 'Wave';
  if (raw.includes('orange')) return 'Orange Money';
  if (raw.includes('mtn')) return 'MTN MoMo';
  if (raw.includes('moov')) return 'Moov Money';
  if (raw.includes('card') || raw.includes('visa') || raw.includes('master')) return 'Carte bancaire';
  return channel || 'Paiement en ligne';
};
