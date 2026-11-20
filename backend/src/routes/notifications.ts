/** Notifications de l'utilisateur connecté. */
import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (request, response) => {
  const userId = request.user!.id;
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return response.json({ notifications, unread });
});

notificationsRouter.post('/read-all', async (request, response) => {
  await prisma.notification.updateMany({
    where: { userId: request.user!.id, read: false },
    data: { read: true },
  });
  return response.json({ unread: 0 });
});

notificationsRouter.post('/:id/read', async (request, response) => {
  const notification = await prisma.notification.findFirst({
    where: { id: request.params.id, userId: request.user!.id },
  });
  if (!notification) return response.status(404).json({ message: 'Notification introuvable.' });
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });
  return response.json({ notification: updated });
});
