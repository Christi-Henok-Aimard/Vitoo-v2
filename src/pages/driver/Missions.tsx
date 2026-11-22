import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, MapPin, Users } from 'lucide-react';
import { driverApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatDate, formatMoney } from '../../lib/format';
import { Empty, ErrorView, ListSkeleton, Notice, PageHeader, StatusBadge } from '../../lib/ui';
import type { Trip } from '../../types';

type Tab = 'active' | 'upcoming' | 'completed' | 'all';

export function DriverMissionsPage() {
  const { userSession, driverInfo, refreshDriverInfo, toast, t } = useApp();
  const token = userSession!.token;
  const { data, loading, error, reload } = useAsync(() => driverApi.trips(token), [token], { trips: [] as Trip[] });
  const [tab, setTab] = useState<Tab>('active');
  const [statusBusy, setStatusBusy] = useState(false);

  usePolling(reload, 15000);

  const changeStatus = async (status: string) => {
    setStatusBusy(true);
    try {
      await driverApi.status(token, status);
      await refreshDriverInfo();
      toast(t('available'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const active = data.trips.filter((trip) => ['boarding', 'in_transit'].includes(trip.status));
  const upcoming = data.trips.filter((trip) => trip.status === 'scheduled');
  const completed = data.trips.filter((trip) => trip.status === 'completed');
  const filtered = tab === 'all' ? data.trips : tab === 'active' ? active : tab === 'upcoming' ? upcoming : completed;
  const driverName = `${driverInfo?.user?.firstName || driverInfo?.firstName || ''} ${driverInfo?.user?.lastName || driverInfo?.lastName || ''}`.trim();

  if (loading) return <ListSkeleton label={t('loading')} rows={3} />;
  if (error) return <ErrorView message={error} retry={() => void reload()} />;

  return (
    <>
      <PageHeader
        title={t('missions')}
        subtitle={driverName || t('driverName')}
        actions={
          <select
            className="select"
            style={{ width: 180 }}
            value={driverInfo?.status || 'available'}
            disabled={statusBusy}
            onChange={(e) => void changeStatus(e.target.value)}
          >
            <option value="available">{t('available')}</option>
            <option value="on_trip">{t('onTrip')}</option>
            <option value="off_duty">{t('offDuty')}</option>
          </select>
        }
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          ['active', `${t('currentMissions')} (${active.length})`],
          ['upcoming', `${t('upcomingMissions')} (${upcoming.length})`],
          ['completed', `${t('finishedMissions')} (${completed.length})`],
          ['all', `${t('allMissions')} (${data.trips.length})`],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${tab === key ? 'btn-secondary' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty icon={ClipboardList} title={t('noMission')} text={t('missionsAppear')} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((trip) => (
            <div key={trip.id} className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{trip.depart} → {trip.arrivee}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatDate(trip.date)} · {trip.time}{trip.station ? `· ${t('station')} ${trip.station}` : ''}</div>
                </div>
                <StatusBadge status={trip.status} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }} className="muted">
                <span className="chip"><Users size={13} /> {trip.bookings?.length ?? 0} {t('passengersCarried')}</span>
                <span className="chip"><MapPin size={13} /> {trip.availableSeats} {t('seats')}</span>
                <span className="chip">{formatMoney(trip.price)}</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <Link className="btn btn-primary btn-sm" to={`/driver/missions/${trip.id}`}>{t('details')} →</Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {driverInfo?.status === 'off_duty' && <div style={{ marginTop: 14 }}><Notice tone="warning">{t('offDuty')} · {t('available')} → {t('missions')}</Notice></div>}
    </>
  );
}
