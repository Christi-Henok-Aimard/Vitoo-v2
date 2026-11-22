# Vitoo v2 — version simple et propre

Plateforme de réservation de trajets interurbains (Côte d'Ivoire) réécrite de zéro.
**Pas de carte, pas de suivi GPS temps réel, pas de chat compagnie↔chauffeur.**
Paiement en ligne : **GeniusPay**.

## Les 4 espaces

| Espace | Ce qu'il fait |
|---|---|
| **Passager** | Rechercher un trajet → réserver → payer → obtenir son billet QR/PDF → recevoir des rappels (2 j, 24 h, 6 h, 2 h, 10 min), être informé quand son billet est scanné, quand le car décolle, à chaque escale et à l'arrivée → noter la compagnie et le chauffeur. |
| **Compagnie** | Trajets, chauffeurs, véhicules, vente au guichet, statistiques, marque blanche. |
| **Chauffeur** | Un passager promu par sa compagnie : il garde son compte passager et accède à son espace chauffeur depuis son profil. Missions, scan QR, démarrage/fin de trajet, escale, incidents, statistiques. |
| **Admin** | Statistiques globales, liste des utilisateurs, bannir/supprimer. |

## Démarrage en local

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run prisma:push
npm run dev          # http://localhost:4000/api/health

# 2. Frontend (dans un autre terminal)
cd ..
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

### Création des comptes (réel)

- **Passager** : `/passenger/register` (téléphone + mot de passe) ou connexion Google si `VITE_GOOGLE_CLIENT_ID` est renseigné.
- **Compagnie** : `/company/register` (nom, RCCM, identifiant fiscal, ville, responsable, e-mail, mot de passe).
- **Chauffeur** : il possède **d'abord un compte passager**. Dans l'espace compagnie → « Équipe & flotte », tapez son numéro : la fiche (photo, prénom, nom, téléphone) apparaît instantanément ; cliquez alors sur « Ajouter comme chauffeur ». S'il n'a pas encore de compte, invitez-le à s'inscrire comme passager. Ensuite, depuis son profil passager, il clique sur « Accéder à mon espace chauffeur ».
- **Admin** : compte créé automatiquement au démarrage du backend **uniquement si** `ADMIN_BOOTSTRAP_PHONE` et `ADMIN_BOOTSTRAP_PASSWORD` sont définis avec vos propres valeurs. Sans ces variables, aucun admin n'existe.

> **Aucun compte ni aucune donnée de démonstration ne sont fournis.** Au premier lancement, les quatre espaces sont vides : les compagnies, passagers et trajets sont créés réellement via les formulaires.

### Moyens de paiement

La compagnie active ses moyens depuis son profil et ses trajets via des **boutons** : Espèces, Wave, Orange Money, MTN MoMo, Moov Money, Carte bancaire. Le passager ne voit que les moyens activés pour le trajet choisi. « Espèces » crée le billet immédiatement (paiement à l'embarquement) ; les autres moyens redirigent vers GeniusPay. Sans clés GeniusPay, le backend répond 503 volontairement — aucun faux billet n'est créé.

## Langues

L'application propose **4 langues** : français, anglais, **dioula (jula)** et **baoulé**. Le sélecteur se trouve **uniquement dans les paramètres** (profil passager, compagnie et chauffeur), jamais sur les pages de connexion. Le choix est mémorisé dans `vitoo_lang`.

**Toute l'interface est traduite** : authentification, navigation, recherche, réservation, billets, notifications, profils, espaces compagnie/chauffeur/admin, messages d'erreur et dates relatives. Aucun texte ne doit rester dans une langue différente de celle choisie. Les noms de villes, numéros, codes, montants et noms de compagnies restent des données inchangées.

Les traductions dioula/baoulé sont des versions de référence à faire relire par un locuteur natif avant une communication grand public ; les noms de services (Wave, Orange Money, MTN MoMo, Moov Money, GeniusPay) et l'acronyme RCCM restent inchangés.

## Identité visuelle

Le logo Vitoo (symbole « V » cyan) est utilisé sur l'authentification, l'en-tête et le favicon. La couleur primaire de toute l'application est le cyan du logo (`#0ea5e9`, plus clair en mode sombre `#38bdf8`).

## Composants KBR-UI

L'interface utilise des composants animés de [KBR-UI](https://ui.rodolphekouadio.com) (créé par Kouadio Bah Rodolphe) : billet détachable, bouton copier, pilule de statut, toast, liste squelette, contrôle segmenté, select, accordéon. Les fichiers sont vendorisés dans `public/vendor/kbr/` et chargés depuis `index.html`. Chaque composant reçoit `appearance="light" | "dark"` selon le thème choisi dans l'application (bascule clair/sombre).

## Variables d'environnement

Voir `.env.example` (frontend) et `backend/.env.example` (backend).
**En production, `JWT_SECRET` est obligatoire** : le serveur refuse de démarrer sans lui.

## Déploiement

- **Vercel** : projet Vite, `npm run build`, variable `VITE_API_URL=https://VOTRE-API/api`.
- **Render** (backend) : `Build Command` = `cd backend && npm ci && npx prisma generate && npm run build`, `Start Command` = `cd backend && node dist/index.js`, disque persistant monté sur `/data` avec `DATABASE_URL=file:/data/vitoo.db`.
- Les notifications sont stockées en base ; l'envoi e-mail/SMS est optionnel et n'est activé que si les clés correspondantes sont fournies.

## Règles de gestion importantes

- Un billet imprimé est valable : le QR contient `ticket.code`, validé côté serveur par le chauffeur.
- Le passager est notifié **côté serveur**, donc même sans application ouverte au moment du scan, il verra la notification en revenant.
- La notation n'est possible que pour un trajet réellement réservé par l'utilisateur.
- Aucune donnée de localisation n'est collectée.

Voir `CONTRAT_API.md` pour le contrat d'API complet et les diagrammes de séquence.
