import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CalendarDays, MapPin, Search as SearchIcon, SlidersHorizontal, Star, Ticket, Users } from 'lucide-react';
import { tripsApi } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync } from '../../lib/hooks';
import { companyName, formatDate, formatMoney, todayInput, tripStops } from '../../lib/format';
import { Empty, ErrorView, Field, ListSkeleton, PageHeader, StatusBadge } from '../../lib/ui';
import { kbrAppearance, type KbrHandle } from '../../components/kbr';
import type { Trip } from '../../types';

export function TripCard({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{companyName(trip)}</span>
          <StatusBadge status={trip.status} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 18 }}>{formatMoney(trip.price)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{trip.depart}</div>
          <div className="muted" style={{ fontSize: 12 }}>{trip.time}</div>
        </div>
        <div style={{ flex: 1, borderTop: '2px dotted var(--border)', position: 'relative' }}>
          <span style={{ position: 'absolute', right: 0, top: -7, color: 'var(--primary)' }}>→</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{trip.arrivee}</div>
          <div className="muted" style={{ fontSize: 12 }}>{trip.duration ? `~ ${trip.duration}` : 'Trajet direct'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }} className="muted">
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><CalendarDays size={14} /> {formatDate(trip.date)}</span>
        {trip.station && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><MapPin size={14} /> Gare de {trip.station}</span>}
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Users size={14} /> {trip.availableSeats} places</span>
        {trip.driverName && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Star size={14} fill="#f59e0b" color="#f59e0b" /> {trip.driverName}{trip.driverRating ? ` · ${Number(trip.driverRating).toFixed(1)}` : ''}</span>}
        {trip.vehiclePlate && <span className="chip">{trip.vehiclePlate}</span>}
      </div>
      {tripStops(trip).length > 0 && (
        <div className="muted" style={{ fontSize: 12 }}>Escales : {tripStops(trip).join(' · ')}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link className="btn btn-secondary btn-sm" to={`/passenger/trips/${trip.id}`}>Détails</Link>
        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/passenger/book/${trip.id}`)} disabled={trip.availableSeats <= 0 || trip.status === 'completed' || trip.status === 'cancelled'}>
          <Ticket size={14} /> {trip.availableSeats <= 0 ? 'Complet' : 'Réserver'}
        </button>
      </div>
    </div>
  );
}

/** Tri des résultats via le composant KBR `select-menu`. */
function SortSelect({ value, onChange, appearance }: { value: 'date' | 'price'; onChange: (value: 'date' | 'price') => void; appearance: 'light' | 'dark' }) {
  const ref = useRef<KbrHandle | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChanged = (event: Event) => {
      const selected = (event as CustomEvent<{ value?: string }>).detail?.value;
      onChange(selected === 'Prix croissant' ? 'price' : 'date');
    };
    el.addEventListener('change', onChanged);
    return () => el.removeEventListener('change', onChanged);
  }, [onChange]);
  return (
    <select-menu
      ref={ref}
      label="Trier par"
      options="Date de départ,Prix croissant"
      selected={value === 'price' ? 'Prix croissant' : 'Date de départ'}
      appearance={appearance}
    />
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const { theme } = useApp();
  const [depart, setDepart] = useState('');
  const [arrivee, setArrivee] = useState('');
  const [date, setDate] = useState('');
  const [company, setCompany] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<'date' | 'price'>('date');
  const [searched, setSearched] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const cities = useAsync(() => tripsApi.cities(), [], { cities: [] as string[] });
  const companies = useAsync(() => tripsApi.companies(), [], { companies: [] as Array<string | { name?: string; companyName?: string }> });
  const trips = useAsync(() => tripsApi.list({}), [], { trips: [] as Trip[] });

  const doSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearched(true);
    void tripsApi
      .list({ depart: depart.trim() || undefined, arrivee: arrivee.trim() || undefined, date: date || undefined, company: company || undefined })
      .then((res) => trips.setData(res))
      .catch(() => undefined);
  };

  let results = [...trips.data.trips];
  if (maxPrice) results = results.filter((t) => t.price <= Number(maxPrice));
  if (sort === 'price') results.sort((a, b) => a.price - b.price);
  else results.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const companyList = companies.data.companies.map((c) => (typeof c === 'string' ? c : c.companyName || c.name || '')).filter(Boolean);

  return (
    <>
      <PageHeader title="Où voyagez-vous ?" subtitle="Trouvez le car qui vous emmène, au meilleur prix." />
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <form onSubmit={doSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
            <Field label="Départ">
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" list="vitoo-cities" placeholder="Abidjan" value={depart} onChange={(e) => setDepart(e.target.value)} />
              </div>
            </Field>
            <Field label="Arrivée">
              <input className="input" list="vitoo-cities" placeholder="Bouaké" value={arrivee} onChange={(e) => setArrivee(e.target.value)} />
            </Field>
            <Field label="Date">
              <input className="input" type="date" min={todayInput()} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <button className="btn btn-ghost btn-icon" type="button" onClick={() => { setDepart(arrivee); setArrivee(depart); }} title="Inverser" style={{ marginBottom: 14 }}>
              <ArrowLeftRight size={17} />
            </button>
            <button className="btn btn-primary" type="submit"><SearchIcon size={16} /> Rechercher</button>
          </div>
          <datalist id="vitoo-cities">{cities.data.cities.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="vitoo-companies">{companyList.map((c) => <option key={c} value={c} />)}</datalist>
          <div style={{ marginTop: 6 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setFiltersOpen((v) => !v)}>
              <SlidersHorizontal size={14} /> Filtres
            </button>
          </div>
          {filtersOpen && (
            <div className="field-row" style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <Field label="Compagnie">
                <input className="input" list="vitoo-companies" placeholder="Toutes" value={company} onChange={(e) => setCompany(e.target.value)} />
              </Field>
              <Field label="Prix maximum (FCFA)">
                <input className="input" inputMode="numeric" placeholder="5000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </Field>
              <Field label="Trier par">
                <SortSelect value={sort} onChange={setSort} appearance={kbrAppearance(theme)} />
              </Field>
            </div>
          )}
        </form>
      </div>

      {trips.loading ? (
        <ListSkeleton label="Recherche de trajets…" rows={3} />
      ) : trips.error ? (
        <ErrorView message={trips.error} retry={() => void trips.reload()} />
      ) : results.length === 0 ? (
        <Empty icon={SearchIcon} title={searched ? 'Aucun trajet trouvé' : 'Aucun trajet disponible'} text="Essayez d'autres villes ou une autre date." />
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>{results.length} trajet{results.length > 1 ? 's' : ''} disponible{results.length > 1 ? 's' : ''}</div>
          <div style={{ display: 'grid', gap: 12 }}>{results.map((t) => <TripCard key={t.id} trip={t} />)}</div>
        </>
      )}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/passenger/tickets')}>Voir mes billets →</button>
      </div>
    </>
  );
}
