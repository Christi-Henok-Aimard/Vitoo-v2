/** Routes d'authentification : passager, compagnie, chauffeur. */
import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '../db.js';
import {
  driverView,
  findOrCreatePassenger,
  hashPassword,
  publicUser,
  requireAuth,
  requireRole,
  signToken,
  validatePassword,
  verifyPassword,
  HttpError,
} from '../auth.js';

export const passengerAuthRouter = Router();
export const companyAuthRouter = Router();
export const driverAuthRouter = Router();

const fail = (response: Response, message: string, status = 400) =>
  response.status(status).json({ message });

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// Codes de réinitialisation éphémères (jamais une source de vérité métier).
const resetCodes = new Map<string, { code: string; expiresAt: number }>();
const makeCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

// --- Passager ------------------------------------------------------------

passengerAuthRouter.post('/register', async (request, response) => {
  const { firstName, lastName, phone, password } = request.body ?? {};
  if (!str(firstName) || !str(lastName) || !str(phone) || typeof password !== 'string') {
    return fail(response, 'firstName, lastName, phone et password sont requis.');
  }
  try {
    validatePassword(password);
  } catch (error) {
    return fail(response, error instanceof HttpError ? error.message : 'Mot de passe invalide.');
  }
  const existing = await prisma.user.findUnique({ where: { phone: str(phone) } });
  if (existing) return fail(response, 'Ce numéro est déjà inscrit.', 409);
  const user = await prisma.user.create({
    data: {
      firstName: str(firstName),
      lastName: str(lastName),
      phone: str(phone),
      passwordHash: hashPassword(password),
      role: 'passenger',
    },
  });
  return response.status(201).json({ user: publicUser(user), token: signToken(user.id) });
});

passengerAuthRouter.post('/login', async (request, response) => {
  const { phone, password } = request.body ?? {};
  const user = await prisma.user.findUnique({ where: { phone: str(phone) } });
  if (!user || typeof password !== 'string' || !verifyPassword(password, user.passwordHash)) {
    return fail(response, 'Numéro ou mot de passe incorrect.', 401);
  }
  return response.json({ user: publicUser(user), token: signToken(user.id) });
});

passengerAuthRouter.post('/forgot-password', async (request, response) => {
  const phone = str(request.body?.phone);
  if (!phone) return fail(response, 'Le numéro est requis.');
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return fail(response, 'Aucun compte associé à ce numéro.', 404);
  const code = makeCode();
  resetCodes.set(phone, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
  const body: { message: string; code?: string } = {
    message: 'Code de réinitialisation généré.',
  };
  // Le code n'est renvoyé qu'en développement, pour la démo.
  if (process.env.NODE_ENV !== 'production') body.code = code;
  return response.json(body);
});

passengerAuthRouter.post('/reset-password', async (request, response) => {
  const { phone, code, password } = request.body ?? {};
  if (!str(phone) || !str(code) || typeof password !== 'string') {
    return fail(response, 'phone, code et password sont requis.');
  }
  try {
    validatePassword(password);
  } catch (error) {
    return fail(response, error instanceof HttpError ? error.message : 'Mot de passe invalide.');
  }
  const entry = resetCodes.get(str(phone));
  if (!entry || entry.code !== str(code) || entry.expiresAt < Date.now()) {
    return fail(response, 'Code invalide ou expiré.');
  }
  const user = await prisma.user.findUnique({ where: { phone: str(phone) } });
  if (!user) return fail(response, 'Compte introuvable.', 404);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(password) },
  });
  resetCodes.delete(str(phone));
  return response.json({ message: 'Mot de passe réinitialisé.' });
});

passengerAuthRouter.get('/me', requireAuth, (request, response) =>
  response.json({ user: publicUser(request.user!) }),
);

passengerAuthRouter.patch('/me', requireAuth, async (request, response) => {
  const body = request.body ?? {};
  const data: Record<string, string | null> = {};
  for (const field of ['firstName', 'lastName', 'city', 'email', 'phone'] as const) {
    if (body[field] !== undefined) data[field] = str(body[field]) || null;
  }
  if (data.phone) {
    const other = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (other && other.id !== request.user!.id) {
      return fail(response, 'Ce numéro est déjà utilisé.', 409);
    }
  }
  if (data.email) {
    const other = await prisma.user.findUnique({ where: { email: data.email } });
    if (other && other.id !== request.user!.id) {
      return fail(response, 'Cet e-mail est déjà utilisé.', 409);
    }
  }
  const user = await prisma.user.update({ where: { id: request.user!.id }, data });
  return response.json({ user: publicUser(user) });
});

// --- Compagnie -----------------------------------------------------------

companyAuthRouter.post('/register', async (request, response) => {
  const body = request.body ?? {};
  const companyName = str(body.companyName);
  const city = str(body.city);
  const email = str(body.email);
  const phone = str(body.phone);
  if (!companyName || !city || !email || !phone || !str(body.firstName) || !str(body.lastName)) {
    return fail(response, 'Tous les champs obligatoires doivent être renseignés.');
  }
  if (typeof body.password !== 'string') return fail(response, 'Mot de passe requis.');
  try {
    validatePassword(body.password);
  } catch (error) {
    return fail(response, error instanceof HttpError ? error.message : 'Mot de passe invalide.');
  }
  if (await prisma.user.findUnique({ where: { phone } })) {
    return fail(response, 'Ce numéro est déjà inscrit.', 409);
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return fail(response, 'Cet e-mail est déjà inscrit.', 409);
  }
  const user = await prisma.user.create({
    data: {
      firstName: str(body.firstName),
      lastName: str(body.lastName),
      phone,
      email,
      passwordHash: hashPassword(body.password),
      role: 'company',
      city,
      companyName,
      rccm: str(body.rccm) || null,
      taxId: str(body.taxId) || null,
      paymentMethods: JSON.stringify(['Espèces']),
    },
  });
  return response.status(201).json({ user: publicUser(user), token: signToken(user.id) });
});

companyAuthRouter.post('/login', async (request, response) => {
  const email = str(request.body?.email);
  const password = request.body?.password;
  const user = await prisma.user.findUnique({ where: { email } });
  if (
    !user ||
    user.role !== 'company' ||
    typeof password !== 'string' ||
    !verifyPassword(password, user.passwordHash)
  ) {
    return fail(response, 'E-mail ou mot de passe incorrect.', 401);
  }
  return response.json({ user: publicUser(user), token: signToken(user.id) });
});

companyAuthRouter.get('/me', requireAuth, requireRole('company'), (request, response) =>
  response.json({ user: publicUser(request.user!) }),
);

companyAuthRouter.patch('/me', requireAuth, requireRole('company'), async (request, response) => {
  const body = request.body ?? {};
  const data: Record<string, string | null> = {};
  for (const field of [
    'firstName',
    'lastName',
    'city',
    'phone',
    'companyName',
    'rccm',
    'taxId',
    'companyLogo',
    'primaryColor',
    'secondaryColor',
    'paymentMethods',
  ] as const) {
    if (body[field] !== undefined) data[field] = str(body[field]) || null;
  }
  if (data.phone) {
    const other = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (other && other.id !== request.user!.id) return fail(response, 'Numéro déjà utilisé.', 409);
  }
  const user = await prisma.user.update({ where: { id: request.user!.id }, data });
  return response.json({ user: publicUser(user) });
});

// --- Chauffeur -----------------------------------------------------------

driverAuthRouter.post('/login', async (request, response) => {
  const phone = str(request.body?.phone);
  const password = request.body?.password;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (
    !user ||
    user.role !== 'driver' ||
    typeof password !== 'string' ||
    !verifyPassword(password, user.passwordHash)
  ) {
    return fail(response, 'Numéro ou mot de passe incorrect.', 401);
  }
  const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
  if (!driver) return fail(response, 'Profil chauffeur introuvable.', 404);
  return response.json({ driver: await driverView(driver), token: signToken(user.id) });
});

driverAuthRouter.get('/me', requireAuth, requireRole('driver'), async (request, response) => {
  const driver = await prisma.driver.findUnique({ where: { userId: request.user!.id } });
  if (!driver) return fail(response, 'Profil chauffeur introuvable.', 404);
  return response.json({ driver: await driverView(driver) });
});

// Réutilisé par les réservations publiques (création du passager au besoin).
export { findOrCreatePassenger };
