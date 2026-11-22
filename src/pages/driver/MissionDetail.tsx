import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, MapPin, Play, QrCode, Square, Users } from 'lucide-react';
import { driverApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatDate, tripStops } from '../../lib/format';
import { Empty, ErrorView, Field, Loading, Modal, PageHeader, StatusBadge } from '../../lib/ui';
import type { Trip } from '../../types';

export function DriverMissionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { userSession, toast, t } = useApp();
  const token = userSession!.token;
  const { data, loading, error, reload } = useAsync(() => driverApi.trip(token, id), [token, id], { trip: null as Trip | null });
  const [stopName, setStopName] = useState('');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentType, setIncidentType] = useState('Retard');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [busy, setBusy] = useState(false);

  usePolling(reload, 15000);

  const updateStatus = async (status: 'boarding' | 'in_transit' | 'completed') => {
    setBusy(true);
    try {
      await driverApi.tripStatus(token, id, status);
      toast(t('status'), 'success');
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addStop = async () => {
    if (!stopName.trim()) return;
    setBusy(true);
    try {
      await driverApi.stop(token, id, stopName.trim());
      toast(t('recordStop'), 'success');
      setStopName('');
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    setBusy(true);
    try {
      await driverApi.incident(token, { type: incidentType, description: incidentDesc.trim() || undefined, tripId: id });
      toast(t('reportIncident'), 'success');
      setIncidentOpen(false);
      setIncidentDesc('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label={t('loading')} />;
  if (error) return <ErrorView message={error} retry={() => void reload()} />;
  const trip = data.trip;
  if (!trip) return <Empty icon={MapPin} title={t('noMission')} action={<Link className="btn btn-primary" to="/driver/missions">{t('back')}</Link>} />;

  return (
    <>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => navigate(-1)}><ArrowLeft size={15} /> {t('back')} {t('missions')}</button>
      <PageHeader
        title={`${trip.depart} → ${trip.arrivee}`}
        subtitle={`${formatDate(trip.date)} · ${trip.time}${trip.station ? ` · ${t('station')} ${trip.station}` : ''}`}
        actions={<StatusBadge status={trip.status} />}
      />
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary btn-sm" to={`/driver/scan?tripId=${encodeURIComponent(id)}`}><QrCode size={15} /> {t('scan')}</Link>
          {trip.status === 'scheduled' && <button className="btn btn-sm" disabled={busy} onClick={() => void updateStatus('boarding')}>{t('boarding')}</button>}
          {(trip.status === 'scheduled' || trip.status === 'boarding') && <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void updateStatus('in_transit')}><Play size={15} /> {t('startTrip')}</button>}
          {trip.status === 'in_transit' && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void updateStatus('completed')}><Square size={15} /> {t('finishTrip')}</button>}
          <button className="btn btn-sm" onClick={() => setIncidentOpen(true)}><AlertTriangle size={15} /> {t('reportIncident')}</button>
        </div>

        <div className="divider" />
        <div className="label">{t('recordStop')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 320 }} value={stopName} onChange={(e) => setStopName(e.target.value)} placeholder={t('city')} />
          <button className="btn btn-sm" disabled={busy || !stopName.trim()} onClick={() => void addStop()}>{t('add')}</button>
        </div>
        {tripStops(trip).length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tripStops(trip).map((s, i) => <span className="chip" key={`${s}-${i}`}><MapPin size={12} /> {s}</span>)}
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Users size={18} /> <strong>{t('scannedPassengers')} ({(trip.bookings || []).length})</strong></div>
        {(trip.bookings || []).length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>{t('noData')}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('passenger')}</th><th>{t('phone')}</th><th>{t('seats')}</th><th>{t('ticket')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {trip.bookings!.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.passengerName}</td>
                    <td>{b.passengerPhone}</td>
                    <td>{b.seatNumber || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.ticket?.code || '—'}</td>
                    <td><StatusBadge status={b.ticket?.status || b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {incidentOpen && (
        <Modal
          title={t('reportIncident')}
          subtitle={t('reportIncident')}
          onClose={() => setIncidentOpen(false)}
          footer={<><button className="btn" onClick={() => setIncidentOpen(false)}>{t('cancel')}</button><button className="btn btn-danger" disabled={busy} onClick={() => void report()}>{t('confirm')}</button></>}
        >
          <Field label={t('incidents')}>
            <select className="select" value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
              <option>Retard</option><option>Panne</option><option>Accident</option><option>Passager absent</option><option>Traffic</option><option>Autre</option>
            </select>
          </Field>
          <Field label={t('comment')}><textarea className="textarea" value={incidentDesc} onChange={(e) => setIncidentDesc(e.target.value)} placeholder={t('comment')} /></Field>
        </Modal>
      )}
    </>
  );
}
