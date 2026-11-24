# Vérification des comptes et canaux externes

## 1. Vérification à la création / connexion

| Espace | Canal | Code | Moment |
|---|---|---|---|
| Passager | **SMS** (Twilio ou Africa's Talking) | 4 chiffres | Inscription, puis à la connexion si le compte n'est pas encore vérifié |
| Compagnie | **E-mail** (Resend) | 4 chiffres | Idem |
| Admin | **E-mail** (Resend) | 4 chiffres | Première connexion (compte créé par `ADMIN_BOOTSTRAP_*`) |

Le code est stocké en base avec une expiration de 10 minutes. Tant que `User.verified` est `false`, l'accès aux espaces est bloqué et l'application affiche l'écran de saisie du code.

Endpoints :
- `POST /api/auth/verify` `{ phone, code }` et `POST /api/auth/resend-code` `{ phone }`
- `POST /api/company/auth/verify` `{ email, code }` et `POST /api/company/auth/resend-code` `{ email }`
- `POST /api/admin/verify` `{ phone, code }` et `POST /api/admin/resend-code` `{ phone }`

La réponse d'inscription/connexion contient `verified` et `verification: { required, channel }`.

## 2. Variables d'environnement nécessaires

```env
# E-mail (compagnie + admin)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Vitoo <no-reply@TON-DOMAINE.ci>

# SMS passager — choisir AU MOINS un fournisseur
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
# ou
AFRICAS_TALKING_USERNAME=...
AFRICAS_TALKING_API_KEY=...
AFRICAS_TALKING_FROM=Vitoo

# Admin
ADMIN_BOOTSTRAP_PHONE=+2250102218053
ADMIN_BOOTSTRAP_PASSWORD=...
ADMIN_BOOTSTRAP_EMAIL=christhenokaimard@gmail.com
```

Sans ces clés, l'envoi échoue : en développement le code est renvoyé dans la réponse (test), en production la route répond 503. Il faut donc configurer au moins Resend + un fournisseur SMS avant le déploiement.

## 3. GeniusPay

1. Créer un compte marchand sur https://geniuspay.ci (sandbox d'abord).
2. Récupérer `API_KEY`, `API_SECRET` et le secret webhook.
3. Renseigner sur Render :
   ```
   GENIUSPAY_API_KEY=pk_sandbox_...
   GENIUSPAY_API_SECRET=sk_sandbox_...
   GENIUSPAY_BASE_URL=https://geniuspay.ci/api/v1/merchant
   GENIUSPAY_WEBHOOK_SECRET=whsec_...
   ```
4. Déclarer l'URL de webhook chez GeniusPay :
   `https://TON-API.onrender.com/api/payments/webhook/geniuspay`
5. Tester en sandbox, puis passer aux clés live après immatriculation (RCCM/NIF).
6. Sans clés, le bouton « Payer en ligne » répond 503 volontairement ; le paiement « Espèces » reste utilisable.
