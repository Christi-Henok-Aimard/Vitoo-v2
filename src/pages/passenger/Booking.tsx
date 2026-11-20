import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, LockKeyhole, Wallet } from 'lucide-react';
import { paymentsApi, tripsApi, errorMessage } from '../../api';
import { useAsync } from '../../lib/hooks';
import { companyName, formatDate, formatMoney } from '../../lib/format';
import { useApp } from '../../lib/context';
import { isOnlineMethod, normalizeMethods } from '../../paymentMethods';
import { Empty, ErrorView, Field, Loading, Notice } from '../../lib/ui';
import type { Trip } from '../../types';

export function BookingPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { userSession, toast } = useApp();
  const { data, loading, error, reload } = useAsync(() => tripsApi.get(id), [id], { trip: null as Trip | null });
  const trip = data.trip;
  const [step, setStep] = useState<1 | 2>(1);
  const [passengerName, setPassengerName] = useState(
    userSession ? `${userSession.user.firstName} ${userSession.user.lastName}` : '',
  );
  const [passengerPhone, setPassengerPhone] = useState(userSession?.user.phone || '');
  const [passengerEmail, setPassengerEmail] = useState(userSession?.user.email || '');
  const [busy, setBusy] = useState(false);
  const [methodError, setMethodError] = useState('');

  if (!userSession) {
    return (
      <Notice tone="info">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>Connectez-vous pour réserver et retrouver votre billet dans « Mes billets ».</span>
          <Link className="btn btn-primary btn-sm" to={`/passenger/login?next=${encodeURIComponent(`/passenger/book/${id}`)}`}>Se connecter</Link>
        </div>
      </Notice>
    );
  }

  if (loading) return <Loading label="Chargement du trajet…" />;
  if (error) return <ErrorView message={error} retry={() => void reload()} />;
  if (!trip) return <Empty icon={CreditCard} title="Trajet introuvable" action={<Link className="btn btn-primary" to="/passenger">Retour</Link>} />;

  // Le passager ne voit que les moyens activés sur ce trajet.
  const methods = normalizeMethods(trip.paymentMethods);

  const infosSubmit = (e: FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const pay = async (method: string) => {
    setBusy(true);
    setMethodError('');
    try {
      if (!isOnlineMethod(method)) {
        const res = await tripsApi.book(id, { passengerName: passengerName.trim(), passengerPhone: passengerPhone.trim(), paymentMethod: method }, userSession.token);
        toast('Réservation confirmée ! Votre billet est prêt.', 'success');
        navigate(`/passenger/tickets?ticket=${encodeURIComponent(res.ticket?.code || '')}`);
      } else {
        const res = await paymentsApi.initiate({
          tripId: id,
          passengerName: passengerName.trim(),
          passengerPhone: passengerPhone.trim(),
          passengerEmail: passengerEmail.trim() || undefined,
          method,
        });
        toast('Redirection vers GeniusPay…', 'info');
        window.location.assign(res.paymentUrl);
      }
    } catch (err) {
      const msg = errorMessage(err);
      setMethodError(msg);
      toast(msg, 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => (step === 2 ? setStep(1) : navigate(-1))}>
        <ArrowLeft size={15} /> {step === 2 ? 'Modifier mes informations' : 'Retour'}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
            <span className="badge badge-primary">Étape {step}/2</span>
            <strong style={{ fontSize: 16 }}>{step === 1 ? 'Vos informations' : 'Moyen de paiement'}</strong>
          </div>

          {step === 1 ? (
            <form onSubmit={infosSubmit}>
              <Field label="Nom et prénom du passager" required>
                <input className="input" value={passengerName} onChange={(e) => setPassengerName(e.target.value)} required placeholder="Nom et prénom" />
              </Field>
              <Field label="Téléphone" required>
                <input className="input" inputMode="tel" value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} required placeholder="+225 07 00 00 00 00" />
              </Field>
              <Field label="E-mail (utile pour le paiement en ligne)">
                <input className="input" type="email" value={passengerEmail} onChange={(e) => setPassengerEmail(e.target.value)} placeholder="votre@email.com" />
              </Field>
              <div className="divider" />
              <button className="btn btn-primary btn-block" type="submit">Continuer vers le paiement</button>
            </form>
          ) : (
            <div>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                Choisissez comment régler votre place. Le paiement en ligne est sécurisé par GeniusPay.
              </p>
              {methodError && <div style={{ marginBottom: 12 }}><Notice tone="error">{methodError}</Notice></div>}
              <div style={{ display: 'grid', gap: 10 }}>
                {methods.map((method) => {
                  const isCash = !isOnlineMethod(method);
                  return (
                    <button
                      key={method}
                      className="btn"
                      disabled={busy}
                      onClick={() => void pay(method)}
                      style={{ justifyContent: 'space-between', padding: '14px 16px', height: 'auto' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isCash ? <Wallet size={18} color="var(--success)" /> : <CreditCard size={18} color="var(--primary)" />}
                        <span style={{ textAlign: 'left' }}>
                          <strong style={{ display: 'block' }}>{method}</strong>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {isCash ? 'Payez au chauffeur lors de l’embarquement' : 'Payez maintenant via GeniusPay'}
                          </span>
                        </span>
                      </span>
                      {busy ? <span className="spinner" /> : <Check size={17} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted)', fontSize: 11 }}>
                <LockKeyhole size={13} /> Vos données sont protégées. Aucun paiement n'est débité sans votre confirmation.
              </div>
            </div>
          )}
        </div>

        <div className="card card-pad" style={{ position: 'sticky', top: 80 }}>
          <div className="label">Récapitulatif</div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{trip.depart} → {trip.arrivee}</div>
          <div className="muted" style={{ fontSize: 12 }}>{companyName(trip)}</div>
          <div className="divider" />
          <div className="muted" style={{ fontSize: 12 }}>Date</div>
          <div style={{ fontWeight: 600 }}>{formatDate(trip.date)} · {trip.time}</div>
          {trip.station && <><div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Gare</div><div style={{ fontWeight: 600 }}>{trip.station}</div></>}
          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted">Prix</span>
            <strong style={{ fontSize: 20, color: 'var(--primary)' }}>{formatMoney(trip.price)}</strong>
          </div>
        </div>
      </div>
    </>
  );
}
