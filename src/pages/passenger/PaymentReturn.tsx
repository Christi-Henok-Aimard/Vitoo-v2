import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, Ticket } from 'lucide-react';
import { paymentsApi, errorMessage } from '../../api';
import { TicketCard } from '../../components/TicketCard';
import { Empty, Notice, Spinner } from '../../lib/ui';
import type { Booking, Payment, Ticket as TicketType, Trip } from '../../types';

export function PaymentReturnPage() {
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
      setError('Identifiant de paiement manquant.');
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
    return <Empty icon={Ticket} title="Retour de paiement invalide" action={<Link className="btn btn-primary" to="/passenger">Retour à l'accueil</Link>} />;
  }

  if (!done) {
    return (
      <div className="card card-pad" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <Spinner label="Confirmation de votre paiement…" />
        <p className="muted" style={{ marginTop: 14 }}>Ne fermez pas cette page. Vérification auprès de GeniusPay en cours (tentative {Math.max(1, attempt)}).</p>
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
            <h1 style={{ fontSize: 22, marginTop: 10 }}>Paiement confirmé !</h1>
            <p className="muted">Votre place est réservée. Bon voyage avec Vitoo.</p>
          </div>
          {ticket ? (
            <TicketCard ticket={ticket} trip={trip || booking?.trip} />
          ) : (
            <Notice tone="info">Votre billet est disponible dans « Mes billets ».</Notice>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
            <Link className="btn btn-primary" to="/passenger/tickets">Voir mes billets</Link>
            <Link className="btn" to="/passenger/bookings">Mes réservations</Link>
          </div>
        </>
      ) : (
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <AlertCircle size={44} color={status === 'failed' ? 'var(--danger)' : 'var(--warning)'} />
          <h1 style={{ fontSize: 20, marginTop: 10 }}>Paiement non confirmé</h1>
          <p className="muted">{error || 'Le paiement est toujours en attente ou a échoué. Vérifiez vos réservations dans quelques instants.'}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <Link className="btn btn-primary" to="/passenger/bookings">Mes réservations</Link>
            <Link className="btn" to="/passenger">Nouvelle recherche</Link>
          </div>
        </div>
      )}
    </div>
  );
}
