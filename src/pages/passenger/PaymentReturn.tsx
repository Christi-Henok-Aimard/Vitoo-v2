import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, Ticket } from 'lucide-react';
import { paymentsApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { TicketCard } from '../../components/TicketCard';
import { Empty, Notice, Spinner } from '../../lib/ui';
import type { Booking, Payment, Ticket as TicketType, Trip } from '../../types';

export function PaymentReturnPage() {
  const { t } = useApp();
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId') || '';
  const [status, setStatus] = useState<Payment['status'] | ''>('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [ticket, setTicket] = useState<TicketType | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!paymentId) {
      setError(t('error'));
      setDone(true);
      return;
    }
    let active = true;
    let timer = 0;
    let tries = 0;

    const tick = async () => {
      try {
        const res = await paymentsApi.confirm(paymentId);
        if (!active) return;
        setStatus(res.status);
        if (res.booking) {
          setBooking(res.booking);
          if (res.booking.trip) setTrip(res.booking.trip);
        }
        if (res.ticket) setTicket(res.ticket);
        if (res.status === 'paid' || res.status === 'failed') {
          setDone(true);
          if (res.status === 'paid' && !res.ticket) {
            try {
              const detail = await paymentsApi.get(paymentId);
              if (active && detail.booking?.ticket) setTicket(detail.booking.ticket);
              if (active && detail.booking?.trip) setTrip(detail.booking.trip);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      } catch (err) {
        if (!active) return;
        setError(errorMessage(err));
      }
      tries += 1;
      setAttempt(tries);
      if (active && tries < 40) timer = window.setTimeout(() => void tick(), 2000);
      else if (active) setDone(true);
    };

    void tick();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  if (!paymentId) {
    return <Empty icon={Ticket} title={t('paymentFailed')} action={<Link className="btn btn-primary" to="/passenger">{t('back')}</Link>} />;
  }

  if (!done) {
    return (
      <div className="card card-pad" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <Spinner label={t('paymentChecking')} />
        <p className="muted" style={{ marginTop: 14 }}>{t('closePage')} {t('paymentChecking')} GeniusPay ({Math.max(1, attempt)}).</p>
        <div style={{ marginTop: 16 }}><Clock3 size={30} color="var(--primary)" /></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {status === 'paid' ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <CheckCircle2 size={46} color="var(--success)" />
            <h1 style={{ fontSize: 22, marginTop: 10 }}>{t('paymentConfirmed')}</h1>
            <p className="muted">{t('bookingConfirmed')} Vitoo.</p>
          </div>
          {ticket ? (
            <TicketCard ticket={ticket} trip={trip || booking?.trip} />
          ) : (
            <Notice tone="info">{t('ticketReady')} — {t('seeMyTickets')}.</Notice>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
            <Link className="btn btn-primary" to="/passenger/tickets">{t('seeMyTickets')}</Link>
            <Link className="btn" to="/passenger/bookings">{t('bookings')}</Link>
          </div>
        </>
      ) : (
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <AlertCircle size={44} color={status === 'failed' ? 'var(--danger)' : 'var(--warning)'} />
          <h1 style={{ fontSize: 20, marginTop: 10 }}>{t('paymentFailed')}</h1>
          <p className="muted">{error || t('paymentFailed')}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <Link className="btn btn-primary" to="/passenger/bookings">{t('bookings')}</Link>
            <Link className="btn" to="/passenger">{t('search')}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
