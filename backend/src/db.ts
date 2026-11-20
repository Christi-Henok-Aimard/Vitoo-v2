import { Prisma, PrismaClient } from '@prisma/client';

// Une seule source de vérité : Prisma / SQLite.
export const prisma = new PrismaClient();

// Erreur de contrainte d'unicité Prisma (P2002) — utilisée pour répondre 409.
export const isUniqueError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
