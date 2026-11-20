/** Point d'entrée : synchronisation schéma, admin bootstrap, scheduler, serveur. */
import { app } from './app.js';
import { assertProductionSecrets, hashPassword } from './auth.js';
import { prisma } from './db.js';
import { startNotificationScheduler } from './notifications.js';

/**
 * En production, aligne le schéma SQLite au démarrage (Render sans shell).
 * Non bloquant en cas d'échec, désactivable avec PRISMA_AUTO_PUSH=off.
 */
const autoPushSchema = async (): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.PRISMA_AUTO_PUSH === 'off') return;
  try {
    const { execSync } = await import('node:child_process');
    execSync('npx --no-install prisma db push --skip-generate', {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[boot] Schéma Prisma synchronisé (db push).');
  } catch (error) {
    console.error('[boot] db push ignoré (non bloquant) :', error);
  }
};

/** Crée le compte administrateur initial si aucun admin n'existe. */
const bootstrapAdmin = async (): Promise<void> => {
  const phone = process.env.ADMIN_BOOTSTRAP_PHONE?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!phone || !password) return;
  if (await prisma.user.findFirst({ where: { role: 'admin' } })) return;
  try {
    await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'Vitoo',
        phone,
        passwordHash: hashPassword(password),
        role: 'admin',
        city: '',
        paymentMethods: JSON.stringify(['Espèces']),
      },
    });
    console.log('[boot] Compte administrateur initial créé.');
  } catch (error) {
    console.error('[boot] Admin bootstrap ignoré :', error);
  }
};

const start = async (): Promise<void> => {
  // Échoue immédiatement si JWT_SECRET manque en production.
  assertProductionSecrets();
  await autoPushSchema();
  await bootstrapAdmin();
  startNotificationScheduler();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`[boot] VITOO v2 API prête sur http://0.0.0.0:${port}/api`);
  });
};

start().catch((error: unknown) => {
  console.error('[boot] Démarrage impossible :', error);
  process.exit(1);
});
