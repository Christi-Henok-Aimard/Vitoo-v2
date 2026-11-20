# ÉVOLUTIONS v4 — recherche instantanée, zéro démo, design sobre

## 1. Recherche instantanée d'un passager (espace compagnie)
- Dans « Équipe & flotte », le champ numéro déclenche la recherche **automatiquement pendant la saisie** (debounce ~300 ms), sans bouton « Rechercher ».
- Dès qu'un passager est trouvé, afficher une **fiche profil** avec : photo (si `avatarUrl`), sinon initiales dans un disque ; prénom + nom ; numéro de téléphone.
- Bouton « Ajouter comme chauffeur » sous la fiche. Message clair si aucun passager trouvé.
- Backend : `GET /api/company/passengers?phone=` doit aussi renvoyer `avatarUrl`.
- La photo uploadée par le passager dans son profil est une URL locale/data-URL stockée dans `User.avatarUrl`.

## 2. Zéro démo, zéro donnée
- Supprimer `backend/prisma/seed.ts` et le script `seed` de `backend/package.json`.
- Vider la base locale : aucune compagnie, aucun trajet, aucun passager, aucun chauffeur, aucune notification.
- Aucun compte de démonstration documenté nulle part : README ne doit contenir aucun identifiant/mot de passe d'exemple.
- Les comptes sont créés uniquement par les vrais formulaires (passager, compagnie) et l'admin uniquement via `ADMIN_BOOTSTRAP_PHONE` / `ADMIN_BOOTSTRAP_PASSWORD` choisis par le propriétaire (laisser vide = aucun admin).
- Le site doit donc être vide au premier lancement, sur les 4 espaces.

## 3. Design : retirer l'effet « IA »
- **Supprimer le splash screen** entièrement (composant + usage dans `App.tsx` + CSS). L'application s'affiche directement.
- **Supprimer `GlassBackdrop`** et tout effet glassmorphism : pas de `backdrop-filter`, pas de blobs animés rose/bleu, pas de dégradé lumineux, pas de halo/néon, pas de boutons pill « lentille ».
- Style sobre et professionnel (type application métier) :
  - fond clair uni `#f6f8fb`, surfaces blanches, bordures 1 px `#e3e8f0`, radius 10–12 px, ombre très légère ;
  - accent bleu `#1d5df5`, texte `#16233a`, texte secondaire `#667085` ;
  - typographie système, pas d'emoji décoratif, pas de dégradés partout ;
  - boutons pleins bleu ou secondaires gris clair, pas de gradients ;
  - responsive et mode sombre simple (gris foncé uni) si conservation.
- Conserver toutes les fonctionnalités (auth, recherche, réservation, paiement, billets, notifications, notation, chauffeur, compagnie, admin). Ne rien casser.
