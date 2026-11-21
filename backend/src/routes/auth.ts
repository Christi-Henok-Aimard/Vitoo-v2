/** Routes d'authentification : passager, compagnie et Google. */
import { Router } from 'express';
import type { Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import type { User } from '@prisma/client';
import { prisma, isUniqueError } from '../db.js';
import {
  driverSpaceFor,
  findUserByPhone,
  hashPassword,
  normalizePhone,
  publicUser,
  requireAuth,
  requireRole,
  signToken,
  validatePassword,
  verifyPassword,
  HttpError,
} from '../auth.js';
import { normalizeMethods } from '../paymentMethods.js';

export const passengerAuthRouter = Router();
export const companyAuthRouter = Router();

const fail = (response: Response, message: string, status = 400) =>
  response.status(status).json({ message });

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Réponse d'auth complète : le token est toujours celui du compte passager. */
const authPayload = async (user: User) => ({
  user: publicUser(user),
  token: signToken(user.id),
  driverSpace: await driverSpaceFor(user.id),
});

// --- OTP ------------------------------------------------------------------

const OTP_TTL = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

interface ResetEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

/** Codes éphémères en mémoire : jamais une source de vérité métier. */
const resetCodes = new Map<string, ResetEntry>();
const companyResetCodes = new Map<string, ResetEntry>();
const adminResetCodes = new Map<string, ResetEntry>();
const makeCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

type OtpChannel = { send: (code: string) => Promise<void> };

/** Canaux réellement configurés pour envoyer un code (rien n'est journalisé). */
const otpChannels = (user: User): OtpChannel[] => {
  const channels: OtpChannel[] = [];
  if (process.env.RESEND_API_KEY && user.email) {
    channels.push({
      send: async (code) => {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Vitoo <onboarding@resend.dev>',
            to: [user.email],
            subject: 'Votre code Vitoo',
            text: `Votre code de réinitialisation Vitoo est ${code}. Il expire dans 5 minutes.`,
          }),
        });
      },
    });
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    channels.push({
      send: async (code) => {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: user.phone,
            From: process.env.TWILIO_FROM_NUMBER!,
            Body: `Code Vitoo : ${code}. Expire dans 5 minutes.`,
          }),
        });
      },
    });
  }
  if (process.env.AFRICAS_TALKING_USERNAME && process.env.AFRICAS_TALKING_API_KEY) {
    channels.push({
      send: async (code) => {
        const params: Record<string, string> = {
          username: process.env.AFRICAS_TALKING_USERNAME!,
          to: user.phone,
          message: `Code Vitoo : ${code}. Expire dans 5 minutes.`,
        };
        if (process.env.AFRICAS_TALKING_FROM) params.from = process.env.AFRICAS_TALKING_FROM;
        await fetch('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'api-key': process.env.AFRICAS_TALKING_API_KEY!,
          },
          body: new URLSearchParams(params),
        });
      },
    });
  }
  return channels;
};

/**
 * OTP générique pour les espaces compagnie et admin.
 * Clé = email (compagnie) ou téléphone normalisé (admin).
 */
const issueOtp = async (
  response: Response,
  store: Map<string, ResetEntry>,
  key: string,
  user: User | null,
): Promise<Response> => {
  if (!user) return fail(response, 'Aucun compte associé à cette adresse ou ce numéro.', 404);
  const code = makeCode();
  store.set(key, { code, expiresAt: Date.now() + OTP_TTL, attempts: 0 });
  const channels = otpChannels(user);
  if (process.env.NODE_ENV === 'production' && channels.length === 0) {
    store.delete(key);
    return fail(response, 'Aucun service SMS ou e-mail configuré : envoi du code impossible.', 503);
  }
  let delivered = false;
  if (channels.length) {
    const results = await Promise.allSettled(channels.map((channel) => channel.send(code)));
    delivered = results.some((result) => result.status === 'fulfilled');
    if (!delivered && process.env.NODE_ENV === 'production') {
      store.delete(key);
      return fail(response, "Envoi du code impossible : réessayez plus tard.", 502);
    }
  }
  const body: { message: string; code?: string } = {
    message: delivered ? 'Code envoyé par SMS/e-mail.' : 'Code de réinitialisation généré.',
  };
  if (process.env.NODE_ENV !== 'production') body.code = code;
  return response.json(body);
};

const consumeOtp = async (
  response: Response,
  store: Map<string, ResetEntry>,
  body: { key?: string; code?: string; password?: string },
  findUser: () => Promise<User | null>,
): Promise<Response> => {
  const key = str(body.key);
  if (!key || !str(body.code) || typeof body.password !== 'string') {
    return fail(response, 'key, code et password sont requis.');
  }
  try {
    validatePassword(body.password);
  } catch (error) {
    return fail(response, error instanceof HttpError ? error.message : 'Mot de passe invalide.');
  }
  const entry = store.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(key);
    return fail(response, 'Code invalide ou expiré.');
  }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    store.delete(key);
    return fail(response, 'Trop de tentatives : demandez un nouveau code.', 429);
  }
  if (entry.code !== str(body.code)) {
    entry.attempts += 1;
    return fail(response, 'Code invalide.');
  }
  const user = await findUser();
  if (!user) return fail(response, 'Compte introuvable.', 404);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(body.password) } });
  store.delete(key);
  return response.json({ message: 'Mot de passe réinitialisé.' });
};

// --- Passager ------------------------------------------------------------

passengerAuthRouter.post('/register', async (request, response) => {
  const body = request.body ?? {};
  const phone = normalizePhone(body.phone);
  if (!str(body.firstName) || !str(body.lastName) || !phone || typeof body.password !== 'string') {
    return fail(response, 'firstName, lastName, phone et password sont requis (numéro ivoirien valide).');
  }
  try {
    validatePassword(body.password);
  } catch (error) {
    return fail(response, error instanceof HttpError ? error.message : 'Mot de passe invalide.');
  }
  if (await findUserByPhone(phone)) return fail(response, 'Ce numéro est déjà inscrit.', 409);
  const user = await prisma.user.create({
    data: {
      firstName: str(body.firstName),
      lastName: str(body.lastName),
      phone,
      passwordHash: hashPassword(body.password),
      role: 'passenger',
    },
  });
  return response.status(201).json(await authPayload(user));
});

passengerAuthRouter.post('/login', async (request, response) => {
  const body = request.body ?? {};
  const user = await findUserByPhone(normalizePhone(body.phone) || str(body.phone));
  if (!user || typeof body.password !== 'string' || !verifyPassword(body.password, user.passwordHash)) {
    return fail(response, 'Numéro ou mot de passe incorrect.', 401);
  }
  return response.json(await authPayload(user));
});

/** Connexion Google : crée ou retrouve un passager, refuse les comptes compagnie. */
passengerAuthRouter.post('/google', async (request, response) => {
  const clientId = str(process.env.GOOGLE_CLIENT_ID);
  if (!clientId) {
    return fail(response, 'Connexion Google non configurée (GOOGLE_CLIENT_ID absent).', 501);
  }
  const idToken = str(request.body?.idToken);
  if (!idToken) return fail(response, 'idToken requis.', 400);

  let payload;
  try {
    const ticket = await new OAuth2Client({ clientId }).verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return fail(response, 'Jeton Google invalide ou expiré.', 401);
  }
  if (!payload?.email || !payload.sub || payload.email_verified === false) {
    return fail(response, 'Compte Google invalide ou non vérifié.', 401);
  }

  const email = payload.email.toLowerCase();
  const sub = payload.sub;
  const byGoogle = await prisma.user.findUnique({ where: { googleId: sub } });
  const byEmail = await prisma.user.findUnique({ where: { email } });

  // Un espace compagnie/admin ne doit jamais se retrouver dans un token passager.
  if ([byGoogle, byEmail].some((found) => found && found.role !== 'passenger')) {
    return fail(
      response,
      'Ce compte Google est associé à un espace compagnie ou administration : connexion refusée.',
      403,
    );
  }

  let user = byGoogle ?? byEmail;
  if (user) {
    if (user.googleId !== sub || user.provider !== 'google') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { provider: 'google', googleId: sub },
      });
    }
  } else {
    try {
      user = await prisma.user.create({
        data: {
          firstName: str(payload.given_name) || 'Vitoo',
          lastName: str(payload.family_name) || '',
          email,
          // Téléphone factice et unique : le profil passager pourra le modifier.
          phone: `google:${sub}`,
          provider: 'google',
          googleId: sub,
          role: 'passenger',
        },
      });
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      user =
        (await prisma.user.findUnique({ where: { googleId: sub } })) ??
        (await prisma.user.findUnique({ where: { email } }));
      if (!user) throw error;
    }
  }
  return response.json(await authPayload(user));
});

passengerAuthRouter.post('/forgot-password', async (request, response) => {
  const phone = normalizePhone(request.body?.phone);
  if (!phone) return fail(response, 'Numéro ivoirien valide requis.');
  const user = await findUserByPhone(phone);
  if (!user) return fail(response, 'Aucun compte associé à ce numéro.', 404);

  const code = makeCode();
  resetCodes.set(phone, { code, expiresAt: Date.now() + OTP_TTL, attempts: 0 });

  const channels = otpChannels(user);
  if (process.env.NODE_ENV === 'production' && channels.length === 0) {
    resetCodes.delete(phone);
    return fail(
      response,
      'Aucun service SMS ou e-mail configuré : envoi du code impossible.',
      503,
    );
  }
  let delivered = false;
  if (channels.length) {
    const results = await Promise.allSettled(channels.map((channel) => channel.send(code)));
    delivered = results.some((result) => result.status === 'fulfilled');
    if (!delivered && process.env.NODE_ENV === 'production') {
      resetCodes.delete(phone);
      // En production, le code n'est jamais renvoyé ni journalisé.
      return fail(response, "Envoi du code impossible : réessayez plus tard.", 502);
    }
  }

  const body: { message: string; code?: string } = {
    message: delivered
      ? 'Code de réinitialisation envoyé par SMS/e-mail.'
      : 'Code de réinitialisation généré.',
  };
  // En développement seulement : le code est renvoyé pour permettre les tests.
  if (process.env.NODE_ENV !== 'production') body.code = code;
  return response.json(body);
});

passengerAuthRouter.post('/reset-password', async (request, response) => {
  const body = request.body ?? {};
  const phone = normalizePhone(body.phone);
  if (!phone || !str(body.code) || typeof body.password !== 'string') {
    return fail(response, 'phone, code et password sont requis.');
  }
  try {
    validatePassword(body.password);
  } catch (error) {
    return fail(response, error instanceof HttpError ? error.message : 'Mot de passe invalide.');
  }
  const entry = resetCodes.get(phone);
  if (!entry || entry.expiresAt < Date.now()) {
    resetCodes.delete(phone);
    return fail(response, 'Code invalide ou expiré.');
  }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    resetCodes.delete(phone);
    return fail(response, 'Trop de tentatives : demandez un nouveau code.', 429);
  }
  if (entry.code !== str(body.code)) {
    entry.attempts += 1;
    return fail(response, 'Code invalide.');
  }
  const user = await findUserByPhone(phone);
  if (!user) return fail(response, 'Compte introuvable.', 404);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(body.password) },
  });
  resetCodes.delete(phone);
  return response.json({ message: 'Mot de passe réinitialisé.' });
});

passengerAuthRouter.get('/me', requireAuth, async (request, response) =>
  response.json(await authPayload(request.user!)),
);

passengerAuthRouter.patch('/me', requireAuth, async (request, response) => {
  const body = request.body ?? {};
  const data: Record<string, string | null> = {};
  for (const field of ['firstName', 'lastName', 'city', 'email', 'phone'] as const) {
    if (body[field] !== undefined) data[field] = str(body[field]) || null;
  }
  if (data.phone) {
    const phone = normalizePhone(data.phone);
    if (!phone) return fail(response, 'Numéro ivoirien invalide.');
    data.phone = phone;
    const other = await findUserByPhone(phone);
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
  return response.json(await authPayload(user));
});

// --- Mot de passe oublié : compagnie (e-mail) et admin (téléphone) --------

companyAuthRouter.post('/forgot-password', async (request, response) => {
  const email = str(request.body?.email).toLowerCase();
  if (!email) return fail(response, 'Adresse e-mail requise.');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'company') return fail(response, 'Aucune compagnie associée à cette adresse.', 404);
  return issueOtp(response, companyResetCodes, email, user);
});

companyAuthRouter.post('/reset-password', async (request, response) => {
  const body = request.body ?? {};
  return consumeOtp(
    response,
    companyResetCodes,
    { key: str(body.email).toLowerCase(), code: body.code, password: body.password },
    async () => {
      const user = await prisma.user.findUnique({ where: { email: str(body.email).toLowerCase() } });
      return user?.role === 'company' ? user : null;
    },
  );
});

passengerAuthRouter.post('/admin/forgot-password', async (request, response) => {
  const phone = normalizePhone(request.body?.phone);
  if (!phone) return fail(response, 'Numéro ivoirien valide requis.');
  const user = await findUserByPhone(phone);
  return issueOtp(response, adminResetCodes, phone, user?.role === 'admin' ? user : null);
});

passengerAuthRouter.post('/admin/reset-password', async (request, response) => {
  const body = request.body ?? {};
  const phone = normalizePhone(body.phone);
  return consumeOtp(
    response,
    adminResetCodes,
    { key: phone, code: body.code, password: body.password },
    async () => {
      const user = await findUserByPhone(phone);
      return user?.role === 'admin' ? user : null;
    },
  );
});

// --- Compagnie -----------------------------------------------------------

companyAuthRouter.post('/register', async (request, response) => {
  const body = request.body ?? {};
  const companyName = str(body.companyName);
  const city = str(body.city);
  const email = str(body.email);
  const phone = normalizePhone(body.phone);
  if (!companyName || !city || !email || !phone || !str(body.firstName) || !str(body.lastName)) {
    return fail(response, 'Tous les champs obligatoires doivent être renseignés (numéro ivoirien valide).');
  }
  if (typeof body.password !== 'string') return fail(response, 'Mot de passe requis.');
  try {
    validatePassword(body.password);
  } catch (error) {
    return fail(response, error instanceof HttpError ? error.message : 'Mot de passe invalide.');
  }
  if (await findUserByPhone(phone)) return fail(response, 'Ce numéro est déjà inscrit.', 409);
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
      paymentMethods: JSON.stringify(normalizeMethods(body.paymentMethods ?? ['Espèces'])),
    },
  });
  return response.status(201).json(await authPayload(user));
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
  return response.json(await authPayload(user));
});

companyAuthRouter.get('/me', requireAuth, requireRole('company'), async (request, response) =>
  response.json(await authPayload(request.user!)),
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
  ] as const) {
    if (body[field] !== undefined) data[field] = str(body[field]) || null;
  }
  if (body.paymentMethods !== undefined) {
    data.paymentMethods = JSON.stringify(normalizeMethods(body.paymentMethods));
  }
  if (data.phone) {
    const phone = normalizePhone(data.phone);
    if (!phone) return fail(response, 'Numéro ivoirien invalide.');
    data.phone = phone;
    const other = await findUserByPhone(phone);
    if (other && other.id !== request.user!.id) return fail(response, 'Numéro déjà utilisé.', 409);
  }
  const user = await prisma.user.update({ where: { id: request.user!.id }, data });
  return response.json(await authPayload(user));
});

// Réutilisé par les réservations publiques (création du passager au besoin).
export { findOrCreatePassenger } from '../auth.js';
