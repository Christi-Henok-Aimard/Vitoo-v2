import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Edit2, Eye, Plus, Trash2, Users } from 'lucide-react';
import { companyApi, errorMessage, parseList } from '../../api';
import { PaymentChips } from '../../components/PaymentChips';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { normalizeMethods } from '../../paymentMethods';
import { formatDate, formatMoney, todayInput, tripStops } from '../../lib/format';
import { ConfirmModal, Empty, ErrorView, Field, Loading, Modal, Notice, PageHeader, StatusBadge } from '../../lib/ui';
import type { Driver, Trip, Vehicle } from '../../types';

interface TripForm {
  depart: string;
  arrivee: string;
  station: string;
  date: string;
  time: string;
  duration: string;
  price: string;
  availableSeats: string;
  driverId: string;
  vehicleId: string;
  stops: string;
  paymentMethods: string[];
}

const emptyForm: TripForm = {
  depart: '', arrivee: '', station: '', date: todayInput(), time: '08:00', duration: '',
  price: '', availableSeats: '', driverId: '', vehicleId: '', stops: '', paymentMethods: ['Espèces'],
};

export function CompanyTripsPage() {
  const { companySession, toast } = useApp();
  const token = companySession!.token;
  const { data, loading, error, reload } = useAsync(() => companyApi.trips(token), [token], { trips: [] as Trip[] });
  const drivers = useAsync(() => companyApi.drivers(token), [token], { drivers: [] as Driver[] });
  const vehicles = useAsync(() => companyApi.vehicles(token), [token], { vehicles: [] as Vehicle[] });
  const [editing, setEditing] = useState<Trip | 'new' | null>(null);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [detail, setDetail] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState<Trip | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  usePolling(reload, 15000);

  const set = (k: Exclude<keyof TripForm, 'paymentMethods'>) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  const setMethods = (paymentMethods: string[]) => setForm((prev) => ({ ...prev, paymentMethods }));

  const openEdit = (trip: Trip | 'new') => {
    setFormError('');
    if (trip === 'new') setForm(emptyForm);
    else setForm({
      depart: trip.depart,
      arrivee: trip.arrivee,
      station: trip.station || '',
      date: trip.date ? new Date(trip.date).toISOString().slice(0, 10) : todayInput(),
      time: trip.time,
      duration: trip.duration || '',
      price: String(trip.price),
      availableSeats: String(trip.availableSeats),
      driverId: trip.driverId || '',
      vehicleId: trip.vehicleId || '',
      stops: tripStops(trip).join(', '),
      paymentMethods: normalizeMethods(parseList(trip.paymentMethods)),
    });
    setEditing(trip);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const body = {
      depart: form.depart.trim(),
      arrivee: form.arrivee.trim(),
      station: form.station.trim() || undefined,
      date: form.date,
      time: form.time,
      duration: form.duration.trim() || undefined,
      price: Number(form.price),
      availableSeats: Number(form.availableSeats),
      driverId: form.driverId || null,
      vehicleId: form.vehicleId || null,
      stops: form.stops.split(',').map((s) => s.trim()).filter(Boolean),
      paymentMethods: form.paymentMethods,
    };
    try {
      if (editing === 'new') await companyApi.createTrip(token, body);
      else if (editing) await companyApi.updateTrip(token, editing.id, body);
      toast('Trajet enregistré.', 'success');
      setEditing(null);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await companyApi.deleteTrip(token, deleting.id);
      toast('Trajet supprimé.', 'success');
      setDeleting(null);
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await companyApi.trip(token, id);
      setDetail(res.trip);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Mes trajets"
        subtitle="Créez et gérez vos départs."
        actions={<button className="btn btn-primary btn-sm" onClick={() => openEdit('new')}><Plus size={15} /> Nouveau trajet</button>}
      />
      {loading ? <Loading /> : error ? <ErrorView message={error} retry={() => void reload()} /> : data.trips.length === 0 ? (
        <Empty icon={Users} title="Aucun trajet" text="Créez votre premier trajet pour commencer à vendre des billets." action={<button className="btn btn-primary" onClick={() => openEdit('new')}>Créer un trajet</button>} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Trajet</th><th>Date / Heure</th><th>Prix</th><th>Places</th><th>Chauffeur</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {data.trips.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.depart} → {t.arrivee}</strong>{t.station && <div className="muted" style={{ fontSize: 11 }}>Gare de {t.station}</div>}</td>
                  <td>{formatDate(t.date)} · {t.time}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(t.price)}</td>
                  <td>{t.availableSeats}</td>
                  <td>{t.driverName || drivers.data.drivers.find((d) => d.id === t.driverId)?.user?.firstName || '—'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Détail" onClick={() => void openDetail(t.id)}><Eye size={15} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Modifier" onClick={() => openEdit(t)}><Edit2 size={15} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Supprimer" onClick={() => setDeleting(t)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={editing === 'new' ? 'Nouveau trajet' : 'Modifier le trajet'}
          subtitle="Tous les champs marqués * sont obligatoires."
          onClose={() => setEditing(null)}
          footer={<><button className="btn" onClick={() => setEditing(null)}>Annuler</button><button className="btn btn-primary" type="submit" form="trip-form" disabled={busy}>Enregistrer</button></>}
        >
          {formError && <div style={{ marginBottom: 12 }}><Notice tone="error">{formError}</Notice></div>}
          <form id="trip-form" onSubmit={submit}>
            <div className="field-row">
              <Field label="Départ" required><input className="input" value={form.depart} onChange={set('depart')} required /></Field>
              <Field label="Arrivée" required><input className="input" value={form.arrivee} onChange={set('arrivee')} required /></Field>
            </div>
            <Field label="Gare / station"><input className="input" value={form.station} onChange={set('station')} placeholder="Gare centrale" /></Field>
            <div className="field-row">
              <Field label="Date" required><input className="input" type="date" value={form.date} onChange={set('date')} required /></Field>
              <Field label="Heure" required><input className="input" type="time" value={form.time} onChange={set('time')} required /></Field>
              <Field label="Durée"><input className="input" value={form.duration} onChange={set('duration')} placeholder="4h30" /></Field>
            </div>
            <div className="field-row">
              <Field label="Prix (FCFA)" required><input className="input" inputMode="numeric" type="number" min={0} value={form.price} onChange={set('price')} required /></Field>
              <Field label="Places disponibles" required><input className="input" type="number" min={0} value={form.availableSeats} onChange={set('availableSeats')} required /></Field>
            </div>
            <div className="field-row">
              <Field label="Chauffeur">
                <select className="select" value={form.driverId} onChange={set('driverId')}>
                  <option value="">Non assigné</option>
                  {drivers.data.drivers.map((d) => <option key={d.id} value={d.id}>{d.user?.firstName || d.firstName} {d.user?.lastName || d.lastName}</option>)}
                </select>
              </Field>
              <Field label="Véhicule">
                <select className="select" value={form.vehicleId} onChange={set('vehicleId')}>
                  <option value="">Non assigné</option>
                  {vehicles.data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber}{v.brand ? ` · ${v.brand}` : ''}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Escales" hint="Séparées par des virgules"><input className="input" value={form.stops} onChange={set('stops')} placeholder="Bouaké, Yamoussoukro" /></Field>
            <PaymentChips value={form.paymentMethods} onChange={setMethods} />
            <div className="notice notice-info" style={{ marginTop: 8 }}>
              Récapitulatif : {normalizeMethods(form.paymentMethods).join(', ')}
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`${detail.depart} → ${detail.arrivee}`} subtitle={`${formatDate(detail.date)} à ${detail.time}`} onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <StatusBadge status={detail.status} />
            <span className="chip">{formatMoney(detail.price)}</span>
            <span className="chip">{detail.availableSeats} places libres</span>
            {detail.station && <span className="chip">Gare de {detail.station}</span>}
          </div>
          <div className="label">Passagers embarqués</div>
          {(detail.bookings || []).length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Aucune réservation pour ce trajet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Passager</th><th>Téléphone</th><th>Place</th><th>Billet</th></tr></thead>
                <tbody>
                  {detail.bookings!.map((b) => (
                    <tr key={b.id}>
                      <td>{b.passengerName}</td>
                      <td>{b.passengerPhone}</td>
                      <td>{b.seatNumber || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.ticket?.code || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Supprimer ce trajet ?"
          message={`Le trajet ${deleting.depart} → ${deleting.arrivee} sera définitivement supprimé.`}
          confirmLabel="Supprimer"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
