import type { User } from '@prisma/client';

// Augmentation des types Express : données attachées par les middlewares.
declare global {
  namespace Express {
    interface Request {
      user?: User;
      /** Alias explicite utilisé par les espaces chauffeur (token passager). */
      authUser?: User;
      rawBody?: Buffer;
    }
  }
}

export {};
