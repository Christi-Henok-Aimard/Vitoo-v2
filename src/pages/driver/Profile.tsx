import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Globe2, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { driverApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { formatDate } from '../../lib/format';
import { Empty, ErrorView, Field, Loading, Notice, PageHeader, StatCard } from '../../lib/ui';
import { GridCards } from '../../components/AppShell';
import { LanguagePicker } from '../../components/LanguagePicker';
import type { DriverStats, Incident } from '../../types';

export function DriverProfilePage() {
  const { userSession, driverInfo, refreshDriverInfo, theme, toggleTheme, t, logoutUser, toast } = useApp();
  const navigate = useNavigate();
  const token = userSession!.token;
  const stats = useAsync(() => driverApi.stats(token), [token], {} as DriverStats);
  const [busy, setBusy] = useState(false);

  usePolling(() => void stats.reload(), 15000);

  const changeStatus = async (status: string) => {
    setBusy(true);
    try {
      await driverApi.status(token, status);
      await refreshDriverInfo();
      toast(t('available'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const name = `${driverInfo?.user?.firstName || driverInfo?.firstName || ''} ${driverInfo?.user?.lastName || driverInfo?.lastName || ''}`.trim();

  return (
    <>
      <PageHeader title={`${t('profile')} ${t('driverName')}`} subtitle={`${t('available')} · ${t('stats')} · ${t('settings')}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="stat-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', width: 50, height: 50 }}><UserRound size={23} /></span>
            <div>
              <strong style={{ fontSize: 18 }}>{name || t('driverName')}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{driverInfo?.user?.phone || driverInfo?.phone || userSession?.user.phone}</div>
            </div>
          </div>
          <div className="divider" />
          <div className="label">{t('available')}</div>
          <select className="select" value={driverInfo?.status || 'available'} disabled={busy} onChange={(e) => void changeStatus(e.target.value)}>
            <option value="available">{t('available')}</option>
            <option value="on_trip">{t('onTrip')}</option>
            <option value="off_duty">{t('offDuty')}</option>
          </select>
          <div className="divider" />
          <div className="muted" style={{ fontSize: 12 }}>{t('license')} : <strong style={{ color: 'var(--text)' }}>{driverInfo?.licenseNumber || t('none')}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} {t('theme')}</span>
            <button className={`btn btn-sm ${theme === 'dark' ? 'btn-secondary' : ''}`} onClick={toggleTheme}>{theme === 'dark' ? t('light') : t('dark')}</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Globe2 size={16} /> {t('language')}</span>
            <LanguagePicker />
          </div>
          <div className="divider" />
          <button className="btn btn-block" onClick={() => navigate('/passenger/profile')}>{t('backToPassenger')}</button>
          <div style={{ height: 8 }} />
          <button className="btn btn-danger btn-block" onClick={() => { logoutUser(); navigate('/passenger', { replace: true }); }}><LogOut size={16} /> {t('logout')}</button>
        </div>

        <div>
          <GridCards min={150}>
            <StatCard icon={CheckCircle2} label={t('tripsCompleted')} value={stats.data.tripsCompleted ?? 0} tone="success" />
            <StatCard icon={ClipboardList} label={t('upcomingMissions')} value={stats.data.tripsUpcoming ?? 0} tone="primary" />
            <StatCard icon={UserRound} label={t('passengersCarried')} value={stats.data.passengers ?? 0} tone="warning" />
            <StatCard icon={AlertTriangle} label={t('incidents')} value={stats.data.incidents ?? 0} tone="danger" />
          </GridCards>
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{t('incidents')}</strong>
              <a className="btn btn-ghost btn-sm" href="#incidents">{t('seeAll')}</a>
            </div>
            <div className="divider" />
            <IncidentsList limit={3} />
          </div>
        </div>
      </div>
      <div id="incidents" style={{ marginTop: 24 }}><DriverIncidentsPage embedded /></div>
    </>
  );
}

function IncidentsList({ limit }: { limit?: number }) {
  const { userSession, t } = useApp();
  const token = userSession!.token;
  const { data, loading, error, reload } = useAsync(() => driverApi.incidents(token), [token], { incidents: [] as Incident[] });
  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} retry={() => void reload()} />;
  const rows = limit ? data.incidents.slice(0, limit) : data.incidents;
  if (rows.length === 0) return <div className="muted" style={{ fontSize: 13 }}>{t('noData')}</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((inc) => (
        <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <strong style={{ fontSize: 13 }}>{inc.type}</strong>
            <div className="muted" style={{ fontSize: 12 }}>{inc.description || '—'}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span className={`badge ${inc.resolved ? 'badge-success' : 'badge-warning'}`}>{inc.resolved ? t('completed') : t('currentMissions')}</span>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{formatDate(inc.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DriverIncidentsPage({ embedded = false }: { embedded?: boolean }) {
  const { userSession, toast, t } = useApp();
  const token = userSession!.token;
  const { data, loading, error, reload } = useAsync(() => driverApi.incidents(token), [token], { incidents: [] as Incident[] });
  const [type, setType] = useState('Retard');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await driverApi.incident(token, { type, description: description.trim() || undefined });
      toast(t('reportIncident'), 'success');
      setDescription('');
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        {!embedded && <PageHeader title={t('incidents')} subtitle={t('reportIncident')} />}
        <form onSubmit={(e) => void submit(e)}>
          {embedded && <div className="label">{t('reportIncident')}</div>}
          <div className="field-row">
            <Field label={t('incidents')}><select className="select" value={type} onChange={(e) => setType(e.target.value)}><option>Retard</option><option>Panne</option><option>Accident</option><option>Passager absent</option><option>Traffic</option><option>Autre</option></select></Field>
            <Field label={t('comment')}><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('comment')} /></Field>
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{busy ? t('loading') : t('reportIncident')}</button>
        </form>
      </div>
      <div className="card card-pad">
        <strong>{t('all')}</strong>
        <div className="divider" />
        {loading ? <Loading /> : error ? <ErrorView message={error} retry={() => void reload()} /> : data.incidents.length === 0 ? (
          <Empty icon={AlertTriangle} title={t('noData')} text={t('reportIncident')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('incidents')}</th><th>{t('comment')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {data.incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td style={{ fontWeight: 700 }}>{inc.type}</td>
                    <td>{inc.description || '—'}</td>
                    <td>{formatDate(inc.createdAt)}</td>
                    <td><span className={`badge ${inc.resolved ? 'badge-success' : 'badge-warning'}`}>{inc.resolved ? t('completed') : t('currentMissions')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  return embedded ? <div className="card card-pad"><Notice tone="info">{t('reportIncident')} · {t('details')}</Notice><div style={{ height: 12 }} /></div> : body;
}
