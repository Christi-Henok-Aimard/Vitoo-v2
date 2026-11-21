/** Administration globale : statistiques et gestion des utilisateurs. */
import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../db.js';
import { publicUser, requireAuth, requireRole } from '../auth.js';
import { sendDirectMessage } from '../notifications.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/stats', async (_request, response) => {
  const [users, trips, bookings, tickets, paidPayments] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.trip.count(),
    prisma.booking.count(),
    prisma.ticket.count(),
    prisma.payment.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
  ]);
  const byRole: Record<string, number> = {};
  users.forEach((row) => {
    byRole[row.role] = row._count._all;
  });
  return response.json({
    stats: {
      users: users.reduce((sum, row) => sum + row._count._all, 0),
      byRole,
      trips,
      bookings,
      tickets,
      revenue: paidPayments._sum.amount || 0,
    },
  });
});

adminRouter.get('/users', async (request, response) => {
  const role = typeof request.query.role === 'string' ? request.query.role : '';
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
  const where = role && Object.values(Role).includes(role as Role) ? { role: role as Role } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  return response.json({ users: users.map(publicUser), total, page, limit });
});

adminRouter.get('/users/:id', async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.params.id } });
  if (!user) return response.status(404).json({ message: 'Utilisateur introuvable.' });
  return response.json({ user: publicUser(user) });
});

adminRouter.patch('/users/:id', async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.params.id } });
  if (!user) return response.status(404).json({ message: 'Utilisateur introuvable.' });
  const role = request.body?.role;
  if (role !== undefined) {
    if (typeof role !== 'string' || !Object.values(Role).includes(role as Role)) {
      return response.status(400).json({ message: 'Rôle invalide.' });
    }
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: role !== undefined ? { role: role as Role } : {},
  });
  return response.json({ user: publicUser(updated) });
});

adminRouter.delete('/users/:id', async (request, response) => {
  if (request.params.id === request.user!.id) {
    return response.status(403).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  const user = await prisma.user.findUnique({ where: { id: request.params.id } });
  if (!user) return response.status(404).json({ message: 'Utilisateur introuvable.' });

  // Prévenir la personne AVANT la suppression : une notification en base
  // disparaîtrait avec son compte, seul un e-mail/SMS peut survivre.
  const messageSent = await sendDirectMessage(
    { email: user.email, phone: user.phone },
    'Votre compte Vitoo a été supprimé',
    `Bonjour ${user.firstName}, votre compte Vitoo ainsi que vos réservations, billets et notifications ont été supprimés par un administrateur. Si vous pensez qu'il s'agit d'une erreur, contactez le support Vitoo.`,
  );

  // Identifiants des données à effacer, y compris celles d'une compagnie
  // (trajets, véhicules, billets) qui ne sont pas liées par une FK cascade.
  const companyTrips = user.role === 'company'
    ? await prisma.trip.findMany({ where: { companyId: user.id }, select: { id: true } })
    : [];
  const companyTripIds = companyTrips.map((trip) => trip.id);
  const ownedBookings = await prisma.booking.findMany({ where: { userId: user.id }, select: { id: true } });
  const companyBookings = companyTripIds.length
    ? await prisma.booking.findMany({ where: { tripId: { in: companyTripIds } }, select: { id: true } })
    : [];
  const bookingIds = [...new Set([...ownedBookings, ...companyBookings].map((booking) => booking.id))];
  const drivers = await prisma.driver.findMany({
    where: { OR: [{ userId: user.id }, { companyId: user.id }] },
    select: { id: true },
  });
  const driverIds = drivers.map((driver) => driver.id);

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    prisma.notification.deleteMany({ where: { tripId: { in: companyTripIds } } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.ticket.deleteMany({ where: { OR: [{ tripId: { in: companyTripIds } }, { bookingId: { in: bookingIds } }] } }),
    prisma.rating.deleteMany({ where: { OR: [{ tripId: { in: companyTripIds } }, { userId: user.id }] } }),
    prisma.incident.deleteMany({ where: { OR: [{ tripId: { in: companyTripIds } }, { driverId: { in: driverIds } }] } }),
    prisma.booking.deleteMany({ where: { OR: [{ tripId: { in: companyTripIds } }, { userId: user.id }] } }),
    prisma.trip.deleteMany({ where: { companyId: user.id } }),
    prisma.vehicle.deleteMany({ where: { companyId: user.id } }),
    prisma.driver.deleteMany({ where: { OR: [{ userId: user.id }, { companyId: user.id }] } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  return response.json({
    message: 'Utilisateur et toutes ses données supprimés.',
    messageSent,
  });
});
