/** Paiements GeniusPay : initiation, statut, confirmation et webhook HMAC. */
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Booking, Payment, Ticket } from '@prisma/client';
import { prisma, isUniqueError } from '../db.js';
import {
  createCheckout,
  frontendUrl,
  isGeniusPayConfigured,
  verifyTransaction,
  verifyWebhookSignature,
} from '../geniuspay.js';
import { findOrCreatePassenger, HttpError } from '../auth.js';
import { canonicalMethod, isOnlineMethod } from '../paymentMethods.js';
import { createBookingAndTicket, parseStringArray } from './trips.js';

export const paymentsRouter = Router();

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

interface PendingPassenger {
  name: string;
  phone: string;
  email?: string;
  seats: number;
}

// Infos passager conservées dans le champ libre `errorMessage` le temps du
// paiement : la BDD reste l'unique source de vérité (aucun store mémoire).
const storePassenger = (passenger: PendingPassenger): string =>
  `PASSENGER:${JSON.stringify(passenger)}`;
const readPassenger = (raw: string | null): PendingPassenger | null => {
  if (!raw || !raw.startsWith('PASSENGER:')) return null;
  try {
    return JSON.parse(raw.slice('PASSENGER:'.length)) as PendingPassenger;
  } catch {
    return null;
  }
};

const findPayment = async (idOrReference: string): Promise<Payment | null> =>
  (await prisma.payment.findUnique({ where: { id: idOrReference } })) ??
  (await prisma.payment.findUnique({ where: { transactionId: idOrReference } }));

/** Finalisation idempotente : Booking + Ticket + notification + scheduler. */
const finalizePaidPayment = async (
  paymentId: string,
  channel?: string,
): Promise<{ status: 'paid'; booking: Booking | null; ticket: Ticket | null }> => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new HttpError(404, 'Paiement introuvable.');
  if (payment.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: { ticket: true },
    });
    return { status: 'paid', booking, ticket: booking?.ticket ?? null };
  }
  const pending = readPassenger(payment.errorMessage);
  if (!pending) throw new HttpError(409, 'Données passager manquantes pour ce paiement.');
  const user = await findOrCreatePassenger({
    phone: pending.phone,
    name: pending.name,
    email: pending.email,
  });
  const { booking, ticket } = await createBookingAndTicket({
    userId: user.id,
    tripId: payment.tripId,
    passengerName: pending.name,
    passengerPhone: pending.phone,
    seats: pending.seats,
    amount: payment.amount,
    paymentMethod: channel || 'GeniusPay',
  });
  try {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        bookingId: booking.id,
        channel: channel ?? null,
        errorMessage: null,
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      throw new HttpError(409, 'Ce paiement a déjà été finalisé.');
    }
    throw error;
  }
  return { status: 'paid', booking, ticket };
};

const paymentView = (payment: Payment) => ({
  id: payment.id,
  status: payment.status,
  amount: payment.amount,
  channel: payment.channel,
});

// Webhook : enregistré avant /:id pour éviter toute ambiguïté de route.
paymentsRouter.post('/webhook/geniuspay', async (request, response) => {
  const signature = request.header('x-webhook-signature') || '';
  const timestamp = request.header('x-webhook-timestamp') || '';
  const eventHeader = request.header('x-webhook-event') || '';
  const check = verifyWebhookSignature(request.rawBody, signature, timestamp);
  if (check === 'invalid') return response.status(401).json({ status: 'invalid' });
  if (check === 'expired') return response.status(400).json({ status: 'expired' });

  const body = request.body as {
    event?: string;
    data?: { reference?: string; status?: string; payment_method?: string; provider?: string };
  };
  const event = eventHeader || str(body.event);
  const reference = str(body.data?.reference);
  if (!reference) return response.json({ status: 'ignored' });

  const payment = await prisma.payment.findUnique({ where: { transactionId: reference } });
  if (!payment || payment.status === 'paid' || payment.status === 'failed') {
    return response.json({ status: 'ignored' });
  }
  const rawStatus = str(body.data?.status).toLowerCase();
  const isSuccess =
    ['payment.success', 'payment.completed', 'success'].includes(event.toLowerCase()) ||
    ['completed', 'paid', 'success'].includes(rawStatus);
  const isFailure =
    ['payment.failed', 'payment.cancelled', 'payment.expired'].includes(event.toLowerCase()) ||
    ['failed', 'expired', 'cancelled'].includes(rawStatus);

  if (isSuccess) {
    try {
      await finalizePaidPayment(
        payment.id,
        str(body.data?.payment_method) || str(body.data?.provider) || undefined,
      );
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        return response.status(409).json({ status: 'error', message: error.message });
      }
      throw error;
    }
  } else if (isFailure) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
  }
  return response.json({ status: 'ok' });
});

paymentsRouter.post('/initiate', async (request, response) => {
  const body = request.body ?? {};
  const tripId = str(body.tripId);
  const passengerName = str(body.passengerName);
  const passengerPhone = str(body.passengerPhone);
  const passengerEmail = str(body.passengerEmail);
  const method = str(body.method);
  if (!tripId || !passengerName || !passengerPhone || !method) {
    return response.status(400).json({ message: 'tripId, passengerName, passengerPhone et method sont requis.' });
  }
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return response.status(404).json({ message: 'Trajet introuvable.' });
  const methodName = canonicalMethod(method);
  const tripMethods = parseStringArray(trip.paymentMethods, ['Espèces']);
  if (
    !methodName ||
    !isOnlineMethod(methodName) ||
    !tripMethods.includes(methodName)
  ) {
    return response.status(400).json({
      message: 'Moyen de paiement en ligne non autorisé pour ce trajet.',
    });
  }
  const seats = Math.max(1, Number(body.seats) || 1);
  if (seats > trip.availableSeats) {
    return response.status(400).json({ message: 'Places insuffisantes.' });
  }
  if (!isGeniusPayConfigured()) {
    return response.status(503).json({ message: 'Paiement en ligne indisponible (clés GeniusPay absentes).' });
  }
  const amount = trip.price * seats;
  const localRef = `gp_${randomBytes(12).toString('hex')}`;
  const base = frontendUrl();
  const successUrl = `${base}/passenger/payment-return?paymentId=${localRef}`;
  const errorUrl = `${base}/passenger/payment-return?paymentId=${localRef}&error=1`;

  let checkout: { reference: string; paymentUrl: string };
  try {
    checkout = await createCheckout({
      amount,
      description: `Billet Vitoo ${trip.depart} - ${trip.arrivee}`,
      customer: { name: passengerName, email: passengerEmail || undefined, phone: passengerPhone, country: 'CI' },
      metadata: { localRef, tripId, passengerPhone, seats: String(seats) },
      successUrl,
      errorUrl,
    });
  } catch (error) {
    console.error('[paiement] GeniusPay checkout :', error);
    return response.status(502).json({ message: 'Impossible d’initier le paiement chez GeniusPay.' });
  }

  try {
    const payment = await prisma.payment.create({
      data: {
        id: localRef,
        tripId,
        amount,
        transactionId: checkout.reference,
        paymentUrl: checkout.paymentUrl,
        status: 'pending',
        errorMessage: storePassenger({
          name: passengerName,
          phone: passengerPhone,
          email: passengerEmail || undefined,
          seats,
        }),
      },
    });
    return response.json({ paymentId: payment.id, paymentUrl: checkout.paymentUrl, amount });
  } catch (error) {
    if (isUniqueError(error)) return response.status(409).json({ message: 'Référence de paiement déjà utilisée.' });
    throw error;
  }
});

paymentsRouter.get('/:id', async (request, response) => {
  const payment = await findPayment(request.params.id);
  if (!payment) return response.status(404).json({ message: 'Paiement introuvable.' });

  // Normalisation paresseuse du statut (sans effet de bord métier).
  if (payment.status === 'pending' && isGeniusPayConfigured()) {
    try {
      const check = await verifyTransaction(payment.transactionId);
      if (check.status === 'paid' || check.status === 'failed') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: check.status, channel: check.paymentMethod ?? payment.channel },
        });
      }
    } catch {
      // On renvoie le statut connu en base si GeniusPay est injoignable.
    }
  }
  const fresh = (await prisma.payment.findUnique({ where: { id: payment.id } })) ?? payment;
  const booking = fresh.bookingId
    ? await prisma.booking.findUnique({ where: { id: fresh.bookingId } })
    : null;
  return response.json({
    payment: paymentView(fresh),
    ...(booking ? { booking } : {}),
  });
});

paymentsRouter.post('/:id/confirm', async (request, response) => {
  const payment = await findPayment(request.params.id);
  if (!payment) return response.status(404).json({ message: 'Paiement introuvable.' });
  if (payment.status === 'paid' && payment.bookingId) {
    const done = await finalizePaidPayment(payment.id);
    return response.json(done);
  }
  if (payment.status === 'failed') return response.json({ status: 'failed' });
  if (!isGeniusPayConfigured()) {
    return response.status(503).json({ message: 'Paiement en ligne indisponible (clés GeniusPay absentes).' });
  }

  let check;
  try {
    check = await verifyTransaction(payment.transactionId);
  } catch (error) {
    console.error('[paiement] vérification GeniusPay :', error);
    return response.status(502).json({ message: 'Impossible de vérifier le paiement auprès de GeniusPay.' });
  }
  if (check.status === 'paid') {
    try {
      const done = await finalizePaidPayment(payment.id, check.paymentMethod);
      return response.json(done);
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        return response.status(409).json({ message: error.message });
      }
      throw error;
    }
  }
  if (check.status === 'failed') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    return response.json({ status: 'failed' });
  }
  return response.json({ status: 'pending' });
});
