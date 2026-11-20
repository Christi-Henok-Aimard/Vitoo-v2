import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '../api';
import {
  applyTheme,
  clearSession,
  getLang,
  getTheme,
  readCompanySession,
  readDriverSession,
  readUserSession,
  SESSION_EVENT,
  setLang,
  setTheme,
  updateCompanySessionUser,
  updateUserSessionUser,
  writeCompanySession,
  writeDriverSession,
  writeUserSession,
  type DriverSession,
  type UserSession,
} from '../session';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextValue {
  userSession: UserSession | null;
  companySession: UserSession | null;
  driverSession: DriverSession | null;
  ready: boolean;
  setUserSession: (s: UserSession) => void;
  setCompanySession: (s: UserSession) => void;
  setDriverSession: (s: DriverSession) => void;
  logoutUser: () => void;
  logoutCompany: () => void;
  logoutDriver: () => void;
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
  const [driverSession, setDriverState] = useState<DriverSession | null>(() => readDriverSession());
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => getTheme());
  const [lang, setLangState] = useState<'fr' | 'en'>(() => getLang());

  const refresh = useCallback(() => {
    setUserState(readUserSession());
    setCompanyState(readCompanySession());
    setDriverState(readDriverSession());
  }, []);

  // Validation des sessions au montage
  useEffect(() => {
    let active = true;
    async function validate() {
      const tasks: Promise<unknown>[] = [];
      const us = readUserSession();
      const cs = readCompanySession();
      const ds = readDriverSession();
      if (us) {
        tasks.push(
          auth.me(us.token).then(({ user }) => {
            if (active) updateUserSessionUser(user);
          }).catch(() => undefined),
        );
      }
      if (cs) {
        tasks.push(
          auth.companyMe(cs.token).then(({ user }) => {
            if (active) updateCompanySessionUser(user);
          }).catch(() => undefined),
        );
      }
      if (ds) {
        tasks.push(
          auth.driverMe(ds.token).then(({ driver }) => {
            if (active) writeDriverSession({ ...ds, driver });
          }).catch(() => undefined),
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
      driverSession,
      ready,
      setUserSession: (s) => writeUserSession(s),
      setCompanySession: (s) => writeCompanySession(s),
      setDriverSession: (s) => writeDriverSession(s),
      logoutUser: () => clearSession('user'),
      logoutCompany: () => clearSession('company'),
      logoutDriver: () => clearSession('driver'),
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
    [userSession, companySession, driverSession, ready, toasts, toast, dismissToast, theme, lang],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans AppProvider');
  return ctx;
}
