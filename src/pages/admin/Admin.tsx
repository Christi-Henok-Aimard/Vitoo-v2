import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Eye, ShieldBan, Trash2, UserCog, Users } from 'lucide-react';
import { adminApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync } from '../../lib/hooks';
import { formatDate } from '../../lib/format';
import { ConfirmModal, Empty, ErrorView, Loading, Modal, PageHeader, StatCard } from '../../lib/ui';
import { GridCards } from '../../components/AppShell';
import type { AdminStats, User } from '../../types';

type Action = { type: 'ban' | 'delete'; user: User } | null;

export function AdminDashboardPage() {
  const { userSession, toast, t } = useApp();
  const token = userSession!.token;
  const { id } = useParams();
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const stats = useAsync(() => adminApi.stats(token), [token], {} as AdminStats);
  const users = useAsync(() => adminApi.users(token, { role: role || undefined, page, limit: 20 }), [token, role, page], { users: [] as User[], total: 0 });
  const [detail, setDetail] = useState<User | null>(null);
  const [action, setAction] = useState<Action>(null);

  const openDetail = async (userId: string) => {
    try {
      const res = await adminApi.user(token, userId);
      setDetail(res.user);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  useEffect(() => {
    if (id) void openDetail(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const applyAction = async () => {
    if (!action) return;
    try {
      if (action.type === 'ban') {
        await adminApi.patchUser(token, action.user.id, { role: 'passenger' });
        toast(t('passenger'), 'success');
      } else {
        const result = await adminApi.deleteUser(token, action.user.id);
        toast(
          result.messageSent
            ? `${t('delete')} · ${t('success')}`
            : `${t('delete')} · ${t('noData')}`,
          result.messageSent ? 'success' : 'info',
        );
      }
      setAction(null);
      setDetail(null);
      await users.reload();
      await stats.reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <PageHeader title={t('adminSpace')} subtitle={`${t('overview')} · ${t('users')}`} />
      <GridCards>
        <StatCard icon={Users} label={t('totalUsers')} value={stats.data.users ?? 0} tone="primary" />
        <StatCard icon={Building2} label={t('totalCompanies')} value={stats.data.companies ?? 0} tone="success" />
        <StatCard icon={UserCog} label={t('drivers')} value={stats.data.drivers ?? 0} tone="warning" />
        <StatCard icon={ShieldBan} label={t('totalTrips')} value={stats.data.trips ?? 0} tone="danger" />
      </GridCards>

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <strong>{t('users')}</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" style={{ width: 170 }} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              <option value="">{t('all')}</option>
              <option value="passenger">{t('passenger')}</option>
              <option value="company">{t('totalCompanies')}</option>
              <option value="driver">{t('drivers')}</option>
              <option value="admin">{t('adminSpace')}</option>
            </select>
          </div>
        </div>

        {users.loading ? <Loading /> : users.error ? <ErrorView message={users.error} retry={() => void users.reload()} /> : users.data.users.length === 0 ? (
          <Empty icon={Users} title={t('noData')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('name')}</th><th>{t('phone')}</th><th>{t('email')}</th><th>{t('status')}</th><th>{t('date')}</th><th></th></tr></thead>
                <tbody>
                  {users.data.users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>{u.firstName} {u.lastName}</td>
                      <td>{u.phone}</td>
                      <td>{u.email || '—'}</td>
                      <td><span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'company' ? 'badge-primary' : ''}`}>{u.role}</span></td>
                      <td className="muted">{formatDate(u.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" title={t('details')} onClick={() => void openDetail(u.id)}><Eye size={15} /></button>
                          {u.role !== 'passenger' && <button className="btn btn-ghost btn-icon btn-sm" title={t('ban')} onClick={() => setAction({ type: 'ban', user: u })}><ShieldBan size={15} /></button>}
                          <button className="btn btn-ghost btn-icon btn-sm" title={t('delete')} onClick={() => setAction({ type: 'delete', user: u })}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span className="muted" style={{ fontSize: 12 }}>{users.data.total ? `${users.data.total} ${t('users')}` : `${t('number')} ${page}`}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('back')}</button>
                <button className="btn btn-sm" disabled={users.data.users.length < 20} onClick={() => setPage((p) => p + 1)}>{t('seeAll')}</button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <Modal
          title={`${detail.firstName} ${detail.lastName}`}
          subtitle={`${t('status')} : ${detail.role}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              {detail.role !== 'passenger' && <button className="btn" onClick={() => setAction({ type: 'ban', user: detail })}><ShieldBan size={14} /> {t('ban')}</button>}
              <button className="btn btn-danger" onClick={() => setAction({ type: 'delete', user: detail })}><Trash2 size={14} /> {t('delete')}</button>
            </>
          }
        >
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr><td>{t('phone')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.phone}</td></tr>
                <tr><td>{t('email')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.email || '—'}</td></tr>
                <tr><td>{t('city')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.city || '—'}</td></tr>
                <tr><td>{t('company')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.companyName || '—'}</td></tr>
                <tr><td>{t('date')}</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{formatDate(detail.createdAt, true)}</td></tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {action && (
        <ConfirmModal
          title={action.type === 'ban' ? `${t('ban')} ?` : `${t('delete')} ?`}
          message={action.type === 'ban'
            ? `${action.user.firstName} ${action.user.lastName} · ${t('passenger')}`
            : t('deleteConfirm')}
          confirmLabel={action.type === 'ban' ? t('ban') : t('delete')}
          danger
          onClose={() => setAction(null)}
          onConfirm={applyAction}
        />
      )}
    </>
  );
}
