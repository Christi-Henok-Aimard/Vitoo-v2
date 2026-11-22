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
  const { companySession, t } = useApp();
  const token = companySession!.token;
  const stats = useAsync(() => companyApi.stats(token), [token], { activeTrips: 0, ticketsSold: 0, drivers: 0, vehicles: 0, revenue: 0, recentSales: [] as TicketType[] });
  const trips = useAsync(() => companyApi.trips(token), [token], { trips: [] as Trip[] });

  usePolling(() => {
    void stats.reload();
    void trips.reload();
  }, 15000);

  if (stats.loading) return <Loading label={t('loading')} />;
  if (stats.error) return <ErrorView message={stats.error} retry={() => void stats.reload()} />;

  const s = stats.data;
  const upcoming = trips.data.trips
    .filter((trip) => trip.status === 'scheduled' || trip.status === 'boarding')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`${t('helloCompany')} ${companySession!.user.companyName || companySession!.user.firstName} 👋`}
        subtitle={t('companyActivity')}
        actions={<Link className="btn btn-primary btn-sm" to="/company/trips">{t('newTrip')}</Link>}
      />
      <GridCards>
        <StatCard icon={BusFront} label={t('activeTrips')} value={s.activeTrips ?? 0} tone="primary" />
        <StatCard icon={Ticket} label={t('soldTickets')} value={s.ticketsSold ?? 0} tone="success" />
        <StatCard icon={UserCog} label={t('drivers')} value={s.drivers ?? 0} tone="warning" />
        <StatCard icon={CarFront} label={t('vehiclesCount')} value={s.vehicles ?? 0} tone="danger" />
      </GridCards>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 18 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>{t('recentSales')}</strong>
            <Link className="btn btn-ghost btn-sm" to="/company/counter">{t('counter')} →</Link>
          </div>
          {(s.recentSales || []).length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>{t('noData')}</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('code')}</th><th>{t('passenger')}</th><th>{t('amount')}</th></tr></thead>
                <tbody>
                  {s.recentSales!.slice(0, 6).map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{sale.code}</td>
                      <td>{sale.passengerName || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{formatMoney(sale.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>{t('upcomingDepartures')}</strong>
            <Link className="btn btn-ghost btn-sm" to="/company/trips">{t('seeAll')} →</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>{t('noTripsAvailable')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {upcoming.map((trip) => (
                <Link key={trip.id} to={`/company/trips?id=${trip.id}`} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', padding: '10px 12', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }}>
                  <span>
                    <strong>{trip.depart} → {trip.arrivee}</strong>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>{formatDate(trip.date)} · {trip.time}</span>
                  </span>
                  <StatusBadge status={trip.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="stat-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><CircleDollarSign size={21} /></span>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>{t('revenue')}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(s.revenue ?? 0)}</div>
        </div>
      </div>
    </>
  );
}
