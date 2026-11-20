import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CarFront, Clock, MapPin, Star, Ticket, UserRound } from 'lucide-react';
import { tripsApi } from '../../api';
import { useAsync } from '../../lib/hooks';
import { normalizeMethods } from '../../paymentMethods';
import { companyName, formatDate, formatMoney, tripStops } from '../../lib/format';
import { Empty, ErrorView, Loading, StatusBadge } from '../../lib/ui';
import type { Trip } from '../../types';

export function TripDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => tripsApi.get(id), [id], { trip: null as Trip | null });
  const trip = data.trip;

  if (loading) return <Loading label="Chargement du trajet…" />;
  if (error) return <ErrorView message={error} retry={() => void reload()} />;
  if (!trip) return <Empty icon={Ticket} title="Trajet introuvable" action={<Link className="btn btn-primary" to="/passenger">Retour à la recherche</Link>} />;

  const stops = tripStops(trip);
  const methods = normalizeMethods(trip.paymentMethods);

  return (
    <>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => navigate(-1)}><ArrowLeft size={15} /> Retour</button>
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--primary)', fontWeight: 800 }}>{companyName(trip)}</div>
            <h1 style={{ fontSize: 24, marginTop: 4 }}>{trip.depart} → {trip.arrivee}</h1>
          </div>
          <StatusBadge status={trip.status} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 22 }}>
          <div className="surface-2" style={{ padding: 14, borderRadius: 12 }}>
            <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><CalendarDays size={13} /> Date</div>
            <strong>{formatDate(trip.date, true)}</strong>
          </div>
          <div className="surface-2" style={{ padding: 14, borderRadius: 12 }}>
            <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><Clock size={13} /> Heure de départ</div>
            <strong>{trip.time}</strong>
            {trip.duration && <div className="muted" style={{ fontSize: 12 }}>Durée : {trip.duration}</div>}
          </div>
          <div className="surface-2" style={{ padding: 14, borderRadius: 12 }}>
            <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={13} /> Station</div>
            <strong>{trip.station ? `Gare de ${trip.station}` : 'À confirmer'}</strong>
          </div>
          <div className="surface-2" style={{ padding: 14, borderRadius: 12 }}>
            <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><Ticket size={13} /> Places disponibles</div>
            <strong>{trip.availableSeats}</strong>
          </div>
        </div>

        {stops.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="label">Escales prévues</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stops.map((s, i) => <span key={`${s}-${i}`} className="chip"><MapPin size={12} /> {s}</span>)}
            </div>
          </div>
        )}

        <div className="divider" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="stat-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><UserRound size={19} /></span>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>Chauffeur</div>
              <strong>{trip.driverName || 'Sera assigné'}</strong>
              {trip.driverRating != null && <div style={{ fontSize: 12, color: '#f59e0b', display: 'flex', gap: 4, alignItems: 'center' }}><Star size={12} fill="#f59e0b" /> {Number(trip.driverRating).toFixed(1)}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="stat-icon" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}><CarFront size={19} /></span>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>Véhicule</div>
              <strong>{trip.vehiclePlate || 'À confirmer'}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="stat-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><Ticket size={19} /></span>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>Paiements acceptés</div>
              <strong style={{ fontSize: 13 }}>{methods.length ? methods.join(', ') : 'Espèces'}</strong>
            </div>
          </div>
        </div>

        <div className="divider" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Prix par place</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{formatMoney(trip.price)}</div>
          </div>
          <button
            className="btn btn-primary"
            disabled={trip.availableSeats <= 0 || trip.status === 'completed' || trip.status === 'cancelled'}
            onClick={() => navigate(`/passenger/book/${trip.id}`)}
          >
            <Ticket size={16} /> Réserver ce trajet
          </button>
        </div>
      </div>
    </>
  );
}
