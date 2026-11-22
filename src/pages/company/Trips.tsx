import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Edit2, Eye, Plus, Trash2, Users } from 'lucide-react';
import { companyApi, errorMessage, parseList } from '../../api';
import { PaymentChips } from '../../components/PaymentChips';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { normalizeMethods } from '../../paymentMethods';
import { formatDate, formatMoney, todayInput, tripStops } from '../../lib/format';
import { ConfirmModal, Empty, ErrorView, Field, ListSkeleton, Modal, Notice, PageHeader, StatusBadge } from '../../lib/ui';
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
  const { companySession, toast, t } = useApp();
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
      toast(t('save'), 'success');
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
      toast(t('delete'), 'success');
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
        title={t('trips')}
        subtitle={t('trips')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => openEdit('new')}><Plus size={15} /> {t('newTrip')}</button>}
      />
      {loading ? <ListSkeleton /> : error ? <ErrorView message={error} retry={() => void reload()} /> : data.trips.length === 0 ? (
        <Empty icon={Users} title={t('noTripsAvailable')} text={t('newTrip')} action={<button className="btn btn-primary" onClick={() => openEdit('new')}>{t('newTrip')}</button>} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>{t('trips')}</th><th>{t('date')} / {t('time')}</th><th>{t('price')}</th><th>{t('seats')}</th><th>{t('driverName')}</th><th>{t('status')}</th><th></th></tr></thead>
            <tbody>
              {data.trips.map((trip) => (
                <tr key={trip.id}>
                  <td><strong>{trip.depart} → {trip.arrivee}</strong>{trip.station && <div className="muted" style={{ fontSize: 11 }}>{t('station')} {trip.station}</div>}</td>
                  <td>{formatDate(trip.date)} · {trip.time}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(trip.price)}</td>
                  <td>{trip.availableSeats}</td>
                  <td>{trip.driverName || drivers.data.drivers.find((d) => d.id === trip.driverId)?.user?.firstName || '—'}</td>
                  <td><StatusBadge status={trip.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title={t('details')} onClick={() => void openDetail(trip.id)}><Eye size={15} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title={t('edit')} onClick={() => openEdit(trip)}><Edit2 size={15} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title={t('delete')} onClick={() => setDeleting(trip)}><Trash2 size={15} /></button>
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
          title={editing === 'new' ? t('newTrip') : `${t('edit')} ${t('trips')}`}
          subtitle={t('required')}
          onClose={() => setEditing(null)}
          footer={<><button className="btn" onClick={() => setEditing(null)}>{t('cancel')}</button><button className="btn btn-primary" type="submit" form="trip-form" disabled={busy}>{t('save')}</button></>}
        >
          {formError && <div style={{ marginBottom: 12 }}><Notice tone="error">{formError}</Notice></div>}
          <form id="trip-form" onSubmit={submit}>
            <div className="field-row">
              <Field label={t('depart')} required><input className="input" value={form.depart} onChange={set('depart')} required /></Field>
              <Field label={t('arrive')} required><input className="input" value={form.arrivee} onChange={set('arrivee')} required /></Field>
            </div>
            <Field label={t('station')}><input className="input" value={form.station} onChange={set('station')} placeholder={t('station')} /></Field>
            <div className="field-row">
              <Field label={t('date')} required><input className="input" type="date" value={form.date} onChange={set('date')} required /></Field>
              <Field label={t('time')} required><input className="input" type="time" value={form.time} onChange={set('time')} required /></Field>
              <Field label={t('duration')}><input className="input" value={form.duration} onChange={set('duration')} placeholder="4h30" /></Field>
            </div>
            <div className="field-row">
              <Field label={`${t('price')} (FCFA)`} required><input className="input" inputMode="numeric" type="number" min={0} value={form.price} onChange={set('price')} required /></Field>
              <Field label={t('seats')} required><input className="input" type="number" min={0} value={form.availableSeats} onChange={set('availableSeats')} required /></Field>
            </div>
            <div className="field-row">
              <Field label={t('driverName')}>
                <select className="select" value={form.driverId} onChange={set('driverId')}>
                  <option value="">{t('none')}</option>
                  {drivers.data.drivers.map((d) => <option key={d.id} value={d.id}>{d.user?.firstName || d.firstName} {d.user?.lastName || d.lastName}</option>)}
                </select>
              </Field>
              <Field label={t('vehicle')}>
                <select className="select" value={form.vehicleId} onChange={set('vehicleId')}>
                  <option value="">{t('none')}</option>
                  {vehicles.data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber}{v.brand ? ` · ${v.brand}` : ''}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t('stops')} hint={t('stops')}><input className="input" value={form.stops} onChange={set('stops')} placeholder="Bouaké, Yamoussoukro" /></Field>
            <PaymentChips value={form.paymentMethods} onChange={setMethods} />
            <div className="notice notice-info" style={{ marginTop: 8 }}>
              {t('recap')} : {normalizeMethods(form.paymentMethods).join(', ')}
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`${detail.depart} → ${detail.arrivee}`} subtitle={`${formatDate(detail.date)} · ${detail.time}`} onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <StatusBadge status={detail.status} />
            <span className="chip">{formatMoney(detail.price)}</span>
            <span className="chip">{detail.availableSeats} {t('seats')}</span>
            {detail.station && <span className="chip">{t('station')} {detail.station}</span>}
          </div>
          <div className="label">{t('scannedPassengers')}</div>
          {(detail.bookings || []).length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>{t('noData')}</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('passenger')}</th><th>{t('phone')}</th><th>{t('seats')}</th><th>{t('ticket')}</th></tr></thead>
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
          title={t('delete')}
          message={`${t('trips')} ${deleting.depart} → ${deleting.arrivee} · ${t('delete')}`}
          confirmLabel={t('delete')}
          danger
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
