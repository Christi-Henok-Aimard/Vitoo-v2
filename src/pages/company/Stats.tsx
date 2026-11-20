import { BarChart3, CircleDollarSign, Ticket } from 'lucide-react';
import { companyApi } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatMoney } from '../../lib/format';
import { ErrorView, Loading, PageHeader, StatCard } from '../../lib/ui';
import { GridCards } from '../../components/AppShell';
import type { CompanyStats, Ticket as TicketType } from '../../types';

type MethodRow = { method: string; count: number; amount: number };

function byMethod(tickets: TicketType[]): MethodRow[] {
  const map = new Map<string, MethodRow>();
  tickets.forEach((t) => {
    const key = t.paymentMethod || 'Non précisé';
    const row = map.get(key) || { method: key, count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(t.amount || 0);
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function CompanyStatsPage() {
  const { companySession } = useApp();
  const token = companySession!.token;
  const stats = useAsync(() => companyApi.stats(token), [token], {} as CompanyStats);
  const tickets = useAsync(() => companyApi.tickets(token), [token], { tickets: [] as TicketType[] });

  usePolling(() => { void stats.reload(); void tickets.reload(); }, 15000);

  if (stats.loading) return <Loading label="Chargement des statistiques…" />;
  if (stats.error) return <ErrorView message={stats.error} retry={() => void stats.reload()} />;

  const s = stats.data;
  const rows = byMethod(tickets.data.tickets);
  const total = rows.reduce((sum, r) => sum + r.amount, 0) || Number(s.revenue || 0);

  return (
    <>
      <PageHeader title="Statistiques" subtitle="Chiffres clés et répartition des ventes." />
      <GridCards>
        <StatCard icon={CircleDollarSign} label="Chiffre d'affaires" value={formatMoney(total)} tone="success" />
        <StatCard icon={Ticket} label="Billets vendus" value={s.ticketsSold ?? tickets.data.tickets.length} tone="primary" />
        <StatCard icon={BarChart3} label="Réservations" value={s.bookings ?? 0} tone="warning" />
      </GridCards>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 18 }}>
        <div className="card card-pad">
          <strong>Répartition par moyen de paiement</strong>
          <div className="divider" />
          {rows.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Aucune donnée.</div> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Moyen</th><th>Billets</th><th>Montant</th><th>Part</th></tr></thead>
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
          <strong>Autres indicateurs</strong>
          <div className="divider" />
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr><td>Trajets actifs</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{s.activeTrips ?? 0}</td></tr>
                <tr><td>Chauffeurs</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{s.drivers ?? 0}</td></tr>
                <tr><td>Véhicules</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{s.vehicles ?? 0}</td></tr>
                <tr><td>Revenu déclaré</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{formatMoney(s.revenue ?? 0)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
