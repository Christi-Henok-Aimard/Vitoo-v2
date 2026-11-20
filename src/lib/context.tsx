import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, driverApi } from '../api';
import {
  applyTheme,
  clearSession,
  getLang,
  getTheme,
  makeUserSession,
  readCompanySession,
  readUserSession,
  removeLegacyDriverSession,
  SESSION_EVENT,
  setLang,
  setTheme,
  updateCompanySessionUser,
  writeCompanySession,
  writeUserSession,
  type UserSession,
} from '../session';
import type { Driver } from '../types';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextValue {
  userSession: UserSession | null;
  companySession: UserSession | null;
  ready: boolean;
  setUserSession: (s: UserSession) => void;
  setCompanySession: (s: UserSession) => void;
  logoutUser: () => void;
  logoutCompany: () => void;
  driverInfo: Driver | null;
  refreshDriverInfo: () => Promise<void>;
  toasts: ToastItem[];
  toast: (message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: number) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  lang: 'fr' | 'en';
  toggleLang: () => void;
  tr: (fr: string, en: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastId = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [userSession, setUserState] = useState<UserSession | null>(() => readUserSession());
  const [companySession, setCompanyState] = useState<UserSession | null>(() => readCompanySession());
  const [driverInfo, setDriverInfo] = useState<Driver | null>(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => getTheme());
  const [lang, setLangState] = useState<'fr' | 'en'>(() => getLang());

  const refresh = useCallback(() => {
    setUserState(readUserSession());
    setCompanyState(readCompanySession());
  }, []);

  const refreshDriverInfo = useCallback(async () => {
    const session = readUserSession();
    if (!session?.driverSpace) {
      setDriverInfo(null);
      return;
    }
    try {
      const result = await driverApi.me(session.token);
      setDriverInfo(result.driver);
    } catch {
      setDriverInfo(null);
    }
  }, []);

  // Validation des sessions au montage + nettoyage de l'ancienne session chauffeur.
  useEffect(() => {
    let active = true;
    removeLegacyDriverSession();
    async function validate() {
      const tasks: Promise<unknown>[] = [];
      const us = readUserSession();
      const cs = readCompanySession();
      if (us) {
        tasks.push(
          auth
            .me(us.token)
            .then((res) => {
              if (active) {
                writeUserSession(makeUserSession({ ...res, driverSpace: res.driverSpace ?? us.driverSpace }));
              }
            })
            .catch(() => undefined),
        );
      }
      if (cs) {
        tasks.push(
          auth.companyMe(cs.token)
            .then(({ user }) => {
              if (active) updateCompanySessionUser(user);
            })
            .catch(() => undefined),
        );
      }
      await Promise.allSettled(tasks);
      if (active) {
        refresh();
        setReady(true);
      }
    }
    void validate();
    window.addEventListener(SESSION_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(SESSION_EVENT, refresh);
    };
  }, [refresh]);

  // Informations chauffeur rafraîchies via GET /api/driver/me (token passager).
  useEffect(() => {
    if (userSession?.driverSpace && userSession.token) void refreshDriverInfo();
    else setDriverInfo(null);
  }, [userSession?.driverSpace?.id, userSession?.token, refreshDriverInfo]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastItem['type'] = 'info') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => dismissToast(id), 3800);
    },
    [dismissToast],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      userSession,
      companySession,
      ready,
      setUserSession: (s) => writeUserSession(s),
      setCompanySession: (s) => writeCompanySession(s),
      logoutUser: () => clearSession('user'),
      logoutCompany: () => clearSession('company'),
      driverInfo,
      refreshDriverInfo,
      toasts,
      toast,
      dismissToast,
      theme,
      toggleTheme: () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        setThemeState(next);
      },
      lang,
      toggleLang: () => {
        const next = lang === 'fr' ? 'en' : 'fr';
        setLang(next);
        setLangState(next);
      },
      tr: (fr, en) => (lang === 'en' ? en : fr),
    }),
    [userSession, companySession, ready, driverInfo, refreshDriverInfo, toasts, toast, dismissToast, theme, lang],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans AppProvider');
  return ctx;
}
