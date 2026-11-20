// Gestion des sessions localStorage. Plus de session chauffeur séparée :
// l'espace chauffeur vit dans vitoo_session via `driverSpace`.
import type { DriverSpace, User } from './types';

export type Space = 'user' | 'company';

const KEYS: Record<Space, string> = {
  user: 'vitoo_session', // passager, admin et chauffeur via driverSpace
  company: 'vitoo_company_session',
};

export const SESSION_EVENT = 'vitoo:session-changed';

export interface UserSession {
  token: string;
  user: User;
  driverSpace?: DriverSpace | null;
}

export interface AuthLikeResult {
  user: User;
  token: string;
  driverSpace?: DriverSpace | null;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Construit une session à partir d'une réponse d'auth (champs normalisés). */
export function makeUserSession(result: AuthLikeResult): UserSession {
  const space = result.driverSpace ?? result.user.driverSpace ?? null;
  return {
    token: result.token,
    user: { ...result.user, driverSpace: space },
    driverSpace: space,
  };
}

export function readUserSession(): UserSession | null {
  const s = safeParse<UserSession>(localStorage.getItem(KEYS.user));
  if (!s || !s.token || !s.user) return null;
  const space = s.driverSpace ?? s.user.driverSpace ?? null;
  return { ...s, user: { ...s.user, driverSpace: space }, driverSpace: space };
}

export function readCompanySession(): UserSession | null {
  const s = safeParse<UserSession>(localStorage.getItem(KEYS.company));
  return s && s.token && s.user ? s : null;
}

export function writeUserSession(s: UserSession): void {
  localStorage.setItem(KEYS.user, JSON.stringify(s));
  notify();
}

export function writeCompanySession(s: UserSession): void {
  localStorage.setItem(KEYS.company, JSON.stringify(s));
  notify();
}

export function updateUserSessionUser(user: User): void {
  const s = readUserSession();
  if (s) writeUserSession({ ...s, user, driverSpace: user.driverSpace ?? s.driverSpace });
}

export function updateCompanySessionUser(user: User): void {
  const s = readCompanySession();
  if (s) writeCompanySession({ ...s, user });
}

export function clearSession(space: Space): void {
  localStorage.removeItem(KEYS[space]);
  notify();
}

export function clearAllSessions(): void {
  (Object.keys(KEYS) as Space[]).forEach((k) => localStorage.removeItem(KEYS[k]));
  notify();
}

// Nettoyage d'une ancienne session chauffeur éventuellement présente.
export function removeLegacyDriverSession(): void {
  localStorage.removeItem('vitoo_driver_session');
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EVENT));
}

// Préférences locales
export function getTheme(): 'light' | 'dark' {
  return localStorage.getItem('vitoo_theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem('vitoo_theme', theme);
  applyTheme(theme);
}

export function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function getLang(): 'fr' | 'en' {
  return localStorage.getItem('vitoo_lang') === 'en' ? 'en' : 'fr';
}

export function setLang(lang: 'fr' | 'en'): void {
  localStorage.setItem('vitoo_lang', lang);
}
