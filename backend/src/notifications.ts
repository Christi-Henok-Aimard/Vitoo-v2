/**
 * Notifications : source de vérité en BDD (dedupeKey unique), scheduler de
 * rappels (toutes les minutes), événements en direct et diffusion optionnelle
 * e-mail/SMS (silencieuse si les clés ne sont pas configurées).
 */
import { prisma } from './db.js';

/** Départ = trip.date (jour) + trip.time (HH:MM). */
export const departureTimestamp = (date: Date, time: string): number => {
  const [hours, minutes] = time.split(':');
  const departure = new Date(date);
  departure.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return departure.getTime();
};

/** Diffusion optionnelle : ne jamais lever d'erreur, même non configurée. */
const sendOptionalChannels = async (userId: string, subject: string, text: string): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    if (process.env.RESEND_API_KEY && user.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'Vitoo <onboarding@resend.dev>',
          to: [user.email],
          subject,
          text,
        }),
      });
    }

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: user.phone,
          From: process.env.TWILIO_FROM_NUMBER,
          Body: text,
        }),
      });
    }

    if (process.env.AFRICAS_TALKING_USERNAME && process.env.AFRICAS_TALKING_API_KEY) {
      const params: Record<string, string> = {
        username: process.env.AFRICAS_TALKING_USERNAME,
        to: user.phone,
        message: text,
      };
      if (process.env.AFRICAS_TALKING_FROM) params.from = process.env.AFRICAS_TALKING_FROM;
      await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'api-key': process.env.AFRICAS_TALKING_API_KEY,
        },
        body: new URLSearchParams(params),
      });
    }
  } catch (error) {
    // Diffusionbest-effort : une panne e-mail/SMS ne doit jamais casser l'API.
    console.warn('[notifications] diffusion optionnelle ignorée :', error);
  }
};

/**
 * Envoi direct (e-mail / SMS) à des coordonnées fournies.
 * Utilisé notamment pour prévenir un compte supprimé par un admin :
 * la notification en base disparaîtrait avec le compte, seul un canal
 * externe peut donc être utilisé. Retourne true si au moins un canal
 * était configuré (même si l'envoi a échoué, il est best-effort).
 */
export const sendDirectMessage = async (
  contacts: { email?: string | null; phone?: string | null },
  subject: string,
  text: string,
): Promise<boolean> => {
  let configured = false;
  try {
    if (process.env.RESEND_API_KEY && contacts.email) {
      configured = true;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'Vitoo <onboarding@resend.dev>',
          to: [contacts.email],
          subject,
          text,
        }),
      });
    }
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && contacts.phone) {
      configured = true;
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: contacts.phone, From: process.env.TWILIO_FROM_NUMBER, Body: text }),
      });
    }
    if (process.env.AFRICAS_TALKING_USERNAME && process.env.AFRICAS_TALKING_API_KEY && contacts.phone) {
      configured = true;
      const params: Record<string, string> = {
        username: process.env.AFRICAS_TALKING_USERNAME,
        to: contacts.phone,
        message: text,
      };
      if (process.env.AFRICAS_TALKING_FROM) params.from = process.env.AFRICAS_TALKING_FROM;
      await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'api-key': process.env.AFRICAS_TALKING_API_KEY },
        body: new URLSearchParams(params),
      });
    }
  } catch (error) {
    console.warn('[notifications] message direct ignoré :', error);
  }
  return configured;
};

export interface NotificationInput {
  userId: string;
  tripId?: string | null;
  type: string;
  title: string;
  body: string;
  dedupeKey: string;
}

/** Crée (ou ignore) une notification. Jamais de doublon grâce à dedupeKey. */
export const createNotification = async (input: NotificationInput): Promise<void> => {
  try {
    await prisma.notification.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: {
        userId: input.userId,
        tripId: input.tripId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey,
      },
      update: {},
    });
    void sendOptionalChannels(input.userId, input.title, input.body);
  } catch (error) {
    console.error('[notifications] création ignorée :', error);
  }
};

/** Notification « réservation confirmée ». */
export const notifyBookingConfirmed = async (
  userId: string,
  tripId: string,
  bookingId: string,
): Promise<void> => {
  await createNotification({
    userId,
    tripId,
    type: 'booking_confirmed',
    title: 'Réservation confirmée',
    body: 'Votre réservation est confirmée. Présentez votre billet à l’embarquement.',
    dedupeKey: `booking-confirmed:${bookingId}`,
  });
};

/** Événement en direct : notifie tous les passagers du trajet. */
export const notifyTripPassengers = async (
  tripId: string,
  type: 'scanned' | 'departed' | 'stop' | 'arrived',
  title: string,
  body: string,
): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { tripId, status: 'confirmed' },
      select: { userId: true },
    });
    const userIds = [...new Set(bookings.map((booking) => booking.userId))];
    await Promise.all(
      userIds.map((userId) =>
        createNotification({
          userId,
          tripId,
          type,
          title,
          body,
          dedupeKey: `${type}:${tripId}:${userId}`,
        }),
      ),
    );
  } catch (error) {
    console.error('[notifications] événement ignoré :', error);
  }
};

// Les 5 jalons de rappel avant le départ (voir CONTRAT_API.md §3.1).
const REMINDERS = [
  {
    key: 'rem48h',
    type: 'reminder_48h',
    offset: 48 * 60 * 60 * 1000,
    title: 'Rappel : départ dans 2 jours',
    body: (station: string, time: string) =>
      `Rendez-vous à la gare de ${station} à ${time}. Votre départ est dans 2 jours.`,
  },
  {
    key: 'rem24h',
    type: 'reminder_24h',
    offset: 24 * 60 * 60 * 1000,
    title: 'Rappel : départ demain',
    body: (station: string, time: string) =>
      `Demain, rendez-vous à la gare de ${station} à ${time}.`,
  },
  {
    key: 'rem6h',
    type: 'reminder_6h',
    offset: 6 * 60 * 60 * 1000,
    title: 'Rappel : départ aujourd’hui',
    body: (station: string, time: string) =>
      `Aujourd'hui, pensez à votre départ à ${time} depuis ${station}.`,
  },
  {
    key: 'rem2h',
    type: 'reminder_2h',
    offset: 2 * 60 * 60 * 1000,
    title: 'Rappel : départ dans 2 heures',
    body: (_station: string, _time: string) =>
      'Votre car part dans 2 heures. Préparez votre billet.',
  },
  {
    key: 'rem10m',
    type: 'reminder_10m',
    offset: 10 * 60 * 1000,
    title: 'Rappel : départ dans 10 minutes',
    body: (station: string, _time: string) =>
      `Le car part dans 10 minutes, rendez-vous à la gare de ${station}.`,
  },
] as const;

/** Passe tous les rappels dus. Appelé par le scheduler et après chaque réservation. */
export const runReminderScheduler = async (): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: 'confirmed' },
      include: { trip: true },
    });
    const now = Date.now();
    for (const booking of bookings) {
      const trip = booking.trip;
      const departure = departureTimestamp(trip.date, trip.time);
      if (!Number.isFinite(departure) || departure <= now) continue;
      const station = trip.station || trip.depart;
      for (const reminder of REMINDERS) {
        if (now >= departure - reminder.offset) {
          await createNotification({
            userId: booking.userId,
            tripId: trip.id,
            type: reminder.type,
            title: reminder.title,
            body: reminder.body(station, trip.time),
            dedupeKey: `${reminder.key}:${booking.id}`,
          });
        }
      }
    }
  } catch (error) {
    console.error('[notifications] scheduler erreur :', error);
  }
};

let scheduler: NodeJS.Timeout | null = null;

/** Démarre la boucle du scheduler (1 minute) et l'exécute une fois au boot. */
export const startNotificationScheduler = (): void => {
  if (scheduler) return;
  void runReminderScheduler();
  scheduler = setInterval(() => {
    void runReminderScheduler();
  }, 60_000);
  scheduler.unref();
};
