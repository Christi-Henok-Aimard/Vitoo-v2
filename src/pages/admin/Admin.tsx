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
  const { userSession, toast } = useApp();
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
        toast('Utilisateur rétrogradé en passager.', 'success');
      } else {
        await adminApi.deleteUser(token, action.user.id);
        toast('Utilisateur supprimé.', 'success');
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
      <PageHeader title="Administration" subtitle="Vue d'ensemble et gestion des utilisateurs." />
      <GridCards>
        <StatCard icon={Users} label="Utilisateurs" value={stats.data.users ?? 0} tone="primary" />
        <StatCard icon={Building2} label="Compagnies" value={stats.data.companies ?? 0} tone="success" />
        <StatCard icon={UserCog} label="Chauffeurs" value={stats.data.drivers ?? 0} tone="warning" />
        <StatCard icon={ShieldBan} label="Trajets" value={stats.data.trips ?? 0} tone="danger" />
      </GridCards>

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <strong>Utilisateurs</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" style={{ width: 170 }} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              <option value="">Tous les rôles</option>
              <option value="passenger">Passagers</option>
              <option value="company">Compagnies</option>
              <option value="driver">Chauffeurs</option>
              <option value="admin">Administrateurs</option>
            </select>
          </div>
        </div>

        {users.loading ? <Loading /> : users.error ? <ErrorView message={users.error} retry={() => void users.reload()} /> : users.data.users.length === 0 ? (
          <Empty icon={Users} title="Aucun utilisateur" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nom</th><th>Téléphone</th><th>E-mail</th><th>Rôle</th><th>Inscrit le</th><th></th></tr></thead>
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
                          <button className="btn btn-ghost btn-icon btn-sm" title="Détail" onClick={() => void openDetail(u.id)}><Eye size={15} /></button>
                          {u.role !== 'passenger' && <button className="btn btn-ghost btn-icon btn-sm" title="Bannir" onClick={() => setAction({ type: 'ban', user: u })}><ShieldBan size={15} /></button>}
                          <button className="btn btn-ghost btn-icon btn-sm" title="Supprimer" onClick={() => setAction({ type: 'delete', user: u })}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span className="muted" style={{ fontSize: 12 }}>{users.data.total ? `${users.data.total} utilisateurs` : `Page ${page}`}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
                <button className="btn btn-sm" disabled={users.data.users.length < 20} onClick={() => setPage((p) => p + 1)}>Suivant</button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <Modal
          title={`${detail.firstName} ${detail.lastName}`}
          subtitle={`Rôle : ${detail.role}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              {detail.role !== 'passenger' && <button className="btn" onClick={() => setAction({ type: 'ban', user: detail })}><ShieldBan size={14} /> Bannir</button>}
              <button className="btn btn-danger" onClick={() => setAction({ type: 'delete', user: detail })}><Trash2 size={14} /> Supprimer</button>
            </>
          }
        >
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr><td>Téléphone</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.phone}</td></tr>
                <tr><td>E-mail</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.email || '—'}</td></tr>
                <tr><td>Ville</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.city || '—'}</td></tr>
                <tr><td>Compagnie</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.companyName || '—'}</td></tr>
                <tr><td>Inscrit le</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{formatDate(detail.createdAt, true)}</td></tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {action && (
        <ConfirmModal
          title={action.type === 'ban' ? 'Bannir cet utilisateur ?' : 'Supprimer cet utilisateur ?'}
          message={action.type === 'ban'
            ? `${action.user.firstName} ${action.user.lastName} sera rétrogradé au rôle passager.`
            : `${action.user.firstName} ${action.user.lastName} sera définitivement supprimé.`}
          confirmLabel={action.type === 'ban' ? 'Bannir' : 'Supprimer'}
          danger
          onClose={() => setAction(null)}
          onConfirm={applyAction}
        />
      )}
    </>
  );
}
