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
    if (space === 'passenger' && isAdmin) return <Navigate to="/admin" replace />;
    return <>{children}</>;
  }
  if (space === 'company') {
    if (!companySession || companySession.user.role !== 'company') return <Navigate to="/company" replace />;
    return <>{children}</>;
  }
  // L'espace chauffeur est exposé via driverSpace dans la session passager.
  if (!userSession?.driverSpace) return <Navigate to="/passenger/profile" replace />;
  return <>{children}</>;
}
