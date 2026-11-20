# CONTRAT VITOO v2 — source de vérité unique

Projet propre, réécrit de zéro. **Aucune carte, aucun suivi GPS temps réel, aucun chat compagnie↔chauffeur.** Paiement : **GeniusPay uniquement**.

---

## 1. Règles générales

- Base : SQLite via Prisma. Une seule source de vérité (plus de `trips.json`, plus de store mémoire).
- Auth : JWT Bearer, 7 jours, `JWT_SECRET` (jamais de secret par défaut en production). Rôles : `passenger | company | driver | admin`.
- Mot de passe : `scrypt` maison (`salt:hashHex`, comparaison `timingSafeEqual`), minimum 8 caractères.
- Réponses JSON. Erreurs : `{ message: string }` avec code HTTP adapté (400/401/403/404/409/500).
- CORS : uniquement `CLIENT_ORIGINS` (séparé par des virgules). Pas de `*` en production.
- Frontend : `VITE_API_URL` (défaut `http://localhost:4000/api`).
- Aucun endpoint de reset destructif. Aucun `/maptest`.

---

## 2. Modèle Prisma (à reproduire dans `prisma/schema.prisma`)

```prisma
model User {
  id            String   @id @default(cuid())
  firstName     String
  lastName      String
  phone         String   @unique
  email         String?  @unique
  passwordHash  String?
  role          Role     @default(passenger)
  city          String?
  avatarUrl     String?
  companyName   String?
  rccm          String?
  taxId         String?
  companyLogo   String?
  primaryColor  String?
  secondaryColor String?
  paymentMethods String  @default("[\"Espèces\"]")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  bookings      Booking[]
  notifications Notification[]
  ratings       Rating[]
  driver        Driver?
}
model Driver {
  id            String   @id @default(cuid())
  userId        String   @unique
  companyId     String
  licenseNumber String?
  status        DriverStatus @default(available)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  trips         Trip[]
  incidents     Incident[]
}
model Vehicle {
  id         String  @id @default(cuid())
  companyId  String
  plateNumber String
  brand      String?
  model      String?
  capacity   Int?
  photo      String?
  isActive   Boolean @default(true)
  trips      Trip[]
}
model Trip {
  id             String   @id @default(cuid())
  companyId      String
  driverId       String?
  vehicleId      String?
  depart         String
  arrivee        String
  station        String?
  date           DateTime
  time           String
  duration       String?
  price          Int
  availableSeats Int
  paymentMethods String   @default("[\"Espèces\"]")
  stops          String   @default("[]")
  status         TripStatus @default(scheduled)
  bookings       Booking[]
  tickets        Ticket[]
  ratings        Rating[]
  incidents      Incident[]
  notifications  Notification[]
}
model Booking {
  id             String  @id @default(cuid())
  userId         String
  tripId         String
  passengerName  String
  passengerPhone String
  seats          Int     @default(1)
  seatNumber     String?
  amount         Int
  paymentMethod  String
  status         BookingStatus @default(confirmed)
  ticket         Ticket?
  user           User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  trip           Trip    @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@unique([userId, tripId])
}
model Payment {
  id            String   @id @default(cuid())
  tripId        String
  bookingId     String?  @unique
  amount        Int
  transactionId String   @unique
  status        PaymentStatus @default(pending)
  channel       String?
  paymentUrl    String?
  errorMessage  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
model Ticket {
  id              String   @id @default(cuid())
  bookingId       String?  @unique
  tripId          String
  companyId       String
  code            String   @unique
  qrData          String?
  seatNumber      String?
  passengerName   String?
  passengerPhone  String?
  paymentMethod   String?
  amount          Int?
  soldBy          String   @default("online") // online | counter
  status          String   @default("active")  // active | used | cancelled
  validatedBy     String?
  validatedAt     DateTime?
  createdAt       DateTime @default(now())
  booking         Booking? @relation(fields: [bookingId], references: [id], onDelete: Cascade)
}
model Notification {
  id         String   @id @default(cuid())
  userId     String
  tripId     String?
  type       String   // reminder_48h | reminder_24h | reminder_6h | reminder_2h | reminder_10m | scanned | departed | stop | arrived
  title      String
  body       String
  dedupeKey  String   @unique
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  trip       Trip?    @relation(fields: [tripId], references: [id], onDelete: Cascade)
}
model Rating {
  id           String  @id @default(cuid())
  userId       String
  tripId       String
  driverStars  Int
  companyStars Int
  comment      String?
  createdAt    DateTime @default(now())
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  trip         Trip    @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@unique([userId, tripId])
}
model Incident {
  id          String   @id @default(cuid())
  tripId      String
  driverId    String
  type        String
  description String?
  resolved    Boolean  @default(false)
  createdAt   DateTime @default(now())
}
enum Role { passenger company driver admin }
enum DriverStatus { available on_trip off_duty }
enum TripStatus { scheduled boarding in_transit completed cancelled }
enum BookingStatus { confirmed cancelled }
enum PaymentStatus { pending paid failed }
```

---

## 3. Notifications — comportement attendu (point clé)

### 3.1 Rappels automatiques avant le départ
Un scheduler tourne **toutes les minutes** dans le backend. Pour chaque `Booking` confirmée dont le trajet est dans le futur, il crée (si `dedupeKey` n'existe pas déjà) une `Notification` pour l'utilisateur :

| `dedupeKey` | Déclencheur | Message (exemple) |
|---|---|---|
| `rem48h:<bookingId>` | 48 h avant le départ | `Rendez-vous à la gare de {station} à {time}. Votre départ est dans 2 jours.` |
| `rem24h:<bookingId>` | 24 h avant | `Demain, rendez-vous à la gare de {station} à {time}.` |
| `rem6h:<bookingId>` | 6 h avant | `Aujourd'hui, pensez à votre départ à {time} depuis {station}.` |
| `rem2h:<bookingId>` | 2 h avant | `Votre car part dans 2 heures. Préparez votre billet.` |
| `rem10m:<bookingId>` | 10 min avant | `Le car part dans 10 minutes, rendez-vous à la gare de {station}.` |

Le scheduler doit aussi être appelé juste après la création d'une réservation (pour le cas "billet pris 2 jours avant"). Utiliser `date` + `time` du trajet pour calculer le timestamp de départ. Ne jamais créer deux fois la même notification (`dedupeKey` unique).

### 3.2 Événements en direct (déclenchés par le chauffeur)
| Action chauffeur | Notification envoyée à tous les passagers du trajet |
|---|---|
| Validation du billet (scan) | `Billet scanné : asseyez-vous bien dans le car, il va décoller tout à l'heure.` (`type: scanned`) |
| Statut trajet → `in_transit` | `Le car vient de décoller. Bon voyage !` (`departed`) |
| `POST /trips/:id/stop {name}` | `Le car est en escale à {name}.` (`stop`) |
| Statut trajet → `completed` | `Le car est arrivé à {arrivee}. Merci de noter la compagnie et le chauffeur.` (`arrived`) |

L'application doit savoir qu'un billet **imprimé** a été scanné : le QR contient `ticket.code`, le scan appelle `POST /driver/tickets/validate`, donc l'événement est serveur et fonctionne quel que soit le support du billet.

### 3.3 Diffusion
- Toujours créer la notification en BDD (source de vérité, visible dans l'app avec badge « non lu »).
- Optionnel : si `RESEND_API_KEY`/`TWILIO_*`/`AFRICAS_TALKING_*` sont définis, envoyer aussi e-mail/SMS. Ne jamais planter si ces clés sont absentes.
- Frontend : cloche avec compteur, liste des notifications, « tout marquer comme lu », polling toutes les 15 s.

---

## 4. Endpoints backend (contrat exact)

### Auth
| Méthode | Chemin | Auth | Body → Réponse |
|---|---|---|---|
| POST | `/api/auth/register` | publique | `{firstName,lastName,phone,password}` → `{user,token}` |
| POST | `/api/auth/login` | publique | `{phone,password}` → `{user,token}` (admin utilise aussi cet endpoint) |
| POST | `/api/auth/forgot-password` | publique | `{phone}` → `{message,code}` (code renvoyé en réponse **uniquement en dev**, pour la démo) |
| POST | `/api/auth/reset-password` | publique | `{phone,code,password}` → `{message}` |
| GET | `/api/auth/me` | token | → `{user}` |
| PATCH | `/api/auth/me` | token | `{firstName?,lastName?,city?,email?,phone?}` → `{user}` |
| POST | `/api/company/auth/register` | publique | `{companyName,rccm?,taxId?,city,firstName,lastName,phone,email,password}` → `{user,token}` |
| POST | `/api/company/auth/login` | publique | `{email,password}` → `{user,token}` |
| GET/PATCH | `/api/company/auth/me` | token company | → `{user}` |
| POST | `/api/driver/auth/login` | publique | `{phone,password}` → `{driver,token}` |
| GET | `/api/driver/auth/me` | token driver | → `{driver}` |

> Les chauffeurs sont **créés par la compagnie** via `POST /api/company/drivers` (pas d'inscription publique). Le frontend n'a pas de page d'inscription chauffeur, ni de chat.

### Trajets & réservation (publiques)
| Méthode | Chemin | Réponse |
|---|---|---|
| GET | `/api/trips?depart=&arrivee=&date=&company=` | `{trips:[...]}` avec `{id,depart,arrivee,station,date,time,duration,price,availableSeats,company,driverName,driverRating,vehiclePlate,stops,status,paymentMethods}` |
| GET | `/api/trips/:id` | `{trip}` |
| GET | `/api/trips/companies` | `{companies:[string]}` |
| GET | `/api/trips/cities` | `{cities:[string]}` |
| POST | `/api/trips/:id/bookings` | `{passengerName,passengerPhone,paymentMethod}` → `{booking,ticket}` (paiement **Espèces** à l'embarquement uniquement) |
| GET | `/api/trips/bookings/mine` | token → `{bookings:[{...booking,trip,ticket}]}` |
| POST | `/api/trips/:id/rating` | token → `{driverStars,companyStars,comment?}` → `{rating}` (vérifier que l'utilisateur a une réservation sur ce trajet) |

### Paiement GeniusPay
| Méthode | Chemin | Réponse |
|---|---|---|
| POST | `/api/payments/initiate` | `{tripId,passengerName,passengerPhone,passengerEmail?,method}` → `{paymentId,paymentUrl,amount}` ; **503** si clés absentes |
| GET | `/api/payments/:id` | `{payment:{id,status,amount,channel},booking?}` |
| POST | `/api/payments/:id/confirm` | vérifie chez GeniusPay puis finalise → `{status:'paid'\|'pending'\|'failed',booking?}` ; idempotent |
| POST | `/api/payments/webhook/geniuspay` | HMAC-SHA256 sur `timestamp.rawBody`, en-têtes `x-webhook-signature`, `x-webhook-timestamp`, `x-webhook-event` |

Finalisation = `Booking` + `Ticket` + appel du scheduler + notification « réservation confirmée ».

### Compagnie (token `role=company`)
`GET/POST /api/company/trips`, `GET/PATCH/DELETE /api/company/trips/:id`,
`GET/POST/PATCH/DELETE /api/company/drivers`, `GET/POST/PATCH/DELETE /api/company/vehicles`,
`GET/POST /api/company/tickets` (vente guichet), `GET /api/company/stats`.

`POST /api/company/drivers` body `{firstName,lastName,phone,password,licenseNumber?}` → crée `User(role=driver)` + `Driver`.

### Chauffeur (token `role=driver`)
`GET /api/driver/trips`, `GET /api/driver/trips/:id`, `PATCH /api/driver/status {status}`,
`PATCH /api/driver/trips/:id/status {status:'boarding'|'in_transit'|'completed'}` (déclenche les notifications),
`POST /api/driver/trips/:id/stop {name}`,
`POST /api/driver/tickets/validate {code}` (vérifie `trip.driverId`, 409 si déjà utilisé, notifie le passager),
`POST /api/driver/incidents {type,description}`, `GET /api/driver/stats`.

### Notifications (token)
`GET /api/notifications` → `{notifications,unread}`, `POST /api/notifications/read-all`, `POST /api/notifications/:id/read`.

### Admin (token `role=admin`)
`GET /api/admin/stats`, `GET /api/admin/users?role=&page=&limit=`, `GET /api/admin/users/:id`,
`PATCH /api/admin/users/:id {role?}`, `DELETE /api/admin/users/:id` (refuse l'auto-suppression).

### Santé
`GET /api/health` → `{status:'ok',service:'vitoo-v2'}`.

---

## 5. Écrans frontend attendus

### Passager (`/passenger/*`)
- **Recherche** : villes (datalist), départ, arrivée, date, filtres prix/tri ; liste des trajets ; fiche trajet (gare, heure, chauffeur, note, compagnie).
- **Réservation en 2 étapes** : infos passager → choix moyen. `Espèces` = confirmation directe ; autres = `initiatePayment` + redirect GeniusPay.
- **Retour paiement** `/passenger/payment-return?paymentId=` : polling `confirm` puis affichage du billet.
- **Mes billets** : QR (`qrcode`), impression, PDF (`jspdf`), copie du code.
- **Mes réservations** : historique.
- **Notifications** : cloche + badge, liste, tout marquer comme lu.
- **Notation** : après notification « arrivé », bouton « Noter le trajet » → modale 2 notes (compagnie + chauffeur) + commentaire.
- **Profil / Paramètres** : édition profil, thème sombre, langue FR/EN (bouton simple), déconnexion, FAQ/support.

### Compagnie (`/company/*`)
- **Aperçu** : cartes (trajets actifs, billets vendus, chauffeurs, véhicules) + dernières ventes.
- **Trajets** : création/édition (départ, arrivée, gare, date, heure, prix, places, chauffeur, véhicule, escales viavirgules), détail avec passagers embarqués.
- **Guichet** : vente de billet comptoir + historique + QR/impression.
- **Statistiques** : revenus, billets, répartition par moyen de paiement (tableaux simples, pas de graphiques lourds).
- **Profil** : informations + marque blanche (logo, couleurs, moyens de paiement) + chauffeurs + véhicules.
- **Paramètres / Déconnexion**.

### Chauffeur (`/driver/*`)
- **Missions** : en cours / à venir / terminées.
- **Détail mission** : liste des passagers, boutons « Scanner », « Démarrer le trajet », « Terminer », « Enregistrer un escale » (saisie du nom), « Signaler un incident ».
- **Scan** : caméra (`html5-qrcode`) ou code manuel → lookup puis validation.
- **Incidents**, **Profil** (disponibilité, stats), **Déconnexion**.
- **Aucun onglet Messages, aucune carte.**

### Admin (`/admin/*`)
Stats globales + liste/détail utilisateurs + bannir (rétrograde en `passenger`) + supprimer. Pas de messaging.

### Accueil
`/` → `/passenger` en production. `/company`, `/driver`, `/admin` affichent leur propre écran de connexion ou redirigent si pas de session.

---

## 6. Sessions frontend (localStorage)
`vitoo_session` (passager ET admin), `vitoo_company_session`, `vitoo_driver_session`. Chaque espace a sa session propre. Validation au montage via `/auth/me`, `/company/auth/me`, `/driver/auth/me`.

---

## 7. Interdictions explicites
- Pas de `mapbox`, `leaflet`, `ws`, `openai`, `@github/copilot`, `@capacitor/geolocation`.
- Pas de `GET /api/dev/reset`.
- Pas de chat compagnie↔chauffeur (`Message` supprimé du schéma).
- Pas de page `/maptest`, pas de texte « suivi en direct ».
- Pas de clé secrète dans le code ; uniquement `.env`.
