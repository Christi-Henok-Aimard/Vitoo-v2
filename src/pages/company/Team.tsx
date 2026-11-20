import { useState, type ChangeEvent, type FormEvent } from 'react';
import { CarFront, Edit2, Plus, Trash2, UserCog } from 'lucide-react';
import { companyApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { useAsync, usePolling } from '../../lib/hooks';
import { ConfirmModal, Empty, ErrorView, Field, Loading, Modal, Notice, PageHeader, StatusBadge } from '../../lib/ui';
import type { Driver, Vehicle } from '../../types';

type Target = { kind: 'driver'; item?: Driver } | { kind: 'vehicle'; item?: Vehicle };

export function CompanyTeamPage() {
  const { companySession, toast } = useApp();
  const token = companySession!.token;
  const drivers = useAsync(() => companyApi.drivers(token), [token], { drivers: [] as Driver[] });
  const vehicles = useAsync(() => companyApi.vehicles(token), [token], { vehicles: [] as Vehicle[] });
  const [tab, setTab] = useState<'drivers' | 'vehicles'>('drivers');
  const [target, setTarget] = useState<Target | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  usePolling(() => { void drivers.reload(); void vehicles.reload(); }, 15000);

  const openForm = (t: Target) => {
    setError('');
    if (t.kind === 'driver') {
      const d = t.item;
      setForm({
        firstName: d?.user?.firstName || d?.firstName || '',
        lastName: d?.user?.lastName || d?.lastName || '',
        phone: d?.user?.phone || d?.phone || '',
        licenseNumber: d?.licenseNumber || '',
        password: '',
      });
    } else {
      const v = t.item;
      setForm({
        plateNumber: v?.plateNumber || '',
        brand: v?.brand || '',
        model: v?.model || '',
        capacity: v?.capacity ? String(v.capacity) : '',
        photo: v?.photo || '',
      });
    }
    setTarget(t);
  };

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      if (target.kind === 'driver') {
        if (!target.item) {
          if (form.password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
          await companyApi.createDriver(token, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim(),
            password: form.password,
            licenseNumber: form.licenseNumber.trim() || undefined,
          });
        } else {
          await companyApi.updateDriver(token, target.item.id, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim(),
            licenseNumber: form.licenseNumber.trim() || undefined,
          });
        }
        toast('Chauffeur enregistré.', 'success');
        await drivers.reload();
      } else {
        const body = {
          plateNumber: form.plateNumber.trim(),
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
          photo: form.photo.trim() || undefined,
        };
        if (!target.item) await companyApi.createVehicle(token, body);
        else await companyApi.updateVehicle(token, target.item.id, body);
        toast('Véhicule enregistré.', 'success');
        await vehicles.reload();
      }
      setTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      if (deleting.kind === 'driver') await companyApi.deleteDriver(token, deleting.item!.id);
      else await companyApi.deleteVehicle(token, deleting.item!.id);
      toast('Élément supprimé.', 'success');
      setDeleting(null);
      if (deleting.kind === 'driver') await drivers.reload();
      else await vehicles.reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <PageHeader title="Chauffeurs & véhicules" subtitle="Gérez votre équipe et votre flotte." />
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button className={`btn btn-sm ${tab === 'drivers' ? 'btn-secondary' : ''}`} onClick={() => setTab('drivers')}><UserCog size={14} /> Chauffeurs ({drivers.data.drivers.length})</button>
        <button className={`btn btn-sm ${tab === 'vehicles' ? 'btn-secondary' : ''}`} onClick={() => setTab('vehicles')}><CarFront size={14} /> Véhicules ({vehicles.data.vehicles.length})</button>
      </div>

      {tab === 'drivers' ? (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong>Mes chauffeurs</strong>
            <button className="btn btn-primary btn-sm" onClick={() => openForm({ kind: 'driver' })}><Plus size={14} /> Ajouter</button>
          </div>
          {drivers.loading ? <Loading /> : drivers.error ? <ErrorView message={drivers.error} retry={() => void drivers.reload()} /> : drivers.data.drivers.length === 0 ? (
            <Empty icon={UserCog} title="Aucun chauffeur" text="Ajoutez un chauffeur pour lui confier des missions." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nom</th><th>Téléphone</th><th>Permis</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {drivers.data.drivers.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.user?.firstName || d.firstName} {d.user?.lastName || d.lastName}</td>
                      <td>{d.user?.phone || d.phone || '—'}</td>
                      <td>{d.licenseNumber || '—'}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openForm({ kind: 'driver', item: d })}><Edit2 size={15} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleting({ kind: 'driver', item: d })}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong>Mes véhicules</strong>
            <button className="btn btn-primary btn-sm" onClick={() => openForm({ kind: 'vehicle' })}><Plus size={14} /> Ajouter</button>
          </div>
          {vehicles.loading ? <Loading /> : vehicles.error ? <ErrorView message={vehicles.error} retry={() => void vehicles.reload()} /> : vehicles.data.vehicles.length === 0 ? (
            <Empty icon={CarFront} title="Aucun véhicule" text="Ajoutez un véhicule à votre flotte." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Plaque</th><th>Marque / Modèle</th><th>Capacité</th><th>Actif</th><th></th></tr></thead>
                <tbody>
                  {vehicles.data.vehicles.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 700 }}>{v.plateNumber}</td>
                      <td>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                      <td>{v.capacity ?? '—'}</td>
                      <td><span className={`badge ${v.isActive ? 'badge-success' : ''}`}>{v.isActive ? 'Actif' : 'Inactif'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openForm({ kind: 'vehicle', item: v })}><Edit2 size={15} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleting({ kind: 'vehicle', item: v })}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {target && (
        <Modal
          title={target.kind === 'driver' ? (target.item ? 'Modifier le chauffeur' : 'Nouveau chauffeur') : target.item ? 'Modifier le véhicule' : 'Nouveau véhicule'}
          subtitle={target.kind === 'driver' && !target.item ? 'Un compte chauffeur sera créé avec ce téléphone et ce mot de passe.' : undefined}
          onClose={() => setTarget(null)}
          footer={<><button className="btn" onClick={() => setTarget(null)}>Annuler</button><button className="btn btn-primary" type="submit" form="team-form" disabled={busy}>Enregistrer</button></>}
        >
          {error && <div style={{ marginBottom: 12 }}><Notice tone="error">{error}</Notice></div>}
          <form id="team-form" onSubmit={(e) => void submit(e)}>
            {target.kind === 'driver' ? (
              <>
                <div className="field-row">
                  <Field label="Prénom" required><input className="input" value={form.firstName} onChange={set('firstName')} required /></Field>
                  <Field label="Nom" required><input className="input" value={form.lastName} onChange={set('lastName')} required /></Field>
                </div>
                <Field label="Téléphone" required><input className="input" inputMode="tel" value={form.phone} onChange={set('phone')} required disabled={!!target.item} /></Field>
                <Field label="Numéro de permis"><input className="input" value={form.licenseNumber} onChange={set('licenseNumber')} /></Field>
                {!target.item && <Field label="Mot de passe" required hint="8 caractères minimum"><input className="input" type="password" minLength={8} value={form.password} onChange={set('password')} required /></Field>}
              </>
            ) : (
              <>
                <Field label="Plaque d'immatriculation" required><input className="input" value={form.plateNumber} onChange={set('plateNumber')} required /></Field>
                <div className="field-row">
                  <Field label="Marque"><input className="input" value={form.brand} onChange={set('brand')} /></Field>
                  <Field label="Modèle"><input className="input" value={form.model} onChange={set('model')} /></Field>
                  <Field label="Capacité"><input className="input" type="number" min={1} value={form.capacity} onChange={set('capacity')} /></Field>
                </div>
                <Field label="Photo (URL)"><input className="input" value={form.photo} onChange={set('photo')} placeholder="https://…" /></Field>
              </>
            )}
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Confirmer la suppression"
          message={deleting.kind === 'driver' ? 'Le compte du chauffeur sera supprimé.' : 'Le véhicule sera supprimé de votre flotte.'}
          confirmLabel="Supprimer"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
