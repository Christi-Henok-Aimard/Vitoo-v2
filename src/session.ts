// Gestion des sessions localStorage (une session par espace)
import type { Driver, User } from './types';

export type Space = 'user' | 'company' | 'driver';

const KEYS: Record<Space, string> = {
  user: 'vitoo_session', // passager ET admin
  company: 'vitoo_company_session',
  driver: 'vitoo_driver_session',
};

export const SESSION_EVENT = 'vitoo:session-changed';

export interface UserSession {
  token: string;
  user: User;
}

export interface DriverSession {
  token: string;
  driver: Driver;
}

export type AnySession = UserSession | DriverSession;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readUserSession(): UserSession | null {
  const s = safeParse<UserSession>(localStorage.getItem(KEYS.user));
  return s && s.token && s.user ? s : null;
}

export function readCompanySession(): UserSession | null {
  const s = safeParse<UserSession>(localStorage.getItem(KEYS.company));
  return s && s.token && s.user ? s : null;
}

export function readDriverSession(): DriverSession | null {
  const s = safeParse<DriverSession>(localStorage.getItem(KEYS.driver));
  return s && s.token && s.driver ? s : null;
}

export function writeUserSession(s: UserSession): void {
  localStorage.setItem(KEYS.user, JSON.stringify(s));
  notify();
}

export function writeCompanySession(s: UserSession): void {
  localStorage.setItem(KEYS.company, JSON.stringify(s));
  notify();
}

export function writeDriverSession(s: DriverSession): void {
  localStorage.setItem(KEYS.driver, JSON.stringify(s));
  notify();
}

export function updateUserSessionUser(user: User): void {
  const s = readUserSession();
  if (s) writeUserSession({ ...s, user });
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
