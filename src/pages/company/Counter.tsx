import { useState, type FormEvent } from 'react';
import { Printer, QrCode, Ticket as TicketIcon } from 'lucide-react';
import { companyApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatDate, formatMoney } from '../../lib/format';
import { Empty, ErrorView, Field, Loading, Notice, PageHeader } from '../../lib/ui';
import { TicketCard } from '../../components/TicketCard';
import type { Ticket, Trip } from '../../types';

export function CompanyCounterPage() {
  const { companySession, toast, t } = useApp();
  const token = companySession!.token;
  const trips = useAsync(() => companyApi.trips(token), [token], { trips: [] as Trip[] });
  const tickets = useAsync(() => companyApi.tickets(token), [token], { tickets: [] as Ticket[] });
  const [tripId, setTripId] = useState('');
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sold, setSold] = useState<Ticket | null>(null);
  const [view, setView] = useState<Ticket | null>(null);

  usePolling(() => void tickets.reload(), 15000);

  const selectedTrip = trips.data.trips.find((t) => t.id === tripId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await companyApi.sellTicket(token, {
        tripId,
        passengerName: passengerName.trim(),
        passengerPhone: passengerPhone.trim(),
        seatNumber: seatNumber.trim() || undefined,
        amount: amount ? Number(amount) : undefined,
      });
      toast(t('sellTicket'), 'success');
      setSold(res.ticket);
      setPassengerName('');
      setPassengerPhone('');
      setSeatNumber('');
      setAmount('');
      await tickets.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t('counter')} subtitle={t('sellTicket')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <strong style={{ fontSize: 16 }}>{t('sellTicket')}</strong>
          <div className="divider" />
          {error && <div style={{ marginBottom: 12 }}><Notice tone="error">{error}</Notice></div>}
          {trips.loading ? <Loading /> : trips.data.trips.length === 0 ? (
            <Empty icon={TicketIcon} title={t('noTripsAvailable')} text={t('newTrip')} />
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <Field label={t('trips')} required>
                <select className="select" value={tripId} onChange={(e) => { setTripId(e.target.value); const t = trips.data.trips.find((x) => x.id === e.target.value); if (t) setAmount(String(t.price)); }} required>
                  <option value="">{t('selectTrip')}</option>
                  {trips.data.trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.depart} → {trip.arrivee} · {formatDate(trip.date)} {trip.time}</option>)}
                </select>
              </Field>
              <Field label={t('passenger')} required><input className="input" value={passengerName} onChange={(e) => setPassengerName(e.target.value)} required /></Field>
              <Field label={t('phone')} required><input className="input" inputMode="tel" value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} required /></Field>
              <div className="field-row">
                <Field label={t('seats')}><input className="input" value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} placeholder="A12" /></Field>
                <Field label={`${t('amount')} (FCFA)`}><input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              </div>
              {selectedTrip && <div className="notice notice-info" style={{ marginBottom: 12 }}>{t('seats')} {t('available')} : <strong>{selectedTrip.availableSeats}</strong></div>}
              <button className="btn btn-primary btn-block" type="submit" disabled={busy || !tripId}>
                {busy ? t('loading') : <><QrCode size={16} /> {t('sellTicket')}</>}
              </button>
            </form>
          )}
        </div>

        <div className="card card-pad">
          <strong style={{ fontSize: 16 }}>{t('recentSales')}</strong>
          <div className="divider" />
          {tickets.loading ? <Loading /> : tickets.error ? <ErrorView message={tickets.error} retry={() => void tickets.reload()} /> : tickets.data.tickets.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>{t('noData')}</div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>{t('code')}</th><th>{t('passenger')}</th><th>{t('amount')}</th><th>{t('status')}</th><th></th></tr></thead>
                <tbody>
                  {tickets.data.tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{ticket.code}</td>
                      <td>{ticket.passengerName || '—'}</td>
                      <td>{formatMoney(ticket.amount)}</td>
                      <td><span className="badge">{ticket.status}</span></td>
                      <td><button className="btn btn-ghost btn-icon btn-sm" title={t('details')} onClick={() => setView(ticket)}><Printer size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(sold || view) && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 17 }}>{sold ? t('ticket') : t('tripDetail')}</h2>
            <button className="btn btn-sm" onClick={() => { setSold(null); setView(null); }}>{t('close')}</button>
          </div>
          <TicketCard ticket={(sold || view)!} trip={trips.data.trips.find((t) => t.id === (sold || view)!.tripId)} />
        </div>
      )}
    </>
  );
}
