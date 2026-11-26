import { accessSync, constants } from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Sur Render Free, aucun disque persistant n'est monté sur /data : le dossier
 * n'existe pas et n'est pas accessible en écriture. Dans ce cas on bascule
 * automatiquement sur une base locale temporaire dans le dossier de l'app.
 */
const configured = process.env.DATABASE_URL || '';
if (configured.startsWith('file:/data/')) {
  let writable = false;
  try {
    accessSync('/data', constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  if (!writable) {
    process.env.DATABASE_URL = 'file:./vitoo.db';
    console.warn('[db] /data non accessible : utilisation de la base temporaire file:./vitoo.db');
  }
}

// Une seule source de vérité : Prisma / SQLite.
export const prisma = new PrismaClient();

// Erreur de contrainte d'unicité Prisma (P2002) — utilisée pour répondre 409.
export const isUniqueError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
