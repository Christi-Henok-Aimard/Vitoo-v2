import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, CarFront, CircleHelp, Globe2, LogOut, Mail, Moon, Phone, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { auth, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { updateUserSessionUser } from '../../session';
import { Field, Notice, PageHeader } from '../../lib/ui';

const FAQ = [
  { q: 'Comment obtenir mon billet ?', a: 'Après votre réservation, rendez-vous dans « Mes billets ». Vous pouvez afficher le QR code, l’imprimer ou le télécharger en PDF.' },
  { q: 'Puis-je payer au chauffeur ?', a: 'Oui, choisissez « Espèces » lors de la réservation. Les autres moyens de paiement sont traités en ligne via GeniusPay.' },
  { q: 'Quand reçois-je les rappels ?', a: 'Vous recevez des rappels 48 h, 24 h, 6 h, 2 h et 10 minutes avant le départ, ainsi que les annonces du chauffeur.' },
  { q: 'Comment noter un trajet ?', a: 'Après l’arrivée, une notification apparaît dans la cloche. Cliquez sur « Noter le trajet » pour évaluer la compagnie et le chauffeur.' },
];

export function PassengerProfilePage() {
  const { userSession, theme, toggleTheme, lang, toggleLang, logoutUser, toast } = useApp();
  const navigate = useNavigate();
  const user = userSession!.user;
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email || '');
  const [city, setCity] = useState(user.city || '');
  const [avatar, setAvatar] = useState(user.avatarUrl || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const res = await auth.patchMe(userSession!.token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        avatarUrl: avatar || undefined,
      });
      updateUserSessionUser(res.user);
      setMsg('Profil mis à jour.');
      toast('Profil mis à jour.', 'success');
    } catch (error) {
      setErr(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Choisissez un fichier image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setAvatar(url);
      updateUserSessionUser({ ...user, avatarUrl: url });
      toast('Photo mise à jour localement. Enregistrez le profil pour la conserver.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdErr('');
    setPwdMsg('');
    if (newPassword.length < 8) {
      setPwdErr('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErr('Les mots de passe ne correspondent pas.');
      return;
    }
    setPwdBusy(true);
    try {
      await auth.patchMe(userSession!.token, {
        currentPassword,
        password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdMsg('Mot de passe modifié.');
      toast('Mot de passe modifié.', 'success');
    } catch (error) {
      setPwdErr(errorMessage(error));
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Mon profil" subtitle="Gérez vos informations et vos préférences." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
              {avatar ? <img src={avatar} alt="Ma photo" className="avatar" style={{ width: 52, height: 52 }} /> : <UserRound size={24} />}
            </span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 17 }}>{user.firstName} {user.lastName}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{user.phone}</div>
            </div>
            <label className="btn btn-sm btn-secondary" htmlFor="avatar-input" style={{ cursor: 'pointer' }}>
              <Camera size={15} /> Photo
            </label>
            <input id="avatar-input" type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
          </div>
          {msg && <div style={{ marginBottom: 12 }}><Notice tone="success">{msg}</Notice></div>}
          {err && <div style={{ marginBottom: 12 }}><Notice tone="error">{err}</Notice></div>}
          <form onSubmit={(e) => void save(e)}>
            <div className="field-row">
              <Field label="Prénom" required><input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
              <Field label="Nom" required><input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></Field>
            </div>
            <Field label="Téléphone" required><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
            <Field label="E-mail"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Ville"><input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Abidjan" /></Field>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
          </form>

          {user.driverSpace && (
            <div style={{ marginTop: 16 }}>
              <div className="divider" />
              <Link className="btn btn-primary btn-block" to="/driver/missions">
                <CarFront size={16} /> Accéder à mon espace chauffeur
              </Link>
              <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'center' }}>
                {user.driverSpace.companyName || 'Espace chauffeur'}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <ShieldCheck size={18} color="var(--primary)" /> <strong>Changer le mot de passe</strong>
            </div>
            {pwdMsg && <div style={{ marginBottom: 12 }}><Notice tone="success">{pwdMsg}</Notice></div>}
            {pwdErr && <div style={{ marginBottom: 12 }}><Notice tone="error">{pwdErr}</Notice></div>}
            <form onSubmit={(e) => void changePassword(e)}>
              <Field label="Mot de passe actuel" required>
                <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </Field>
              <div className="field-row">
                <Field label="Nouveau mot de passe" required>
                  <input className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </Field>
                <Field label="Confirmer" required>
                  <input className="input" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </Field>
              </div>
              <button className="btn btn-secondary btn-block" disabled={pwdBusy} type="submit">
                {pwdBusy ? 'Modification…' : 'Modifier le mot de passe'}
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 10 }}>Préférences</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />} Thème sombre</span>
              <button className={`btn btn-sm ${theme === 'dark' ? 'btn-secondary' : ''}`} onClick={toggleTheme}>{theme === 'dark' ? 'Activé' : 'Désactivé'}</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Globe2 size={17} /> Langue</span>
              <button className="btn btn-sm btn-secondary" onClick={toggleLang}>{lang.toUpperCase()} · Changer</button>
            </div>
            <div className="divider" />
            <button className="btn btn-danger btn-block" onClick={() => { logoutUser(); navigate('/passenger', { replace: true }); }}>
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><CircleHelp size={18} /> <strong>Aide & support</strong></div>
            {FAQ.map((item, i) => (
              <div key={item.q} style={{ borderBottom: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'space-between', height: 'auto', padding: '10px 0' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span style={{ textAlign: 'left', whiteSpace: 'normal' }}>{item.q}</span>
                  <span>{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>{item.a}</p>}
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mail size={13} /> support@vitoo.ci</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}><Phone size={13} /> +225 00 00 00 00 00</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
