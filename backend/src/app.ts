/** Application Express : middlewares, montage des routes, erreurs JSON. */
import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './auth.js';
import { passengerAuthRouter, companyAuthRouter } from './routes/auth.js';
import { tripsRouter } from './routes/trips.js';
import { paymentsRouter } from './routes/payments.js';
import { companyRouter } from './routes/company.js';
import { driverRouter } from './routes/driver.js';
import { notificationsRouter } from './routes/notifications.js';
import { adminRouter } from './routes/admin.js';

export const app = express();

// CORS : uniquement CLIENT_ORIGINS (séparé par des virgules), jamais '*' en prod.
const allowedOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // requêtes serveur / curl
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0) {
        return callback(null, true);
      }
      return callback(new Error('Origine non autorisée par CORS'));
    },
  }),
);

// Corps brut conservé pour la vérification HMAC du webhook GeniusPay.
app.use(
  express.json({
    limit: '12mb',
    verify: (request, _response, body) => {
      (request as Request).rawBody = Buffer.from(body);
    },
  }),
);

app.get('/api/health', (_request, response) =>
  response.json({ status: 'ok', service: 'vitoo-v2' }),
);

// Les routes d'auth sont montées avant les espaces correspondants.
app.use('/api/auth', passengerAuthRouter);
app.use('/api/company/auth', companyAuthRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/company', companyRouter);
app.use('/api/driver', driverRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);

// Toute route /api inconnue → 404 JSON.
app.use('/api', (_request, response) => {
  response.status(404).json({ message: 'Route API introuvable.' });
});

// Gestionnaire d'erreurs central : toujours des réponses { message }.
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const status = error instanceof HttpError ? error.status : 500;
  if (status >= 500) console.error('[api] erreur interne :', error);
  const message = status < 500 && error instanceof Error ? error.message : 'Erreur interne du serveur.';
  if (!response.headersSent) response.status(status).json({ message });
});
