/** Espace chauffeur : missions, statuts, scan, escales, incidents. */
import { Router } from 'express';
import type { Request } from 'express';
import { DriverStatus, TripStatus } from '@prisma/client';
import type { Driver } from '@prisma/client';
import { prisma } from '../db.js';
import { driverSpaceFor, driverView, requireAuth, HttpError } from '../auth.js';
import { notifyTripPassengers } from '../notifications.js';
import { formatTrip } from './trips.js';

export const driverRouter = Router();
// Le chauffeur utilise son token passager : plus de session chauffeur séparée.
driverRouter.use(requireAuth);

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Driver lié au token passager, avec contrôle d'appartenance. */
const myDriver = async (request: Request): Promise<Driver> => {
  const driver = await prisma.driver.findUnique({ where: { userId: request.authUser!.id } });
  if (!driver) throw new HttpError(403, 'Profil chauffeur introuvable.');
  return driver;
};

/** Informations chauffeur + compagnie, pour rafraîchir l'espace chauffeur. */
driverRouter.get('/me', async (request, response) => {
  const driver = await myDriver(request);
  const space = await driverSpaceFor(request.authUser!.id);
  return response.json({ driver: await driverView(driver), companyName: space?.companyName ?? '' });
});

const ownedTrip = async (request: Request, tripId: string) => {
  const driver = await myDriver(request);
  const trip = await prisma.trip.findFirst({ where: { id: tripId, driverId: driver.id } });
  if (!trip) throw new HttpError(404, 'Mission introuvable.');
  return trip;
};

driverRouter.get('/stats', async (request, response) => {
  const driver = await myDriver(request);
  const [assigned, upcoming, inTransit, completed, incidents, validated] = await Promise.all([
    prisma.trip.count({ where: { driverId: driver.id } }),
    prisma.trip.count({ where: { driverId: driver.id, status: 'scheduled' } }),
    prisma.trip.count({ where: { driverId: driver.id, status: 'in_transit' } }),
    prisma.trip.count({ where: { driverId: driver.id, status: 'completed' } }),
    prisma.incident.count({ where: { driverId: driver.id } }),
    prisma.ticket.count({ where: { validatedBy: driver.id } }),
  ]);
  return response.json({
    stats: { assigned, upcoming, inTransit, completed, incidents, validated },
    driver: await driverView(driver),
  });
});

driverRouter.patch('/status', async (request, response) => {
  const driver = await myDriver(request);
  const status = str(request.body?.status);
  if (!Object.values(DriverStatus).includes(status as DriverStatus)) {
    return response.status(400).json({ message: 'Statut invalide.' });
  }
  const updated = await prisma.driver.update({
    where: { id: driver.id },
    data: { status: status as DriverStatus },
  });
  return response.json({ driver: await driverView(updated) });
});

driverRouter.post('/tickets/validate', async (request, response) => {
  const driver = await myDriver(request);
  const code = str(request.body?.code);
  if (!code) return response.status(400).json({ message: 'Le code du billet est requis.' });
  const ticket = await prisma.ticket.findUnique({ where: { code } });
  if (!ticket) return response.status(404).json({ message: 'Billet introuvable.' });
  const trip = await prisma.trip.findUnique({ where: { id: ticket.tripId } });
  if (!trip || trip.driverId !== driver.id) {
    return response.status(403).json({ message: 'Ce billet n’appartient pas à l’une de vos missions.' });
  }
  if (ticket.status === 'used') {
    return response.status(409).json({ message: 'Billet déjà scanné.' });
  }
  if (ticket.status !== 'active') {
    return response.status(409).json({ message: 'Billet non valide.' });
  }
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'used', validatedBy: driver.id, validatedAt: new Date() },
  });
  await notifyTripPassengers(
    trip.id,
    'scanned',
    'Billet scanné',
    'Billet scanné : asseyez-vous bien dans le car, il va décoller tout à l’heure.',
  );
  return response.json({ ticket: updated });
});

/** Incidents signalés par le chauffeur connecté, avec le trajet concerné. */
driverRouter.get('/incidents', async (request, response) => {
  const driver = await myDriver(request);
  const incidents = await prisma.incident.findMany({
    where: { driverId: driver.id },
    include: { trip: true },
    orderBy: { createdAt: 'desc' },
  });
  return response.json({
    incidents: incidents.map((incident) => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      resolved: incident.resolved,
      createdAt: incident.createdAt,
      tripLabel: `${incident.trip.depart} → ${incident.trip.arrivee}`,
    })),
  });
});

driverRouter.post('/incidents', async (request, response) => {
  const driver = await myDriver(request);
  const type = str(request.body?.type);
  if (!type) return response.status(400).json({ message: 'Le type d’incident est requis.' });
  let tripId = str(request.body?.tripId);
  if (!tripId) {
    const active = await prisma.trip.findFirst({
      where: { driverId: driver.id, status: { in: ['boarding', 'in_transit'] } },
      orderBy: { date: 'desc' },
    });
    tripId = active?.id || '';
  }
  if (!tripId) return response.status(400).json({ message: 'Aucun trajet concerné.' });
  const trip = await prisma.trip.findFirst({ where: { id: tripId, driverId: driver.id } });
  if (!trip) return response.status(403).json({ message: 'Mission introuvable.' });
  const incident = await prisma.incident.create({
    data: {
      tripId,
      driverId: driver.id,
      type,
      description: str(request.body?.description) || null,
    },
  });
  return response.status(201).json({ incident });
});

driverRouter.get('/trips', async (request, response) => {
  const driver = await myDriver(request);
  const trips = await prisma.trip.findMany({
    where: { driverId: driver.id },
    orderBy: { date: 'asc' },
  });
  return response.json({ trips: await Promise.all(trips.map(formatTrip)) });
});

driverRouter.get('/trips/:id', async (request, response) => {
  let trip;
  try {
    trip = await ownedTrip(request, request.params.id);
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
    throw error;
  }
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
      ticket: booking.ticket,
    })),
  });
});

driverRouter.patch('/trips/:id/status', async (request, response) => {
  let trip;
  try {
    trip = await ownedTrip(request, request.params.id);
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
    throw error;
  }
  const status = str(request.body?.status);
  if (!['boarding', 'in_transit', 'completed'].includes(status)) {
    return response.status(400).json({ message: 'Statut invalide.' });
  }
  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: { status: status as TripStatus },
  });

  if (status === 'in_transit') {
    await notifyTripPassengers(
      trip.id,
      'departed',
      'Le car est en route',
      'Le car vient de décoller. Bon voyage !',
    );
  } else if (status === 'completed') {
    await notifyTripPassengers(
      trip.id,
      'arrived',
      'Vous êtes arrivé',
      `Le car est arrivé à ${trip.arrivee}. Merci de noter la compagnie et le chauffeur.`,
    );
  }
  return response.json({ trip: await formatTrip(updated) });
});

driverRouter.post('/trips/:id/stop', async (request, response) => {
  let trip;
  try {
    trip = await ownedTrip(request, request.params.id);
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
    throw error;
  }
  const name = str(request.body?.name);
  if (!name) return response.status(400).json({ message: 'Le nom de l’escale est requis.' });
  await notifyTripPassengers(trip.id, 'stop', 'Escale du car', `Le car est en escale à ${name}.`);
  return response.json({ ok: true, stop: { name } });
});
