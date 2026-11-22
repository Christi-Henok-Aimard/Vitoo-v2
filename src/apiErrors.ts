/**
 * Les erreurs viennent du backend en français. On les traduit côté client
 * pour qu'aucun texte ne reste dans une langue différente de celle choisie.
 */
import type { Lang } from './i18n';

type Messages = Record<string, Partial<Record<Lang, string>>>;

const errors: Messages = {
  'Une erreur est survenue.': {
    en: 'An error occurred.', dyu: 'Filɛli dɔ kɛna.', bci: 'An yi kɛ.',
  },
  'Numéro ivoirien valide requis.': {
    en: 'A valid Ivorian phone number is required.',
    dyu: 'Telefoni ivoirienɲuman ka kan.',
    bci: 'Tɛlɛfon ivuasyen kpakpa kɛ.',
  },
  'Numéro ivoirien invalide.': {
    en: 'Invalid Ivorian phone number.', dyu: 'Telefoni ivoirien ma kɛ.', bci: 'Tɛlɛfon ivuasyen yi.',
  },
  'Aucun compte associé à ce numéro.': {
    en: 'No account found for this number.', dyu: 'Konto tɛ yen ni nin telefoni ye.', bci: 'Konto be’le ni nin tɛlɛfon ye.',
  },
  'Aucun compte associé à cette adresse ou ce numéro.': {
    en: 'No account found for this email or number.',
    dyu: 'Konto tɛ yen ni nin e-mail walima telefoni ye.',
    bci: 'Konto be’le ni nin e-mail walima tɛlɛfon ye.',
  },
  'Numéro ou mot de passe incorrect.': {
    en: 'Incorrect phone number or password.',
    dyu: 'Telefoni walima sarali ma kɛ.', bci: 'Tɛlɛfon walima sarali yi.',
  },
  'Mot de passe invalide.': {
    en: 'Invalid password.', dyu: 'Sarali ma kɛ.', bci: 'Sarali yi.',
  },
  'Mot de passe requis.': {
    en: 'Password required.', dyu: 'Sarali ka kan.', bci: 'Sarali kɛ.',
  },
  'Code invalide ou expiré.': {
    en: 'Invalid or expired code.', dyu: 'Kode ma kɛ walima a tɛmɛna.', bci: 'Kode yi walima a tɛm.',
  },
  'Code invalide.': { en: 'Invalid code.', dyu: 'Kode ma kɛ.', bci: 'Kode yi.' },
  'Trop de tentatives : demandez un nouveau code.': {
    en: 'Too many attempts: request a new code.',
    dyu: 'A kɛ ka caaya: ɲini kode kura.', bci: 'A kɛ ka ca: n’yɛ kode kpa.',
  },
  'Ce numéro est déjà inscrit.': {
    en: 'This number is already registered.', dyu: 'Nin telefoni kɛnɛyalen don.', bci: 'Nin tɛlɛfon kɛlen don.',
  },
  'Ce numéro est déjà utilisé.': {
    en: 'This number is already in use.', dyu: 'Nin telefoni be baara la.', bci: 'Nin tɛlɛfon be baara.',
  },
  'Cet e-mail est déjà utilisé.': {
    en: 'This email is already in use.', dyu: 'Nin e-mail be baara la.', bci: 'Nin e-mail be baara.',
  },
  'Cet e-mail est déjà inscrit.': {
    en: 'This email is already registered.', dyu: 'Nin e-mail kɛnɛyalen don.', bci: 'Nin e-mail kɛlen don.',
  },
  'Trajet introuvable.': { en: 'Trip not found.', dyu: 'Sira tɛ yen.', bci: 'Sira be’le.' },
  'Billet introuvable.': { en: 'Ticket not found.', dyu: 'Tikɛti tɛ yen.', bci: 'Tikɛti be’le.' },
  'Billet déjà scanné.': { en: 'Ticket already scanned.', dyu: 'Tikɛti sɛgɛsɛgɛlen don.', bci: 'Tikɛti n’yɛlen don.' },
  'Billet non valide.': { en: 'Invalid ticket.', dyu: 'Tikɛti ma kɛ.', bci: 'Tikɛti yi.' },
  'Places insuffisantes.': { en: 'Not enough seats.', dyu: 'Sigiyɔrɔ tɛ se.', bci: 'N’nɔmɛ tɛ se.' },
  'Véhicule introuvable.': { en: 'Vehicle not found.', dyu: 'Mobili tɛ yen.', bci: 'Bu be’le.' },
  'Chauffeur introuvable.': { en: 'Driver not found.', dyu: 'Mobilikɛla tɛ yen.', bci: 'Bu kɛla be’le.' },
  'Aucun service SMS ou e-mail configuré : envoi du code impossible.': {
    en: 'No SMS or email service configured: cannot send the code.',
    dyu: 'SMS walima e-mail sɛtɛŋ tɛ yen: kode tɛ ci.',
    bci: 'SMS walima e-mail be’le: kode tɛ so.',
  },
  'Envoi du code impossible : réessayez plus tard.': {
    en: 'Unable to send the code: try again later.',
    dyu: 'Kode tɛ ci: e n’a n’kɔnɔ.', bci: 'Kode tɛ so: a’n n’kɔnɔ.',
  },
  'Paiement en ligne indisponible (clés GeniusPay absentes).': {
    en: 'Online payment unavailable (GeniusPay keys missing).',
    dyu: 'Sɔngɔ sarali Internet na tɛ yen (GeniusPay sɛnɛ tɛ).',
    bci: 'Sarali Internet na be’le (GeniusPay kode be’le).',
  },
  'Réservation requise pour noter ce trajet.': {
    en: 'A booking is required to rate this trip.',
    dyu: 'Sira ɲini ka kan ka sira nɔtɔ.', bci: 'Sira ɲini kɛ kɛ sira n’yɛ.',
  },
  'Vous ne pouvez pas supprimer votre propre compte.': {
    en: 'You cannot delete your own account.',
    dyu: 'I tɛ se ka i ka konto yɛrɛ too.', bci: 'A tɛ se wɔ konto yɛɛ wɛn.',
  },
  'Authentification requise.': {
    en: 'Authentication required.', dyu: 'Don ka kan.', bci: 'An don kɛ.',
  },
  'Accès refusé.': { en: 'Access denied.', dyu: 'Don balilen.', bci: 'Don yili.' },
};

export function localizeError(message: string, lang: Lang): string {
  if (lang === 'fr') return message;
  return errors[message]?.[lang] ?? message;
}
