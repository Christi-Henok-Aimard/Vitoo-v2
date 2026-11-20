/**
 * Seed de démonstration — idempotent.
 * Une compagnie, un véhicule, un chauffeur, deux trajets à dates futures
 * (pour que le scheduler de rappels puisse être démontré).
 * Aucun secret réel : mots de passe factices réservés au développement.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// scrypt maison : salt:hashHex (identique à src/auth.ts)
const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const DAY = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const companyPhone = '+225000000001';
  const driverPhone = '+225000000002';
  const demoPassword = 'password123';

  // Compagnie
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
      paymentMethods: JSON.stringify(['Espèces', 'Wave', 'Orange Money']),
    },
  });

  // Véhicule (pas de contrainte d'unicité sur la plaque : on cherche d'abord)
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

  // Chauffeur (User role=driver + Driver)
  let driverUser = await prisma.user.findUnique({ where: { phone: driverPhone } });
  if (!driverUser) {
    driverUser = await prisma.user.create({
      data: {
        firstName: 'Koffi',
        lastName: 'Diallo',
        phone: driverPhone,
        passwordHash: hashPassword(demoPassword),
        role: 'driver',
        city: 'Abidjan',
      },
    });
  }
  let driver = await prisma.driver.findUnique({ where: { userId: driverUser.id } });
  if (!driver) {
    driver = await prisma.driver.create({
      data: {
        userId: driverUser.id,
        companyId: company.id,
        licenseNumber: 'PERMIS-DEMO-001',
        status: 'available',
      },
    });
  }

  // Évite le doublon « Gare de Gare de Adjame » sur les anciennes données de démo
  await prisma.trip.updateMany({
    where: { companyId: company.id, station: { startsWith: 'Gare de ' } },
    data: { station: 'Adjame' },
  });

  // Deux trajets futures (rappels 48h/24h/6h/2h/10m démontrables)
  const existingTrips = await prisma.trip.count({ where: { companyId: company.id } });
  if (existingTrips === 0) {
    await prisma.trip.create({
      data: {
        companyId: company.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        depart: 'Abidjan',
        arrivee: 'Bouaké',
        station: 'Adjame',
        date: new Date(Date.now() + 2 * DAY),
        time: '08:00',
        duration: '4h',
        price: 3500,
        availableSeats: 25,
        paymentMethods: JSON.stringify(['Espèces', 'Wave', 'Orange Money']),
        stops: JSON.stringify(['Yamoussoukro']),
        status: 'scheduled',
      },
    });
    await prisma.trip.create({
      data: {
        companyId: company.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        depart: 'Abidjan',
        arrivee: 'Korhogo',
        station: 'Adjame',
        date: new Date(Date.now() + 7 * DAY),
        time: '14:30',
        duration: '7h',
        price: 5000,
        availableSeats: 20,
        paymentMethods: JSON.stringify(['Espèces', 'Wave']),
        stops: JSON.stringify(['Bouaké', 'Ferkessédougou']),
        status: 'scheduled',
      },
    });
  }

  console.log('[seed] Terminé : compagnie, véhicule, chauffeur et 2 trajets futures prêts.');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] Erreur :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
