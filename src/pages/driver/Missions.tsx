import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, MapPin, Users } from 'lucide-react';
import { driverApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatDate, formatMoney } from '../../lib/format';
import { Empty, ErrorView, Loading, Notice, PageHeader, StatusBadge } from '../../lib/ui';
import type { Trip } from '../../types';

type Tab = 'active' | 'upcoming' | 'completed' | 'all';

export function DriverMissionsPage() {
  const { userSession, driverInfo, refreshDriverInfo, toast } = useApp();
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
      toast('Disponibilité mise à jour.', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const active = data.trips.filter((t) => ['boarding', 'in_transit'].includes(t.status));
  const upcoming = data.trips.filter((t) => t.status === 'scheduled');
  const completed = data.trips.filter((t) => t.status === 'completed');
  const filtered = tab === 'all' ? data.trips : tab === 'active' ? active : tab === 'upcoming' ? upcoming : completed;
  const driverName = `${driverInfo?.user?.firstName || driverInfo?.firstName || ''} ${driverInfo?.user?.lastName || driverInfo?.lastName || ''}`.trim();

  if (loading) return <Loading label="Chargement de vos missions…" />;
  if (error) return <ErrorView message={error} retry={() => void reload()} />;

  return (
    <>
      <PageHeader
        title="Mes missions"
        subtitle={driverName || 'Chauffeur'}
        actions={
          <select
            className="select"
            style={{ width: 180 }}
            value={driverInfo?.status || 'available'}
            disabled={statusBusy}
            onChange={(e) => void changeStatus(e.target.value)}
          >
            <option value="available">Disponible</option>
            <option value="on_trip">En mission</option>
            <option value="off_duty">En repos</option>
          </select>
        }
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          ['active', `En cours (${active.length})`],
          ['upcoming', `À venir (${upcoming.length})`],
          ['completed', `Terminées (${completed.length})`],
          ['all', `Toutes (${data.trips.length})`],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${tab === key ? 'btn-secondary' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty icon={ClipboardList} title="Aucune mission ici" text="Les missions assignées apparaîtront dans cette liste." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((t) => (
            <div key={t.id} className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{t.depart} → {t.arrivee}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatDate(t.date)} · {t.time} {t.station ? `· Gare de ${t.station}` : ''}</div>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }} className="muted">
                <span className="chip"><Users size={13} /> {t.bookings?.length ?? 0} passagers</span>
                <span className="chip"><MapPin size={13} /> {t.availableSeats} places</span>
                <span className="chip">{formatMoney(t.price)}</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <Link className="btn btn-primary btn-sm" to={`/driver/missions/${t.id}`}>Voir la mission →</Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {driverInfo?.status === 'off_duty' && <div style={{ marginTop: 14 }}><Notice tone="warning">Vous êtes en repos. Repassez en « Disponible » pour recevoir des missions.</Notice></div>}
    </>
  );
}
