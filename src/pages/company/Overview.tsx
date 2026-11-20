import { Link } from 'react-router-dom';
import { BusFront, CarFront, CircleDollarSign, Ticket, UserCog } from 'lucide-react';
import { companyApi } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatDate, formatMoney } from '../../lib/format';
import { ErrorView, Loading, PageHeader, StatCard, StatusBadge } from '../../lib/ui';
import { GridCards } from '../../components/AppShell';
import type { Ticket as TicketType, Trip } from '../../types';

export function CompanyOverviewPage() {
  const { companySession } = useApp();
  const token = companySession!.token;
  const stats = useAsync(() => companyApi.stats(token), [token], { activeTrips: 0, ticketsSold: 0, drivers: 0, vehicles: 0, revenue: 0, recentSales: [] as TicketType[] });
  const trips = useAsync(() => companyApi.trips(token), [token], { trips: [] as Trip[] });

  usePolling(() => {
    void stats.reload();
    void trips.reload();
  }, 15000);

  if (stats.loading) return <Loading label="Chargement de l'aperçu…" />;
  if (stats.error) return <ErrorView message={stats.error} retry={() => void stats.reload()} />;

  const s = stats.data;
  const upcoming = trips.data.trips
    .filter((t) => t.status === 'scheduled' || t.status === 'boarding')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Bonjour ${companySession!.user.companyName || companySession!.user.firstName} 👋`}
        subtitle="Voici l'activité de votre compagnie."
        actions={<Link className="btn btn-primary btn-sm" to="/company/trips">Nouveau trajet</Link>}
      />
      <GridCards>
        <StatCard icon={BusFront} label="Trajets actifs" value={s.activeTrips ?? 0} tone="primary" />
        <StatCard icon={Ticket} label="Billets vendus" value={s.ticketsSold ?? 0} tone="success" />
        <StatCard icon={UserCog} label="Chauffeurs" value={s.drivers ?? 0} tone="warning" />
        <StatCard icon={CarFront} label="Véhicules" value={s.vehicles ?? 0} tone="danger" />
      </GridCards>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 18 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>Dernières ventes</strong>
            <Link className="btn btn-ghost btn-sm" to="/company/counter">Guichet →</Link>
          </div>
          {(s.recentSales || []).length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Aucune vente pour l'instant.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Code</th><th>Passager</th><th>Montant</th></tr></thead>
                <tbody>
                  {s.recentSales!.slice(0, 6).map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.code}</td>
                      <td>{t.passengerName || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{formatMoney(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>Prochains départs</strong>
            <Link className="btn btn-ghost btn-sm" to="/company/trips">Voir tout →</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Aucun trajet à venir.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {upcoming.map((t) => (
                <Link key={t.id} to={`/company/trips?id=${t.id}`} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', padding: '10px 12', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }}>
                  <span>
                    <strong>{t.depart} → {t.arrivee}</strong>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>{formatDate(t.date)} · {t.time}</span>
                  </span>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="stat-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><CircleDollarSign size={21} /></span>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Revenu total estimé</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(s.revenue ?? 0)}</div>
        </div>
      </div>
    </>
  );
}
