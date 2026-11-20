import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { auth, errorMessage, type AuthResult } from '../api';
import { GlassBackdrop } from '../components/Splash';
import { useApp } from '../lib/context';
import { makeUserSession } from '../session';
import { Field, Notice } from '../lib/ui';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';

/* ---------------------- Google Identity Services ----------------------- */

interface GoogleCredentialResponse {
  credential?: string;
}
interface GoogleIdApi {
  initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}
interface GoogleSdk {
  accounts: { id: GoogleIdApi };
}
declare global {
  interface Window {
    google?: GoogleSdk;
  }
}

function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !holder.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !holder.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) handler.current(response.credential);
        },
      });
      window.google.accounts.id.renderButton(holder.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    };
    if (window.google?.accounts?.id) {
      render();
    } else {
      let script = document.querySelector<HTMLScriptElement>('script[data-vitoo-gis]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.vitooGis = '1';
        document.head.appendChild(script);
      }
      script.addEventListener('load', render, { once: true });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div className="google-button" ref={holder} />;
}

/* --------------------------- Mise en page ------------------------------ */

function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <GlassBackdrop />
      <div className="auth-card glass">
        <div className="auth-brand">
          <span className="auth-logo">V</span>
          <strong>VITOO</strong>
        </div>
        <h2 style={{ fontSize: 22 }}>{title}</h2>
        <p className="muted" style={{ fontSize: 13, margin: '5px 0 20px' }}>{subtitle}</p>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  return error ? <div style={{ marginBottom: 12 }}><Notice tone="error">{error}</Notice></div> : null;
}

const spaceLinks = (
  <>
    <Link to="/passenger">Passager</Link> · <Link to="/company">Compagnie</Link> · <Link to="/admin">Admin</Link>
  </>
);

/* --------------------------- Passager / Admin --------------------------- */

export function PassengerAuth({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { setUserSession, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState(params.get('code') || '');
  const [demoCode, setDemoCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const titles = {
    login: ['Connexion passager', 'Connectez-vous pour retrouver vos billets.'],
    register: ['Créer un compte', "Quelques informations et c'est parti."],
    forgot: ['Mot de passe oublié', 'Nous vous enverrons un code de réinitialisation.'],
    reset: ['Nouveau mot de passe', 'Saisissez le code reçu et votre nouveau mot de passe.'],
  } as const;

  const finish = (result: AuthResult) => {
    setUserSession(makeUserSession(result));
    toast('Bienvenue !', 'success');
    navigate(params.get('next') || (result.user.role === 'admin' ? '/admin' : '/passenger'), { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode !== 'forgot' && password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        finish(await auth.login({ phone: phone.trim(), password }));
      } else if (mode === 'register') {
        finish(await auth.register({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), password }));
      } else if (mode === 'forgot') {
        const res = await auth.forgotPassword(phone.trim());
        if (res.code) setDemoCode(res.code);
        toast(res.message || 'Code envoyé.', 'success');
        setBusy(false);
      } else {
        await auth.resetPassword({ phone: phone.trim(), code: code.trim(), password });
        toast('Mot de passe réinitialisé. Connectez-vous.', 'success');
        navigate('/passenger/login', { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const signInWithGoogle = async (idToken: string) => {
    setError('');
    setBusy(true);
    try {
      finish(await auth.google(idToken));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const footer =
    mode === 'login' ? (
      <>
        <div>Pas encore de compte ? <Link to="/passenger/register">S'inscrire</Link></div>
        <div style={{ marginTop: 6 }}><Link to="/passenger/forgot">Mot de passe oublié ?</Link></div>
      </>
    ) : mode === 'register' ? (
      <>Déjà inscrit ? <Link to="/passenger/login">Se connecter</Link></>
    ) : (
      <>Retour <Link to="/passenger/login">à la connexion</Link></>
    );

  return (
    <AuthLayout title={titles[mode][0]} subtitle={titles[mode][1]} footer={footer}>
      <ErrorBox error={error} />
      <form onSubmit={(e) => void submit(e)}>
        {mode === 'register' && (
          <div className="field-row">
            <Field label="Prénom" required><input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
            <Field label="Nom" required><input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></Field>
          </div>
        )}
        {(mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'reset') && (
          <Field label="Téléphone" required>
            <input className="input" inputMode="tel" placeholder="+225 07 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
        )}
        {mode === 'reset' && (
          <Field label="Code de réinitialisation" required>
            <input className="input" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
        )}
        {(mode === 'login' || mode === 'register' || mode === 'reset') && (
          <Field label="Mot de passe" required>
            <input className="input" type="password" minLength={8} placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        )}
        {mode === 'register' && (
          <Field label="Confirmer le mot de passe" required>
            <input className="input" type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
        )}
        {demoCode && (
          <div style={{ marginBottom: 12 }}>
            <Notice tone="info">
              Code de démonstration (développement) : <strong style={{ fontFamily: 'monospace' }}>{demoCode}</strong>
            </Notice>
            <div style={{ marginTop: 8, textAlign: 'right', fontSize: 13 }}>
              <Link to={`/passenger/reset?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(demoCode)}`}>Saisir le code →</Link>
            </div>
          </div>
        )}
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : mode === 'forgot' ? 'Envoyer le code' : 'Réinitialiser'}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      {(mode === 'login' || mode === 'register') && GOOGLE_CLIENT_ID && (
        <>
          <div className="auth-divider"><span>ou continuer avec</span></div>
          <GoogleButton onCredential={(token) => void signInWithGoogle(token)} />
        </>
      )}
      <div className="auth-spaces">{spaceLinks}</div>
    </AuthLayout>
  );
}

/* ------------------------------- Compagnie ------------------------------- */

export function CompanyAuth({ mode }: { mode: 'login' | 'register' }) {
  const { setCompanySession, toast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '', rccm: '', taxId: '', city: '', firstName: '', lastName: '', phone: '', email: '', password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setBusy(true);
    try {
      const res = mode === 'login'
        ? await auth.loginCompany({ email: form.email.trim(), password: form.password })
        : await auth.registerCompany({
            companyName: form.companyName.trim(),
            rccm: form.rccm.trim() || undefined,
            taxId: form.taxId.trim() || undefined,
            city: form.city.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            password: form.password,
          });
      setCompanySession(res);
      toast('Bienvenue !', 'success');
      navigate('/company', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={mode === 'login' ? 'Espace compagnie' : 'Inscrire ma compagnie'}
      subtitle={mode === 'login' ? 'Gérez vos trajets, chauffeurs et billets.' : 'Créez votre espace en quelques champs.'}
      footer={mode === 'login' ? <>Pas encore inscrit ? <Link to="/company/register">Créer un compte compagnie</Link></> : <>Déjà inscrit ? <Link to="/company">Se connecter</Link></>}
    >
      <ErrorBox error={error} />
      <form onSubmit={(e) => void submit(e)}>
        {mode === 'register' && (
          <>
            <Field label="Nom de la compagnie" required><input className="input" value={form.companyName} onChange={set('companyName')} required /></Field>
            <div className="field-row">
              <Field label="RCCM"><input className="input" value={form.rccm} onChange={set('rccm')} /></Field>
              <Field label="Numéro fiscal"><input className="input" value={form.taxId} onChange={set('taxId')} /></Field>
            </div>
            <Field label="Ville" required><input className="input" value={form.city} onChange={set('city')} required /></Field>
            <div className="field-row">
              <Field label="Prénom" required><input className="input" value={form.firstName} onChange={set('firstName')} required /></Field>
              <Field label="Nom" required><input className="input" value={form.lastName} onChange={set('lastName')} required /></Field>
            </div>
            <Field label="Téléphone" required><input className="input" inputMode="tel" value={form.phone} onChange={set('phone')} required /></Field>
          </>
        )}
        <Field label="E-mail" required><input className="input" type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Mot de passe" required><input className="input" type="password" minLength={8} value={form.password} onChange={set('password')} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon espace'}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      <div className="auth-spaces">{spaceLinks}</div>
    </AuthLayout>
  );
}

/* ---------------------------------- Admin ---------------------------------- */

export function AdminLogin() {
  const { setUserSession, toast } = useApp();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await auth.login({ phone: phone.trim(), password });
      if (res.user.role !== 'admin') {
        setError("Ces identifiants ne sont pas ceux d'un administrateur.");
        setBusy(false);
        return;
      }
      setUserSession(makeUserSession(res));
      toast('Bienvenue administrateur.', 'success');
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Administration"
      subtitle="Espace réservé aux administrateurs Vitoo."
      footer={spaceLinks}
    >
      <ErrorBox error={error} />
      <form onSubmit={(e) => void submit(e)}>
        <div className="auth-secure">
          <ShieldCheck size={18} /> <LockKeyhole size={16} /> <span>Connexion sécurisée</span>
        </div>
        <Field label="Téléphone" required><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
        <Field label="Mot de passe" required><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </AuthLayout>
  );
}
