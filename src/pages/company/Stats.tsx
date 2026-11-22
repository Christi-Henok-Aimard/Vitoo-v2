import { BarChart3, CircleDollarSign, Ticket } from 'lucide-react';
import { companyApi } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatMoney } from '../../lib/format';
import { ErrorView, Loading, PageHeader, StatCard } from '../../lib/ui';
import { GridCards } from '../../components/AppShell';
import type { CompanyStats, Ticket as TicketType } from '../../types';

type MethodRow = { method: string; count: number; amount: number };

function byMethod(tickets: TicketType[], unspecified: string): MethodRow[] {
  const map = new Map<string, MethodRow>();
  tickets.forEach((t) => {
    const key = t.paymentMethod || unspecified;
    const row = map.get(key) || { method: key, count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(t.amount || 0);
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function CompanyStatsPage() {
  const { companySession, t } = useApp();
  const token = companySession!.token;
  const stats = useAsync(() => companyApi.stats(token), [token], {} as CompanyStats);
  const tickets = useAsync(() => companyApi.tickets(token), [token], { tickets: [] as TicketType[] });

  usePolling(() => { void stats.reload(); void tickets.reload(); }, 15000);

  if (stats.loading) return <Loading label={t('loading')} />;
  if (stats.error) return <ErrorView message={stats.error} retry={() => void stats.reload()} />;

  const s = stats.data;
  const rows = byMethod(tickets.data.tickets, t('none'));
  const total = rows.reduce((sum, r) => sum + r.amount, 0) || Number(s.revenue || 0);

  return (
    <>
      <PageHeader title={t('stats')} subtitle={t('stats')} />
      <GridCards>
        <StatCard icon={CircleDollarSign} label={t('revenue')} value={formatMoney(total)} tone="success" />
        <StatCard icon={Ticket} label={t('soldTickets')} value={s.ticketsSold ?? tickets.data.tickets.length} tone="primary" />
        <StatCard icon={BarChart3} label={t('bookings')} value={s.bookings ?? 0} tone="warning" />
      </GridCards>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 18 }}>
        <div className="card card-pad">
          <strong>{t('paymentMethods')}</strong>
          <div className="divider" />
          {rows.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{t('noData')}</div> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('paymentMethods')}</th><th>{t('totalTickets')}</th><th>{t('amount')}</th><th>{t('total')}</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.method}>
                      <td style={{ fontWeight: 700 }}>{r.method}</td>
                      <td>{r.count}</td>
                      <td>{formatMoney(r.amount)}</td>
                      <td className="muted">{total ? `${Math.round((r.amount / total) * 100)} %` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <strong>{t('stats')}</strong>
          <div className="divider" />
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr><td>{t('activeTrips')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{s.activeTrips ?? 0}</td></tr>
                <tr><td>{t('drivers')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{s.drivers ?? 0}</td></tr>
                <tr><td>{t('vehiclesCount')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{s.vehicles ?? 0}</td></tr>
                <tr><td>{t('revenue')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{formatMoney(s.revenue ?? 0)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
