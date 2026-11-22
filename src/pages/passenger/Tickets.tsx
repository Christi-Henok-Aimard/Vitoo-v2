import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { History, Star, Ticket as TicketIcon } from 'lucide-react';
import { tripsApi } from '../../api';
import { useAsync } from '../../lib/hooks';
import { companyName, formatDate, formatMoney } from '../../lib/format';
import { useApp } from '../../lib/context';
import { Empty, ErrorView, ListSkeleton, PageHeader, StatusBadge } from '../../lib/ui';
import { TicketCard } from '../../components/TicketCard';
import { RatingModal } from '../../components/RatingModal';
import type { Booking } from '../../types';

export function TicketsPage() {
  const { userSession, t } = useApp();
  const token = userSession?.token || '';
  const [params] = useSearchParams();
  const highlight = params.get('ticket') || '';
  const [filter, setFilter] = useState<'all' | 'active' | 'used'>('all');
  const { data, loading, error, reload } = useAsync(() => tripsApi.mine(token), [token], { bookings: [] as Booking[] });
  const withTickets = data.bookings.filter((b) => b.ticket);
  const results = filter === 'all' ? withTickets : withTickets.filter((b) => b.ticket?.status === filter);

  return (
    <>
      <PageHeader title={t('myTickets')} subtitle={t('presentTicket')} />
      {loading ? <ListSkeleton label={t('loading')} rows={3} /> : error ? <ErrorView message={error} retry={() => void reload()} /> : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['all', 'active', 'used'] as const).map((f) => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-secondary' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? t('allTickets') : f === 'active' ? t('active') : t('usedTickets')}
              </button>
            ))}
          </div>
          {results.length === 0 ? (
            <Empty
              icon={TicketIcon}
              title={t('noTickets')}
              text={`${t('book')} · ${t('showQr')}`}
              action={<Link className="btn btn-primary" to="/passenger">{t('search')}</Link>}
            />
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {results.map((b) => (
                <div key={b.id} style={{ outline: highlight && b.ticket?.code === highlight ? '2px solid var(--primary)' : undefined, borderRadius: 14 }}>
                  <TicketCard ticket={b.ticket!} trip={b.trip} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function BookingsPage() {
  const { userSession, t } = useApp();
  const token = userSession?.token || '';
  const { data, loading, error, reload } = useAsync(() => tripsApi.mine(token), [token], { bookings: [] as Booking[] });
  const [ratingTrip, setRatingTrip] = useState<{ id: string; label: string } | null>(null);

  return (
    <>
      <PageHeader title={t('bookings')} subtitle={t('seeAll')} />
      {loading ? <ListSkeleton label={t('loading')} rows={2} /> : error ? <ErrorView message={error} retry={() => void reload()} /> : data.bookings.length === 0 ? (
        <Empty icon={History} title={t('noData')} action={<Link className="btn btn-primary" to="/passenger">{t('search')}</Link>} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>{t('trips')}</th><th>{t('date')}</th><th>{t('amount')}</th><th>{t('paymentMethods')}</th><th>{t('status')}</th><th></th></tr></thead>
            <tbody>
              {data.bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{b.trip?.depart || '?'} → {b.trip?.arrivee || '?'}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{b.trip ? companyName(b.trip) : ''}</div>
                  </td>
                  <td>{formatDate(b.trip?.date)}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(b.amount)}</td>
                  <td>{b.paymentMethod}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {b.ticket && <Link className="btn btn-sm" to={`/passenger/tickets?ticket=${encodeURIComponent(b.ticket.code)}`}>{t('ticket')}</Link>}
                      {b.trip?.status === 'completed' && (
                        <button className="btn btn-sm" onClick={() => setRatingTrip({ id: b.tripId, label: `${b.trip?.depart} → ${b.trip?.arrivee}` })}>
                          <Star size={13} /> {t('rateTrip')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ratingTrip && <RatingModal tripId={ratingTrip.id} tripLabel={ratingTrip.label} onClose={() => setRatingTrip(null)} />}
    </>
  );
}
