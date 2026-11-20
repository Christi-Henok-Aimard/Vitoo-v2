/** Trajets publics, recherche, réservation espèces et notation. */
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Booking, Ticket, Trip } from '@prisma/client';
import { prisma, isUniqueError } from '../db.js';
import {
  findOrCreatePassenger,
  optionalAuth,
  requireAuth,
  HttpError,
} from '../auth.js';
import {
  notifyBookingConfirmed,
  runReminderScheduler,
} from '../notifications.js';

export const tripsRouter = Router();

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Parse un champ JSON de tableau, avec repli sur une chaîne séparée par des virgules. */
export const parseStringArray = (raw: string | null | undefined, fallback: string[] = []): string[] => {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    // Chaîne brute : on découpe par virgules.
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export interface TripView {
  id: string;
  companyId: string;
  driverId: string | null;
  vehicleId: string | null;
  depart: string;
  arrivee: string;
  station: string | null;
  date: Date;
  time: string;
  duration: string | null;
  price: number;
  availableSeats: number;
  company: string;
  driverName: string | null;
  driverRating: number;
  vehiclePlate: string | null;
  stops: string[];
  status: string;
  paymentMethods: string[];
}

/** Format public d'un trajet (compagnie, chauffeur, véhicule, note). */
export const formatTrip = async (trip: Trip): Promise<TripView> => {
  const [company, driver, vehicle, ratings] = await Promise.all([
    prisma.user.findUnique({ where: { id: trip.companyId }, select: { companyName: true } }),
    trip.driverId
      ? prisma.driver.findUnique({ where: { id: trip.driverId }, include: { user: true } })
      : Promise.resolve(null),
    trip.vehicleId ? prisma.vehicle.findUnique({ where: { id: trip.vehicleId } }) : Promise.resolve(null),
    trip.driverId
      ? prisma.rating.findMany({
          where: { trip: { driverId: trip.driverId } },
          select: { driverStars: true },
        })
      : Promise.resolve([]),
  ]);
  const driverRating = ratings.length
    ? Math.round((ratings.reduce((sum, item) => sum + item.driverStars, 0) / ratings.length) * 10) / 10
    : 0;
  return {
    id: trip.id,
    companyId: trip.companyId,
    driverId: trip.driverId,
    vehicleId: trip.vehicleId,
    depart: trip.depart,
    arrivee: trip.arrivee,
    station: trip.station,
    date: trip.date,
    time: trip.time,
    duration: trip.duration,
    price: trip.price,
    availableSeats: trip.availableSeats,
    company: company?.companyName || '',
    driverName: driver ? `${driver.user.firstName} ${driver.user.lastName}`.trim() : null,
    driverRating,
    vehiclePlate: vehicle?.plateNumber ?? null,
    stops: parseStringArray(trip.stops),
    status: trip.status,
    paymentMethods: parseStringArray(trip.paymentMethods, ['Espèces']),
  };
};

export const generateTicketCode = (): string =>
  `VT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

/** Crée (de façon idempotente) réservation + billet, puis notifie et planifie. */
export const createBookingAndTicket = async (input: {
  userId: string;
  tripId: string;
  passengerName: string;
  passengerPhone: string;
  seats: number;
  amount: number;
  paymentMethod: string;
  soldBy?: 'online' | 'counter';
}): Promise<{ booking: Booking; ticket: Ticket }> => {
  const trip = await prisma.trip.findUnique({ where: { id: input.tripId } });
  if (!trip) throw new HttpError(404, 'Trajet introuvable.');

  const existing = await prisma.booking.findFirst({
    where: { userId: input.userId, tripId: input.tripId },
  });
  if (existing?.status === 'confirmed') {
    throw new HttpError(409, 'Vous avez déjà réservé ce trajet.');
  }

  // Décrément atomique : évite de vendre plus de places qu'il n'en reste.
  const updated = await prisma.trip.updateMany({
    where: { id: input.tripId, availableSeats: { gte: input.seats } },
    data: { availableSeats: { decrement: input.seats } },
  });
  if (updated.count === 0) throw new HttpError(400, 'Places insuffisantes.');

  let booking: Booking | null = existing;
  if (!booking) {
    try {
      booking = await prisma.booking.create({
        data: {
          userId: input.userId,
          tripId: input.tripId,
          passengerName: input.passengerName,
          passengerPhone: input.passengerPhone,
          seats: input.seats,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          status: 'confirmed',
        },
      });
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      booking = await prisma.booking.findFirst({
        where: { userId: input.userId, tripId: input.tripId },
      });
      if (!booking) throw error;
    }
  } else {
    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'confirmed', passengerName: input.passengerName, passengerPhone: input.passengerPhone },
    });
  }

  let ticket = await prisma.ticket.findUnique({ where: { bookingId: booking.id } });
  if (!ticket) {
    const soldCount = await prisma.ticket.count({ where: { tripId: input.tripId } });
    ticket = await prisma.ticket.create({
      data: {
        bookingId: booking.id,
        tripId: input.tripId,
        companyId: trip.companyId,
        code: generateTicketCode(),
        qrData: trip.id,
        seatNumber: `T${soldCount + 1}`,
        passengerName: input.passengerName,
        passengerPhone: input.passengerPhone,
        paymentMethod: input.paymentMethod,
        amount: input.amount,
        soldBy: input.soldBy ?? 'online',
      },
    });
  }

  await notifyBookingConfirmed(booking.userId, trip.id, booking.id);
  // Cas du billet pris 2 jours avant : on évalue les rappels immédiatement.
  await runReminderScheduler();
  return { booking, ticket };
};

// --- Routes --------------------------------------------------------------

tripsRouter.get('/companies', async (_request, response) => {
  const users = await prisma.user.findMany({
    where: { role: 'company', companyName: { not: null } },
    select: { companyName: true },
  });
  const companies = [...new Set(users.map((user) => user.companyName!).filter(Boolean))].sort();
  return response.json({ companies });
});

tripsRouter.get('/cities', async (_request, response) => {
  const [trips, users] = await Promise.all([
    prisma.trip.findMany({ select: { depart: true, arrivee: true } }),
    prisma.user.findMany({ where: { city: { not: null } }, select: { city: true } }),
  ]);
  const cities = new Set<string>();
  trips.forEach((trip) => {
    cities.add(trip.depart);
    cities.add(trip.arrivee);
  });
  users.forEach((user) => user.city && cities.add(user.city));
  return response.json({ cities: [...cities].sort() });
});

tripsRouter.get('/bookings/mine', requireAuth, async (request, response) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: request.user!.id },
    orderBy: { id: 'desc' },
  });
  const result = await Promise.all(
    bookings.map(async (booking) => {
      const trip = await prisma.trip.findUnique({ where: { id: booking.tripId } });
      const ticket = await prisma.ticket.findUnique({ where: { bookingId: booking.id } });
      return { ...booking, trip: trip ? await formatTrip(trip) : null, ticket };
    }),
  );
  return response.json({ bookings: result });
});

tripsRouter.get('/', async (request, response) => {
  const where: Record<string, unknown> = {};
  const depart = str(request.query.depart);
  const arrivee = str(request.query.arrivee);
  const date = str(request.query.date);
  const company = str(request.query.company);
  if (depart) where.depart = { contains: depart };
  if (arrivee) where.arrivee = { contains: arrivee };
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      where.date = { gte: start, lte: end };
    }
  }
  if (company) {
    const companies = await prisma.user.findMany({
      where: { companyName: { contains: company } },
      select: { id: true },
    });
    where.companyId = { in: companies.map((item) => item.id) };
  }
  const trips = await prisma.trip.findMany({ where, orderBy: { date: 'asc' } });
  return response.json({ trips: await Promise.all(trips.map(formatTrip)) });
});

tripsRouter.get('/:id', async (request, response) => {
  const trip = await prisma.trip.findUnique({ where: { id: str(request.params.id) } });
  if (!trip) return response.status(404).json({ message: 'Trajet introuvable.' });
  return response.json({ trip: await formatTrip(trip) });
});

tripsRouter.post('/:id/bookings', optionalAuth, async (request, response) => {
  const body = request.body ?? {};
  const trip = await prisma.trip.findUnique({ where: { id: str(request.params.id) } });
  if (!trip) return response.status(404).json({ message: 'Trajet introuvable.' });

  const rawMethod = str(body.paymentMethod) || 'Espèces';
  // On ignore les accents pour accepter « Espèces » comme « especes ».
  const normalizedMethod = rawMethod
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const isCash = ['especes', 'espece', 'cash', 'liquide'].includes(normalizedMethod);
  if (!isCash) {
    return response
      .status(400)
      .json({ message: 'Seul le paiement en espèces est accepté ici. Utilisez le paiement en ligne.' });
  }
  const passengerName = str(body.passengerName);
  const passengerPhone = str(body.passengerPhone);
  if (!passengerName || !passengerPhone) {
    return response.status(400).json({ message: 'passengerName et passengerPhone sont requis.' });
  }
  const user =
    request.user ??
    (await findOrCreatePassenger({ phone: passengerPhone, name: passengerName }));

  try {
    const { booking, ticket } = await createBookingAndTicket({
      userId: user.id,
      tripId: trip.id,
      passengerName,
      passengerPhone,
      seats: 1,
      amount: trip.price,
      paymentMethod: 'Espèces',
    });
    return response.status(201).json({ booking, ticket });
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
    throw error;
  }
});

tripsRouter.post('/:id/rating', requireAuth, async (request, response) => {
  const body = request.body ?? {};
  const driverStars = Number(body.driverStars);
  const companyStars = Number(body.companyStars);
  if (!Number.isInteger(driverStars) || !Number.isInteger(companyStars) ||
      driverStars < 1 || driverStars > 5 || companyStars < 1 || companyStars > 5) {
    return response.status(400).json({ message: 'Les notes doivent être comprises entre 1 et 5.' });
  }
  const booking = await prisma.booking.findFirst({
    where: { userId: request.user!.id, tripId: str(request.params.id), status: 'confirmed' },
  });
  if (!booking) {
    return response.status(403).json({ message: 'Réservation requise pour noter ce trajet.' });
  }
  const existing = await prisma.rating.findFirst({
    where: { userId: request.user!.id, tripId: str(request.params.id) },
  });
  const data = {
    driverStars,
    companyStars,
    comment: body.comment ? str(body.comment) : null,
  };
  const rating = existing
    ? await prisma.rating.update({ where: { id: existing.id }, data })
    : await prisma.rating.create({
        data: { userId: request.user!.id, tripId: str(request.params.id), ...data },
      });
  return response.json({ rating });
});
