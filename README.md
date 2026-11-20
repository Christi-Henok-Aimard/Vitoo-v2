# Vitoo v2 — version simple et propre

Plateforme de réservation de trajets interurbains (Côte d'Ivoire) réécrite de zéro.
**Pas de carte, pas de suivi GPS temps réel, pas de chat compagnie↔chauffeur.**
Paiement en ligne : **GeniusPay**.

## Les 4 espaces

| Espace | Ce qu'il fait |
|---|---|
| **Passager** | Rechercher un trajet → réserver → payer → obtenir son billet QR/PDF → recevoir des rappels (2 j, 24 h, 6 h, 2 h, 10 min), être informé quand son billet est scanné, quand le car décolle, à chaque escale et à l'arrivée → noter la compagnie et le chauffeur. |
| **Compagnie** | Trajets, chauffeurs, véhicules, vente au guichet, statistiques, marque blanche. |
| **Chauffeur** | Missions, scan QR du billet, démarrage/fin de trajet, escale, incidents, statistiques. |
| **Admin** | Statistiques globales, liste des utilisateurs, bannir/supprimer. |

## Démarrage en local

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run prisma:push
npm run seed
npm run dev          # http://localhost:4000/api/health

# 2. Frontend (dans un autre terminal)
cd ..
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

### Comptes de démonstration (créés par le seed)

| Espace | Identifiant | Mot de passe |
|---|---|---|
| Compagnie | `company@vitoo.demo` | `password123` |
| Chauffeur | `+225000000002` | `password123` |
| Admin | `+225000000003` | `admin12345` (défini dans `backend/.env`) |
| Passager | Créez un compte depuis `/passenger/register` | — |

Le seed crée aussi 2 trajets futurs (Abidjan→Bouaké dans 2 jours, Abidjan→Korhogo dans 7 jours) pour démontrer les rappels automatiques.

> Pour la démonstration, choisissez le paiement **Espèces** : le billet et les notifications sont créés immédiatement. Le paiement en ligne GeniusPay nécessite des clés API (sinon le backend répond 503, volontairement, pour éviter les faux billets).

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
