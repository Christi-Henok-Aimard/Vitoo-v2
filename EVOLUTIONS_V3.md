# ÉVOLUTIONS v3 — « tout réel » + design liquid glass

Ce document remplace les points correspondants de `CONTRAT_API.md`. Le reste du contrat reste valide (GeniusPay, notifications, modèle de données de base).

## 1. Principe général

- **Plus de comptes de démonstration** : compagnies, passagers et administrateurs sont créés par de vrais formulaires. Le seed ne sert qu'au test local et ne crée aucun passager/chauffeur.
- **Un chauffeur est d'abord un passager** : il possède un compte passager. La compagnie ne crée pas de compte chauffeur : elle **cherche un passager existant par son numéro de téléphone** et le promeut. Le passager garde son `role: 'passenger'` ; son espace chauffeur est exposé via `driverSpace` dans sa session.
- **Moyens de paiement réels et contrôlés** : liste fermée de moyens, activés par la compagnie via des boutons (pas de saisie libre). Le passager ne voit que les moyens activés sur le trajet.
- **Authentification du premier Vitoo** : téléphone normalisé, scrypt, JWT 7 j, OTP oubli/mot de passe, Google OAuth, sessions séparées par espace, mise à jour profil/mot de passe.
- **Design** : splash screen et surfaces en verre dépoli façon DeepSeek Harness / liquid glass — blobs animés rose et bleu, transparence, flou, bordures lumineuses, boutons « lentille », halo au survol. Lisible et responsive.

---

## 2. Backend — changements exacts

### 2.1 Rôle chauffeur / promotion d'un passager
- Ne plus créer de `User` avec `role: 'driver'`. Le champ `Role.driver` peut rester dans l'enum pour compatibilité mais n'est plus utilisé.
- Helper `driverSpaceFor(userId)` : retourne `null` ou `{ id, companyId, companyName, licenseNumber, status }` en cherchant `prisma.driver.findUnique({where:{userId}, include:{...}})`.
- Ajouter `driverSpace` à **toutes** les réponses d'auth qui renvoient `{user, token}` : `/auth/register`, `/auth/login`, `/auth/google`, `/auth/me`, `PATCH /auth/me`.
- Le token JWT d'un chauffeur est un token **passager** : `requireAuth` suffit ; les routes `/driver/*` résolvent le `Driver` via `request.authUser.id` (pas via `getDriverSession` avec un `role driver`).
- `GET /api/driver/me` renvoie `{ driver, companyName }` (token passager). Supprimer les routes `/api/driver/auth/*` et la logique de session chauffeur séparée. Le frontend n'a plus de formulaire de connexion chauffeur : on entre dans l'espace chauffeur depuis le profil passager.

### 2.2 Nouveaux endpoints compagnie
- `GET /api/company/passengers?phone=<numéro>` → `{ user: {id,firstName,lastName,phone} | null }`. Normaliser le numéro ; ne retourner que les users `role=passenger` **sans profil Driver**.
- `POST /api/company/drivers` body `{ phone, licenseNumber? }` :
  - normalise le phone ;
  - cherche `User` avec ce phone et `role=passenger` → **404** `{message:"Aucun compte passager ne correspond à ce numéro. Invitez cette personne à créer un compte."}` ;
  - **409** si un `Driver` existe déjà pour ce user ;
  - crée le `Driver` lié à `userId` et `companyId` ; renvoie `{driver}`.
  - Plus aucun champ `password` / `firstName` / `lastName` dans cette route.
- Les autres routes `/company/drivers` restent (liste, détail, update statut/permis, delete).

### 2.3 Google OAuth (repris du premier projet)
- Ajouter `POST /api/auth/google {idToken}` : `google-auth-library` `OAuth2Client.verifyIdToken({idToken, audience: GOOGLE_CLIENT_ID})`. Trouve/crée un User `provider='google'`, `role='passenger'`, renvoie `{user, token, driverSpace}`.
- Si le Google login correspond à une compagnie existante, refuser (ne pas mélanger les espaces).
- `GOOGLE_CLIENT_ID` optionnel : la route renvoie 501 si la variable est absente.

### 2.4 OTP réel
- `forgot-password` : génère un code 6 chiffres stocké en mémoire 5 min, 5 essais max. En **développement**, renvoie `{message, code}` pour tester. En **production**, ne renvoie **jamais** le code : il est envoyé par SMS/e-mail si configuré, sinon la route répond 503 avec un message explicite.
- Normaliser les numéros : accepter `07…`, `+22507…`, `0022507…`, espaces et tirets → format `+225XXXXXXXXX`.
- Ne jamais logger le code en clair en production.

### 2.5 Moyens de paiement (liste fermée)
Créer `src/paymentMethods.ts` :
```ts
export const PAYMENT_METHODS = ['Espèces','Wave','Orange Money','MTN MoMo','Moov Money','Carte bancaire'] as const;
export const ONLINE_METHODS = PAYMENT_METHODS.filter(m => m !== 'Espèces');
export const isOnlineMethod = (m: string) => m !== 'Espèces';
export const normalizeMethods = (input: unknown): string[] => { /* déduplique, filtre les valeurs inconnues, toujours au moins ['Espèces'] */ };
```
- Company `PATCH /company/auth/me` : `paymentMethods` doit passer par `normalizeMethods`.
- Trip `POST/PATCH /company/trips` : `paymentMethods` passe par `normalizeMethods`.
- `POST /trips/:id/bookings` : refuse un moyen non présent dans `trip.paymentMethods`.
- `POST /payments/initiate` : refuse un moyen non en ligne ou non autorisé par le trajet.
- Le seed utilise `normalizeMethods`.

### 2.6 Seed
- Ne créer **aucun** passager ni chauffeur. Garder éventuellement 1 compagnie + 1 véhicule + 2 trajets futurs **uniquement pour le test local**, et documenter « ne pas exécuter en production ».

---

## 3. Frontend — changements exacts

### 3.1 Splash screen + design liquid glass (priorité visuelle)
- Nouveau `src/components/Splash.tsx` affiché au montage de l'app pendant ~1,8 s (une seule fois, pas à chaque navigation) : 
  - fond sombre profond avec **deux-trois blobs animés** rose (`#ff5fa2`) et bleu (`#4d8dff`) floutés (`filter: blur(90px)`, animations lentes) ;
  - au centre une **carte en verre** : `background: rgba(255,255,255,.08)`, `backdrop-filter: blur(24px) saturate(140%)`, bordure 1px `rgba(255,255,255,.25)`, ombre douce, reflet en haut (`linear-gradient`) ;
  - logo « V » dans un disque glass, texte « VITOO », tagline « Tous vos trajets interurbains, au même endroit. », barre de progression animée ;
  - responsive mobile, prefers-reduced-motion respecté.
- Étendre le style « liquid glass » aux cartes, en-têtes, boutons, champs et modales : surfaces translucides, flou, liseré clair, halo au survol, boutons pills avec effet loupe. Rester lisible (texte sombre sur surfaces claires / blanc sur surfaces sombres).
- Palette : bleu Vitoo `#1d5df5`, rose `#ff5fa2`, accent cyan léger. Fond avec blobs animés disponible au moins sur le splash et les écrans d'authentification.

### 3.2 Auth « comme le premier Vitoo »
- Formulaire passager : prénom, nom, téléphone (normalisé côté serveur), mot de passe, confirmation.
- Bouton **Google** : charge Google Identity Services via `VITE_GOOGLE_CLIENT_ID`, récupère un `idToken`, POST `/auth/google`. Masquer le bouton si la variable est absente.
- Mot de passe oublié : téléphone → code OTP → nouveau mot de passe. En dev, le code est renvoyé et affiché ; en prod, message « code envoyé par SMS/e-mail ».
- Profil : édition, changement de mot de passe, photo locale, et **bouton « Accéder à mon espace chauffeur »** si `driverSpace` est présent.
- Sessions : `vitoo_session` (passager + admin + chauffeur via driverSpace), `vitoo_company_session`. **Supprimer `vitoo_driver_session`**. `GET /auth/me` fournit `driverSpace`.

### 3.3 Espace chauffeur
- Plus de `/driver/login` : l'accès se fait depuis le profil passager (bouton) vers `/driver/missions`.
- `Guard space="driver"` vérifie `userSession?.driverSpace`.
- Toutes les fonctions `driverApi` utilisent le token de `vitoo_session`.
- `GET /api/driver/me` permet de rafraîchir les infos chauffeur.
- Missions, scan QR, démarrage/fin, escale, incidents, stats, profil restent inchangés. Aucun chat, aucune carte.

### 3.4 Compagnie — ajout d'un chauffeur par numéro
- Écran « Équipe & flotte » : champ **numéro de téléphone** + bouton « Rechercher » → affiche le passager trouvé (nom + téléphone) puis bouton **« Ajouter comme chauffeur »** (avec numéro de permis optionnel).
- Si aucun passager : message clair « Aucun compte passager avec ce numéro. Invitez la personne à s'inscrire d'abord. »
- Aucun champ mot de passe / prénom / nom pour créer un chauffeur.

### 3.5 Moyens de paiement par boutons
- Dans le profil compagnie et le formulaire de trajet, remplacer la saisie texte par une **grille de boutons toggles** (chips) pour : Espèces, Wave, Orange Money, MTN MoMo, Moov Money, Carte bancaire. Clic = activer/désactiver, état visuel clair, au moins « Espèces » actif.
- Le récapitulatif affiche les moyens choisis. Côté passager, `BookingFlow` n'affiche **que** `trip.paymentMethods` ; « Espèces » = réservation directe, les autres = GeniusPay.

---

## 4. Interdictions inchangées
- Pas de carte, pas de GPS temps réel, pas de chat compagnie↔chauffeur, pas de `/maptest`, pas de reset destructif, pas de clé secrète dans le code.
- Le paiement en ligne reste GeniusPay avec 503 si non configuré.
