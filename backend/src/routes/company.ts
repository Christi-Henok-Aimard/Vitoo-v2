/** Espace compagnie : trajets, chauffeurs, véhicules, billets, statistiques. */
import { Router } from 'express';
import { Prisma, TripStatus, DriverStatus } from '@prisma/client';
import { prisma, isUniqueError } from '../db.js';
import {
  driverView,
  findOrCreatePassenger,
  findUserByPhone,
  hashPassword,
  normalizePhone,
  requireAuth,
  requireRole,
  validatePassword,
  HttpError,
} from '../auth.js';
import { normalizeMethods } from '../paymentMethods.js';
import { formatTrip, parseStringArray, createBookingAndTicket } from './trips.js';

export const companyRouter = Router();
companyRouter.use(requireAuth, requireRole('company'));

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const companyIdOf = (request: { user?: { id: string } }): string => request.user!.id;

const jsonArray = (value: unknown, fallback: string[]): string => {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => String(item)));
  return JSON.stringify(parseStringArray(str(value), fallback));
};

type TripInput = {
  depart?: string | null;
  arrivee?: string | null;
  station?: string | null;
  time?: string | null;
  duration?: string | null;
  price?: number;
  availableSeats?: number;
  date?: Date;
  stops?: string;
  paymentMethods?: string;
  status?: TripStatus;
  driverId?: string | null;
  vehicleId?: string | null;
};

/** Construit/valide les données modifiables d'un trajet. */
const tripPayload = async (
  body: Record<string, unknown>,
  companyId: string,
): Promise<TripInput> => {
  const data: TripInput = {};
  for (const field of ['depart', 'arrivee', 'station', 'time', 'duration'] as const) {
    if (body[field] !== undefined) data[field] = str(body[field]) || null;
  }
  if (body.price !== undefined) data.price = Number(body.price) || 0;
  if (body.availableSeats !== undefined) data.availableSeats = Number(body.availableSeats) || 0;
  if (body.date !== undefined) {
    const date = new Date(str(body.date));
    if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Date invalide.');
    data.date = date;
  }
  if (body.stops !== undefined) data.stops = jsonArray(body.stops, []);
  if (body.paymentMethods !== undefined) {
    data.paymentMethods = JSON.stringify(normalizeMethods(body.paymentMethods));
  }
  if (body.status !== undefined) {
    if (!Object.values(TripStatus).includes(body.status as TripStatus)) {
      throw new HttpError(400, 'Statut de trajet invalide.');
    }
    data.status = body.status as TripStatus;
  }
  if (body.driverId !== undefined && str(body.driverId)) {
    const driver = await prisma.driver.findFirst({
      where: { id: str(body.driverId), companyId },
    });
    if (!driver) throw new HttpError(400, 'Chauffeur introuvable dans votre compagnie.');
    data.driverId = driver.id;
  }
  if (body.vehicleId !== undefined && str(body.vehicleId)) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: str(body.vehicleId), companyId },
    });
    if (!vehicle) throw new HttpError(400, 'Véhicule introuvable dans votre compagnie.');
    data.vehicleId = vehicle.id;
  }
  return data;
};

// --- Trajets -------------------------------------------------------------

companyRouter.get('/trips', async (request, response) => {
  const trips = await prisma.trip.findMany({
    where: { companyId: companyIdOf(request) },
    orderBy: { date: 'desc' },
  });
  return response.json({ trips: await Promise.all(trips.map(formatTrip)) });
});

companyRouter.post('/trips', async (request, response) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  if (!str(body.depart) || !str(body.arrivee) || !str(body.date) || !str(body.time)) {
    return response.status(400).json({ message: 'depart, arrivee, date et time sont requis.' });
  }
  try {
    const data = await tripPayload(body, companyIdOf(request));
    const trip = await prisma.trip.create({
      data: {
        ...data,
        companyId: companyIdOf(request),
        depart: str(body.depart),
        arrivee: str(body.arrivee),
        date: new Date(str(body.date)),
        time: str(body.time),
        price: Number(body.price) || 0,
      } as Prisma.TripUncheckedCreateInput,
    });
    return response.status(201).json({ trip: await formatTrip(trip) });
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
    throw error;
  }
});

companyRouter.get('/trips/:id', async (request, response) => {
  const trip = await prisma.trip.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!trip) return response.status(404).json({ message: 'Trajet introuvable.' });
  const bookings = await prisma.booking.findMany({
    where: { tripId: trip.id, status: 'confirmed' },
    include: { ticket: true },
  });
  return response.json({
    trip: await formatTrip(trip),
    passengers: bookings.map((booking) => ({
      id: booking.id,
      passengerName: booking.passengerName,
      passengerPhone: booking.passengerPhone,
      seats: booking.seats,
      amount: booking.amount,
      paymentMethod: booking.paymentMethod,
      ticket: booking.ticket,
    })),
  });
});

companyRouter.patch('/trips/:id', async (request, response) => {
  const existing = await prisma.trip.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!existing) return response.status(404).json({ message: 'Trajet introuvable.' });
  try {
    const data = await tripPayload((request.body ?? {}) as Record<string, unknown>, companyIdOf(request));
    const trip = await prisma.trip.update({
      where: { id: existing.id },
      data: data as Prisma.TripUncheckedUpdateInput,
    });
    return response.json({ trip: await formatTrip(trip) });
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
    throw error;
  }
});

companyRouter.delete('/trips/:id', async (request, response) => {
  const trip = await prisma.trip.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!trip) return response.status(404).json({ message: 'Trajet introuvable.' });
  await prisma.trip.delete({ where: { id: trip.id } });
  return response.json({ message: 'Trajet supprimé.' });
});

// --- Chauffeurs ----------------------------------------------------------

/**
 * Cherche un passager promoteur potentiel : compte passager sans profil Driver.
 * Le numéro est normalisé avant recherche.
 */
companyRouter.get('/passengers', async (request, response) => {
  const phone = normalizePhone(str(request.query.phone));
  if (!phone) return response.json({ user: null });
  const user = await findUserByPhone(phone);
  if (!user || user.role !== 'passenger') return response.json({ user: null });
  const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
  if (driver) return response.json({ user: null });
  return response.json({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    },
  });
});

companyRouter.get('/drivers', async (request, response) => {
  const drivers = await prisma.driver.findMany({
    where: { companyId: companyIdOf(request) },
    orderBy: { id: 'asc' },
  });
  return response.json({ drivers: await Promise.all(drivers.map(driverView)) });
});

/**
 * Promote un passager existant en chauffeur : aucun compte n'est créé ici,
 * le rôle du User reste 'passenger' et seul un profil Driver est ajouté.
 */
companyRouter.post('/drivers', async (request, response) => {
  const body = request.body ?? {};
  const phone = normalizePhone(body.phone);
  if (!phone) {
    return response.status(400).json({ message: 'Numéro ivoirien valide requis.' });
  }
  const user = await findUserByPhone(phone);
  if (!user || user.role !== 'passenger') {
    return response.status(404).json({
      message: 'Aucun compte passager ne correspond à ce numéro. Invitez cette personne à créer un compte.',
    });
  }
  const existingDriver = await prisma.driver.findUnique({ where: { userId: user.id } });
  if (existingDriver) {
    return response.status(409).json({ message: 'Ce passager est déjà chauffeur.' });
  }
  const driver = await prisma.driver.create({
    data: {
      userId: user.id,
      companyId: companyIdOf(request),
      licenseNumber: str(body.licenseNumber) || null,
      status: DriverStatus.available,
    },
  });
  return response.status(201).json({ driver: await driverView(driver) });
});

companyRouter.get('/drivers/:id', async (request, response) => {
  const driver = await prisma.driver.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!driver) return response.status(404).json({ message: 'Chauffeur introuvable.' });
  return response.json({ driver: await driverView(driver) });
});

companyRouter.patch('/drivers/:id', async (request, response) => {
  const driver = await prisma.driver.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!driver) return response.status(404).json({ message: 'Chauffeur introuvable.' });
  const body = request.body ?? {};
  const userData: Record<string, string | null> = {};
  for (const field of ['firstName', 'lastName', 'email', 'phone', 'city'] as const) {
    if (body[field] !== undefined) userData[field] = str(body[field]) || null;
  }
  if (typeof body.password === 'string' && body.password) {
    try {
      validatePassword(body.password);
    } catch (error) {
      return response.status(400).json({ message: error instanceof HttpError ? error.message : 'Mot de passe invalide.' });
    }
    userData.passwordHash = hashPassword(body.password);
  }
  const driverData: Record<string, unknown> = {};
  if (body.licenseNumber !== undefined) driverData.licenseNumber = str(body.licenseNumber) || null;
  if (body.status !== undefined) {
    if (!Object.values(DriverStatus).includes(body.status as DriverStatus)) {
      return response.status(400).json({ message: 'Statut chauffeur invalide.' });
    }
    driverData.status = body.status;
  }
  try {
    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: driver.userId }, data: userData });
    }
    const updated = await prisma.driver.update({ where: { id: driver.id }, data: driverData });
    return response.json({ driver: await driverView(updated) });
  } catch (error) {
    if (isUniqueError(error)) return response.status(409).json({ message: 'Téléphone ou e-mail déjà utilisé.' });
    throw error;
  }
});

companyRouter.delete('/drivers/:id', async (request, response) => {
  const driver = await prisma.driver.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!driver) return response.status(404).json({ message: 'Chauffeur introuvable.' });
  // On retire uniquement le profil chauffeur : le compte passager reste actif.
  await prisma.driver.delete({ where: { id: driver.id } });
  return response.json({ message: 'Chauffeur supprimé.' });
});

// --- Véhicules -----------------------------------------------------------

companyRouter.get('/vehicles', async (request, response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { companyId: companyIdOf(request) },
    orderBy: { id: 'asc' },
  });
  return response.json({ vehicles });
});

companyRouter.post('/vehicles', async (request, response) => {
  const body = request.body ?? {};
  if (!str(body.plateNumber)) return response.status(400).json({ message: 'plateNumber est requis.' });
  const vehicle = await prisma.vehicle.create({
    data: {
      companyId: companyIdOf(request),
      plateNumber: str(body.plateNumber),
      brand: str(body.brand) || null,
      model: str(body.model) || null,
      capacity: body.capacity !== undefined ? Number(body.capacity) : null,
      photo: str(body.photo) || null,
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  });
  return response.status(201).json({ vehicle });
});

companyRouter.get('/vehicles/:id', async (request, response) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!vehicle) return response.status(404).json({ message: 'Véhicule introuvable.' });
  return response.json({ vehicle });
});

companyRouter.patch('/vehicles/:id', async (request, response) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!vehicle) return response.status(404).json({ message: 'Véhicule introuvable.' });
  const body = request.body ?? {};
  const data: Record<string, unknown> = {};
  for (const field of ['plateNumber', 'brand', 'model', 'photo'] as const) {
    if (body[field] !== undefined) data[field] = str(body[field]) || null;
  }
  if (body.capacity !== undefined) data.capacity = Number(body.capacity);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  const updated = await prisma.vehicle.update({ where: { id: vehicle.id }, data });
  return response.json({ vehicle: updated });
});

companyRouter.delete('/vehicles/:id', async (request, response) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: request.params.id, companyId: companyIdOf(request) },
  });
  if (!vehicle) return response.status(404).json({ message: 'Véhicule introuvable.' });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  return response.json({ message: 'Véhicule supprimé.' });
});

// --- Billets (guichet) ---------------------------------------------------

companyRouter.get('/tickets', async (request, response) => {
  const tripId = str(request.query.tripId);
  const tickets = await prisma.ticket.findMany({
    where: { companyId: companyIdOf(request), ...(tripId ? { tripId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return response.json({ tickets });
});

companyRouter.post('/tickets', async (request, response) => {
  const body = request.body ?? {};
  const trip = await prisma.trip.findFirst({
    where: { id: str(body.tripId), companyId: companyIdOf(request) },
  });
  if (!trip) return response.status(404).json({ message: 'Trajet introuvable.' });
  const passengerName = str(body.passengerName);
  const passengerPhone = str(body.passengerPhone);
  if (!passengerName || !passengerPhone) {
    return response.status(400).json({ message: 'passengerName et passengerPhone sont requis.' });
  }
  const seats = Math.max(1, Number(body.seats) || 1);
  const user = await findOrCreatePassenger({ phone: passengerPhone, name: passengerName });
  try {
    const { booking, ticket } = await createBookingAndTicket({
      userId: user.id,
      tripId: trip.id,
      passengerName,
      passengerPhone,
      seats,
      amount: trip.price * seats,
      paymentMethod: str(body.paymentMethod) || 'Espèces',
      soldBy: 'counter',
    });
    return response.status(201).json({ booking, ticket });
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
    throw error;
  }
});

// --- Statistiques --------------------------------------------------------

companyRouter.get('/stats', async (request, response) => {
  const id = companyIdOf(request);
  const [trips, activeTrips, tickets, drivers, vehicles, recentSales] = await Promise.all([
    prisma.trip.count({ where: { companyId: id } }),
    prisma.trip.count({ where: { companyId: id, status: { in: ['scheduled', 'boarding', 'in_transit'] } } }),
    prisma.ticket.findMany({ where: { companyId: id } }),
    prisma.driver.count({ where: { companyId: id } }),
    prisma.vehicle.count({ where: { companyId: id } }),
    prisma.ticket.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);
  const revenue = tickets.reduce((sum, ticket) => sum + (ticket.amount || 0), 0);
  return response.json({
    stats: {
      trips,
      activeTrips,
      tickets: tickets.length,
      revenue,
      drivers,
      vehicles,
    },
    recentSales,
  });
});
