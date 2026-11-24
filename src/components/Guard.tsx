import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../lib/context';
import { Loading } from '../lib/ui';

export type GuardSpace = 'passenger' | 'company' | 'driver' | 'admin';

export function Guard({ space, children }: { space: GuardSpace; children: ReactNode }) {
  const { ready, userSession, companySession } = useApp();
  if (!ready) return <Loading />;

  if (space === 'passenger' || space === 'admin') {
    if (!userSession) return <Navigate to={space === 'admin' ? '/admin' : '/passenger/login'} replace />;
    const isAdmin = userSession.user.role === 'admin';
    if (space === 'admin' && !isAdmin) return <Navigate to="/admin" replace />;
    // Un compte non vérifié doit saisir son code avant d'accéder à son espace.
    if (!userSession.user.verified) {
      const q = new URLSearchParams();
      if (userSession.user.phone) q.set('phone', userSession.user.phone);
      const qs = q.toString();
      return <Navigate to={`/verify${qs ? `?${qs}` : ''}`} replace />;
    }
    // Un admin peut aussi ouvrir son espace passager : pas de redirection forcée.
    return <>{children}</>;
  }
  if (space === 'company') {
    if (!companySession || companySession.user.role !== 'company') return <Navigate to="/company" replace />;
    if (!companySession.user.verified) {
      const q = new URLSearchParams();
      q.set('email', companySession.user.email || companySession.user.phone || '');
      return <Navigate to={`/company/verify?${q.toString()}`} replace />;
    }
    return <>{children}</>;
  }
  // L'espace chauffeur est exposé via driverSpace dans la session passager.
  if (!userSession?.driverSpace) return <Navigate to="/passenger/profile" replace />;
  return <>{children}</>;
}
