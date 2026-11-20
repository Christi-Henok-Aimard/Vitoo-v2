/**
 * Authentification : scrypt maison (salt:hashHex), JWT 7 jours,
 * middlewares requireAuth / requireRole et utilitaires utilisateurs.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Driver, DriverStatus, Role, User } from '@prisma/client';
import { prisma } from './db.js';

const MIN_PASSWORD_LENGTH = 8;
const SCRYPT_KEYLEN = 64;
const DEV_SECRET = 'vitoo-dev-secret-ne-pas-utiliser-en-production';

/** Erreur HTTP simple, interceptée par le gestionnaire d'erreurs de l'app. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// --- Téléphones ----------------------------------------------------------

/**
 * Normalise un numéro ivoirien : 07…, +22507…, 0022507…, espaces et tirets
 * → +2250XXXXXXXX. Renvoie '' si le numéro est invalide.
 */
export const normalizePhone = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00225')) digits = digits.slice(5);
  else if (digits.startsWith('225')) digits = digits.slice(3);
  return /^0\d{9}$/.test(digits) ? `+225${digits}` : '';
};

/**
 * Cherche un utilisateur par téléphone, en acceptant aussi les anciens formats
 * éventuellement stockés en base (07…, 225…, +225…) : pas de casse pour les
 * comptes déjà créés avant la normalisation.
 */
export const findUserByPhone = async (phone: string): Promise<User | null> => {
  const candidates = new Set<string>();
  const normalized = normalizePhone(phone);
  if (normalized) candidates.add(normalized);
  const raw = phone.trim();
  if (raw) candidates.add(raw);
  const digits = raw.replace(/\D/g, '');
  if (digits) {
    candidates.add(digits);
    if (digits.startsWith('225')) candidates.add(`+${digits}`);
    if (digits.startsWith('00225')) candidates.add(`+${digits.slice(5)}`);
  }
  for (const candidate of candidates) {
    const user = await prisma.user.findUnique({ where: { phone: candidate } });
    if (user) return user;
  }
  return null;
};

/** À appeler au boot : échoue immédiatement si le secret manque en production. */
export const assertProductionSecrets = (): void => {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET est obligatoire en production.');
  }
};

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET est obligatoire en production.');
  }
  return DEV_SECRET;
};

// --- Mots de passe -------------------------------------------------------

export const validatePassword = (password: string): void => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
};

export const hashPassword = (password: string): string => {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string | null): boolean => {
  if (!stored) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length || SCRYPT_KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// --- JWT -----------------------------------------------------------------

export const signToken = (userId: string): string =>
  jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '7d' });

const readToken = (request: Request): string | null => {
  const header = request.header('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
};

/** Récupère l'utilisateur courant si le token est valide, sinon null. */
export const loadUser = async (request: Request): Promise<User | null> => {
  const token = readToken(request);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    const id = typeof payload === 'string' ? payload : payload.sub;
    if (!id) return null;
    return await prisma.user.findUnique({ where: { id } });
  } catch {
    return null;
  }
};

export const requireAuth = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  const user = await loadUser(request);
  if (!user) {
    response.status(401).json({ message: 'Authentification requise.' });
    return;
  }
  request.user = user;
  request.authUser = user;
  next();
};

/** Optionnel : renseigne request.user / request.authUser si un token est valide. */
export const optionalAuth = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  const user = await loadUser(request);
  if (user) {
    request.user = user;
    request.authUser = user;
  }
  next();
};

export const requireRole =
  (...roles: Role[]) =>
  (request: Request, response: Response, next: NextFunction): void => {
    if (!request.user) {
      response.status(401).json({ message: 'Authentification requise.' });
      return;
    }
    if (!roles.includes(request.user.role)) {
      response.status(403).json({ message: 'Accès refusé.' });
      return;
    }
    next();
  };

// --- Sérialisation -------------------------------------------------------

/** Ne jamais exposer le hash du mot de passe. */
export const publicUser = (user: User) => {
  const { passwordHash, ...safe } = user;
  void passwordHash;
  return safe;
};

/** Espace chauffeur exposé dans la session d'un passager promu. */
export interface DriverSpace {
  id: string;
  companyId: string;
  companyName: string;
  licenseNumber: string | null;
  status: DriverStatus;
}

/**
 * Retourne l'espace chauffeur lié à un compte passager, ou null si la personne
 * n'a pas été promue. Le rôle du User reste 'passenger'.
 */
export const driverSpaceFor = async (userId: string): Promise<DriverSpace | null> => {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!driver) return null;
  const company = await prisma.user.findUnique({
    where: { id: driver.companyId },
    select: { companyName: true },
  });
  return {
    id: driver.id,
    companyId: driver.companyId,
    companyName: company?.companyName ?? '',
    licenseNumber: driver.licenseNumber,
    status: driver.status,
  };
};

export const driverView = async (driver: Driver) => {
  const user = await prisma.user.findUnique({ where: { id: driver.userId } });
  return {
    id: driver.id,
    userId: driver.userId,
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? null,
    licenseNumber: driver.licenseNumber,
    status: driver.status,
    companyId: driver.companyId,
  };
};

/** Retrouve un passager par téléphone ou le crée (réservations sans compte). */
export const findOrCreatePassenger = async (input: {
  phone: string;
  name: string;
  email?: string | null;
}): Promise<User> => {
  const phone = normalizePhone(input.phone) || input.phone.trim();
  const existing = await findUserByPhone(phone);
  if (existing) return existing;
  const parts = input.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || 'Passager';
  const lastName = parts.join(' ') || 'Vitoo';
  try {
    return await prisma.user.create({
      data: {
        firstName,
        lastName,
        phone,
        email: input.email || null,
        role: 'passenger',
      },
    });
  } catch {
    // Adresse e-mail déjà utilisée : on crée sans e-mail.
    return prisma.user.create({
      data: { firstName, lastName, phone, role: 'passenger' },
    });
  }
};
