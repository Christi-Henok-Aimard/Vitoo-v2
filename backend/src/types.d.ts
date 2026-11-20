import type { User } from '@prisma/client';

// Augmentation des types Express : données attachées par les middlewares.
declare global {
  namespace Express {
    interface Request {
      user?: User;
      rawBody?: Buffer;
    }
  }
}

export {};
