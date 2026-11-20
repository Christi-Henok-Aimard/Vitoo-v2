/** Administration globale : statistiques et gestion des utilisateurs. */
import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../db.js';
import { publicUser, requireAuth, requireRole } from '../auth.js';

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
  await prisma.user.delete({ where: { id: user.id } });
  return response.json({ message: 'Utilisateur supprimé.' });
});
