# Intégration KBR-UI

Le code des composants KBR-UI nécessite un compte gratuit : https://ui.rodolphekouadio.com/compte

## Deux façons de procéder

### Option A — clé API (recommandée)
1. Crée un compte gratuit et génère ta clé sur https://ui.rodolphekouadio.com/compte
2. **Ne colle pas la clé dans le chat.** Écris-la dans le fichier :
   `C:\Users\chris\vitoo-v2\.kbr-key`
   (ce fichier est ignoré par Git)
3. Dis-moi que c'est fait : j'installe la skill `rodolphe2002/kbr-ui-skills` et je récupère les composants avec la clé.

### Option B — fichiers téléchargés
1. Depuis ton compte, télécharge les fichiers JavaScript des composants et copie lesExtraits HTML fournis.
2. Dépose les fichiers `.js` dans ce dossier `vendor/kbr-ui/`.
3. Dis-moi quels composants tu as téléchargés : je les branche dans l'application.

## Composants KBR-UI utiles pour Vitoo

| Composant | Usage dans Vitoo |
|---|---|
| Bouton d'action | Enregistrement des formulaires (Enregistrer → Enregistrement → Enregistré / Réessayer) |
| Bouton à charge / Paiement | Réservation et redirection GeniusPay |
| Saisie de code | OTP mot de passe oublié |
| Mot de passe | Champs mot de passe (afficher/masquer) |
| Toast | Confirmations et erreurs |
| Recherche extensible | Recherche de trajet et recherche du passager par téléphone |
| Ticket détachable | Billet électronique du passager |
| Contrôle segmenté / Dash Tabs | Navigation entre les espaces et onglets |
| Pilule de statut | Statuts des trajets et billets |
| Liste squelette | Chargement des listes |
| Interrupteur + volet | Paramètres (thème, notifications) |
| Select | Choix villes, chauffeurs, véhicules |
| Sélecteur de quantité | Nombre de places |

## Thèmes
Tu veux les deux thèmes (clair et sombre) avec une bascule. Les composants KBR-UI proposent 22 thèmes clair/sombre ; j'alignerai le thème global de l'application avec le thème des composants.
