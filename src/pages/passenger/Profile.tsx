import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, CarFront, CircleHelp, Globe2, LogOut, Mail, Moon, Phone, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { auth, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { updateUserSessionUser } from '../../session';
import { Field, Notice, PageHeader } from '../../lib/ui';
import { kbrAppearance, type KbrHandle } from '../../components/kbr';
import { LanguagePicker } from '../../components/LanguagePicker';

/** Sélecteur de thème KBR (contrôle unique, sans doublon ni cadre). */
function ThemeSwitch({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const { t } = useApp();
  const ref = useRef<KbrHandle | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value;
      const next = value === t('dark') ? 'dark' : value === t('light') ? 'light' : null;
      if (next && next !== theme) toggleTheme();
    };
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, [theme, toggleTheme, t]);
  return (
    <segmented-control
      ref={ref}
      options={`${t('light')}, ${t('dark')}`}
      selected={theme === 'dark' ? t('dark') : t('light')}
      appearance={kbrAppearance(theme)}
      tray="false"
      aria-label={t('theme')}
    />
  );
}

export function PassengerProfilePage() {
  const { userSession, theme, toggleTheme, t, logoutUser, toast } = useApp();
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  // FAQ construite uniquement à partir des clés existantes.
  const faq = [
    { q: `${t('myTickets')} ?`, a: `${t('showQr')} · ${t('downloadPdf')} · ${t('print')}` },
    { q: `${t('cash')} ?`, a: `${t('payOnBoard')}. ${t('payOnline')}.` },
    { q: t('notifications'), a: `${t('reminder48h')} · ${t('reminder24h')} · ${t('reminder10m')}` },
    { q: t('rateTrip'), a: `${t('rateCompany')} · ${t('rateDriver')}` },
  ];

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
      setMsg(t('success'));
      toast(t('success'), 'success');
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
      setErr(t('error'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setAvatar(url);
      updateUserSessionUser({ ...user, avatarUrl: url });
      toast(`${t('success')} · ${t('save')}`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdErr('');
    setPwdMsg('');
    if (newPassword.length < 8) {
      setPwdErr(`${t('newPassword')} · ${t('required')}`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErr(t('confirmPassword'));
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
      setPwdMsg(t('success'));
      toast(t('success'), 'success');
    } catch (error) {
      setPwdErr(errorMessage(error));
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t('profile')} subtitle={t('settings')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
              {avatar ? <img src={avatar} alt={t('profile')} className="avatar" style={{ width: 52, height: 52 }} /> : <UserRound size={24} />}
            </span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 17 }}>{user.firstName} {user.lastName}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{user.phone}</div>
            </div>
            <label className="btn btn-sm btn-secondary" htmlFor="avatar-input" style={{ cursor: 'pointer' }}>
              <Camera size={15} /> {t('edit')}
            </label>
            <input id="avatar-input" type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
          </div>
          {msg && <div style={{ marginBottom: 12 }}><Notice tone="success">{msg}</Notice></div>}
          {err && <div style={{ marginBottom: 12 }}><Notice tone="error">{err}</Notice></div>}
          <form onSubmit={(e) => void save(e)}>
            <div className="field-row">
              <Field label={t('firstName')} required><input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
              <Field label={t('lastName')} required><input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></Field>
            </div>
            <Field label={t('phone')} required><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
            <Field label={t('email')}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label={t('city')}><input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Abidjan" /></Field>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? t('loading') : t('save')}</button>
          </form>

          {user.driverSpace && (
            <div style={{ marginTop: 16 }}>
              <div className="divider" />
              <Link className="btn btn-primary btn-block" to="/driver/missions">
                <CarFront size={16} /> {t('driverLogin')}
              </Link>
              <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'center' }}>
                {user.driverSpace.companyName || t('driverLogin')}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <ShieldCheck size={18} color="var(--primary)" /> <strong>{t('password')}</strong>
            </div>
            {pwdMsg && <div style={{ marginBottom: 12 }}><Notice tone="success">{pwdMsg}</Notice></div>}
            {pwdErr && <div style={{ marginBottom: 12 }}><Notice tone="error">{pwdErr}</Notice></div>}
            <form onSubmit={(e) => void changePassword(e)}>
              <Field label={t('password')} required>
                <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </Field>
              <div className="field-row">
                <Field label={t('newPassword')} required>
                  <input className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </Field>
                <Field label={t('confirm')} required>
                  <input className="input" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </Field>
              </div>
              <button className="btn btn-secondary btn-block" disabled={pwdBusy} type="submit">
                {pwdBusy ? t('loading') : `${t('edit')} ${t('password')}`}
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 10 }}>{t('settings')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />} {t('theme')} {t('dark')}</span>
              <ThemeSwitch theme={theme} toggleTheme={toggleTheme} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Globe2 size={17} /> {t('language')}</span>
              <LanguagePicker />
            </div>
            <div className="divider" />
            <button className="btn btn-danger btn-block" onClick={() => { logoutUser(); navigate('/passenger', { replace: true }); }}>
              <LogOut size={16} /> {t('logout')}
            </button>
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><CircleHelp size={18} /> <strong>{t('needHelp')}</strong></div>
            <accordion-list
              q-1={faq[0].q}
              a-1={faq[0].a}
              q-2={faq[1].q}
              a-2={faq[1].a}
              q-3={faq[2].q}
              a-3={faq[2].a}
              q-4={faq[3].q}
              a-4={faq[3].a}
              width="300"
              appearance={kbrAppearance(theme)}
            />
            <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mail size={13} /> christhenokaimard@gmail.com</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}><Phone size={13} /> 01 02 21 80 53</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
