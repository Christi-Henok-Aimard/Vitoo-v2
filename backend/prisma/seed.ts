/**
 * ⚠️ TEST LOCAL UNIQUEMENT — ne pas exécuter en production.
 *
 * Seed idempotent : une compagnie fictive, un véhicule et deux trajets futurs
 * pour tester le scheduler de rappels. AUCUN passager ni chauffeur n'est créé :
 * les compagnies, passagers et chauffeurs doivent venir de vrais formulaires.
 * Aucun secret réel : le mot de passe ci-dessous est factice et réservé au test.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { normalizeMethods } from '../src/paymentMethods.js';

const prisma = new PrismaClient();

/** scrypt maison : salt:hashHex (identique à src/auth.ts). */
const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const DAY = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const companyPhone = '+225000000001';
  const demoPassword = 'password123';

  // Compagnie de test (aucun passager ni chauffeur).
  const company = await prisma.user.upsert({
    where: { phone: companyPhone },
    update: {},
    create: {
      firstName: 'Awa',
      lastName: 'Kouassi',
      phone: companyPhone,
      email: 'company@vitoo.demo',
      passwordHash: hashPassword(demoPassword),
      role: 'company',
      city: 'Abidjan',
      companyName: 'Vitoo Demo',
      rccm: 'CI-DEMO-0001',
      taxId: 'TAX-DEMO-0001',
      paymentMethods: JSON.stringify(normalizeMethods(['Espèces', 'Wave', 'Orange Money'])),
    },
  });

  // Véhicule (pas de contrainte d'unicité sur la plaque : on cherche d'abord).
  let vehicle = await prisma.vehicle.findFirst({
    where: { companyId: company.id, plateNumber: 'AB-1234-XX' },
  });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        companyId: company.id,
        plateNumber: 'AB-1234-XX',
        brand: 'Toyota',
        model: 'Coaster',
        capacity: 30,
        isActive: true,
      },
    });
  }

  // Évite le doublon « Gare de Gare de Adjame » sur les anciennes données de démo.
  await prisma.trip.updateMany({
    where: { companyId: company.id, station: { startsWith: 'Gare de ' } },
    data: { station: 'Adjame' },
  });

  // Deux trajets futurs, sans chauffeur attribué (rappels 48h/24h/6h/2h/10m).
  const existingTrips = await prisma.trip.count({ where: { companyId: company.id } });
  if (existingTrips === 0) {
    await prisma.trip.create({
      data: {
        companyId: company.id,
        driverId: null,
        vehicleId: vehicle.id,
        depart: 'Abidjan',
        arrivee: 'Bouaké',
        station: 'Adjame',
        date: new Date(Date.now() + 2 * DAY),
        time: '08:00',
        duration: '4h',
        price: 3500,
        availableSeats: 25,
        paymentMethods: JSON.stringify(normalizeMethods(['Espèces', 'Wave', 'Orange Money'])),
        stops: JSON.stringify(['Yamoussoukro']),
        status: 'scheduled',
      },
    });
    await prisma.trip.create({
      data: {
        companyId: company.id,
        driverId: null,
        vehicleId: vehicle.id,
        depart: 'Abidjan',
        arrivee: 'Korhogo',
        station: 'Adjame',
        date: new Date(Date.now() + 7 * DAY),
        time: '14:30',
        duration: '7h',
        price: 5000,
        availableSeats: 20,
        paymentMethods: JSON.stringify(normalizeMethods(['Espèces', 'Wave'])),
        stops: JSON.stringify(['Bouaké', 'Ferkessédougou']),
        status: 'scheduled',
      },
    });
  }

  console.log('[seed] Terminé : compagnie, véhicule et 2 trajets futurs prêts (test local).');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] Erreur :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
