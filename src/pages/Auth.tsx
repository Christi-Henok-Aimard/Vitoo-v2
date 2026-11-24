import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { AuthSplit } from '../components/AuthSplit';
import { kbrAppearance } from '../components/kbr';
import { auth, errorMessage, verificationApi, type AuthResult } from '../api';
import { useApp } from '../lib/context';
import { makeUserSession, updateCompanySessionUser, updateUserSessionUser } from '../session';
import { Field, Notice } from '../lib/ui';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';

type VerifySpace = 'passenger' | 'company' | 'admin';

/** Le serveur indique `verified: false` (au niveau de la réponse ou de l'utilisateur). */
function needsVerification(result: AuthResult): boolean {
  return result.verified === false || result.user.verified === false;
}

function verifyPath(
  space: VerifySpace,
  identifier: string,
  code?: string,
  next?: string | null,
  channel?: 'sms' | 'email',
): string {
  const base = space === 'company' ? '/company/verify' : space === 'admin' ? '/admin/verify' : '/verify';
  const q = new URLSearchParams();
  q.set(space === 'company' ? 'email' : 'phone', identifier);
  if (code) q.set('code', code);
  if (next) q.set('next', next);
  if (channel) q.set('channel', channel);
  return `${base}?${q.toString()}`;
}

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
      <div className="auth-card">
        <img className="auth-brand-logo" src="/vitoo-symbol.jpg" alt="Vitoo" />
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

function SpaceLinks() {
  const { t } = useApp();
  return (
    <>
      <Link to="/passenger">{t('passengerLogin')}</Link> · <Link to="/company">{t('companyLogin')}</Link> · <Link to="/admin">{t('adminSpace')}</Link>
    </>
  );
}

/* -------------------------- Vérification OTP --------------------------- */

/** Le composant KBR stocke la saisie dans `val` (certaines versions exposent `value`). */
type KbrCodeInput = HTMLElement & { val?: string; value?: string };

export function VerifyPage({ space }: { space: VerifySpace }) {
  const { userSession, companySession, setUserSession, setCompanySession, toast, theme, t } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const codeInputRef = useRef<HTMLElement | null>(null);

  // Un admin redirigé par le Guard atterrit sur /verify : on déduit son espace réel.
  const effectiveSpace: VerifySpace =
    space === 'passenger' && userSession?.user.role === 'admin' ? 'admin' : space;
  const queryChannel = params.get('channel');
  const channel: 'sms' | 'email' =
    queryChannel === 'email' || queryChannel === 'sms'
      ? queryChannel
      : effectiveSpace === 'company'
        ? 'email'
        : 'sms';

  const identifier =
    (effectiveSpace === 'company' ? params.get('email') : params.get('phone')) || '';
  const loginTo =
    effectiveSpace === 'company' ? '/company/login' : effectiveSpace === 'admin' ? '/admin' : '/passenger/login';

  const [devCode, setDevCode] = useState(params.get('code') || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Saisie native fiable : le code-input KBR s'ouvre en deux temps et prête à confusion.
  const [fallback, setFallback] = useState(true);

  /** Lecture prioritaire sur la propriété du custom element, avec repli sur l'état. */
  const readCode = (): string => {
    const el = codeInputRef.current as KbrCodeInput | null;
    const fromElement = [el?.value, el?.val]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .sort((a, b) => b.length - a.length)[0];
    return (fromElement || code).replace(/\D/g, '').slice(0, 4);
  };

  // Le code-input émet `complete` ({ code }) dès que les 4 chiffres sont saisis ;
  // on écoute aussi `change` / `input` pour les versions qui exposent une valeur.
  useEffect(() => {
    const el = codeInputRef.current;
    if (!el || fallback) return;
    const capture = (event: Event) => {
      const detail = (event as CustomEvent<{ code?: string; value?: string }>).detail;
      const fromEvent = detail?.code ?? detail?.value;
      const raw = typeof fromEvent === 'string' && fromEvent ? fromEvent : (el as KbrCodeInput).val || (el as KbrCodeInput).value || '';
      if (raw) setCode(String(raw).replace(/\D/g, '').slice(0, 4));
    };
    const events = ['complete', 'change', 'input', 'verified'];
    events.forEach((name) => el.addEventListener(name, capture));
    return () => events.forEach((name) => el.removeEventListener(name, capture));
  }, [fallback]);

  const home = () =>
    params.get('next') ||
    (effectiveSpace === 'company'
      ? '/company/overview'
      : effectiveSpace === 'admin'
        ? '/admin/dashboard'
        : '/passenger');

  const verify = async () => {
    setError('');
    const value = readCode();
    if (value.length !== 4) {
      setFallback(true);
      setError(t('invalidCode'));
      toast(t('invalidCode'), 'error');
      return;
    }
    setBusy(true);
    try {
      const res =
        effectiveSpace === 'company'
          ? await verificationApi.verifyCompany({ email: identifier, code: value })
          : effectiveSpace === 'admin'
            ? await verificationApi.verifyAdmin({ phone: identifier, code: value })
            : await verificationApi.verifyPassenger({ phone: identifier, code: value });
      if (res.code) setDevCode(res.code);
      const verified = res.verified !== false;
      const nextUser = { ...(res.user || {}), verified };
      if (effectiveSpace === 'company') {
        if (companySession) updateCompanySessionUser({ ...companySession.user, ...nextUser });
        else if (res.token) setCompanySession({ token: res.token, user: nextUser as AuthResult['user'] });
      } else {
        if (userSession) updateUserSessionUser({ ...userSession.user, ...nextUser });
        else if (res.token) setUserSession(makeUserSession({ token: res.token, user: nextUser as AuthResult['user'] }));
      }
      toast(t('verified'), 'success');
      navigate(home(), { replace: true });
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast(t('invalidCode'), 'error');
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    if (!identifier) {
      setError(t('invalidCode'));
      return;
    }
    setBusy(true);
    try {
      const res =
        effectiveSpace === 'company'
          ? await verificationApi.resendCompany(identifier)
          : effectiveSpace === 'admin'
            ? await verificationApi.resendAdmin(identifier)
            : await verificationApi.resendPassenger(identifier);
      if (res.code) setDevCode(res.code);
      toast(t('codeSent'), 'success');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t('verifyTitle')}
      subtitle={`${t('verifyText')} · ${t(channel === 'email' ? 'emailChannel' : 'smsChannel')}`}
      footer={<>{t('back')} <Link to={loginTo}>{t('login')}</Link></>}
    >
      <ErrorBox error={error} />
      {devCode && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="info">{t('code')} : <strong style={{ fontFamily: 'monospace' }}>{devCode}</strong></Notice>
        </div>
      )}
      {fallback ? (
        <Field label={t('verifyCode')} required>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </Field>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <code-input
            ref={codeInputRef}
            length="4"
            label={t('verifyCode')}
            testCode={devCode}
            test-code={devCode}
            appearance={kbrAppearance(theme)}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => void verify()}>
          {busy ? t('loading') : t('verifyAction')}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => void resend()}>
          {t('resendCode')}
        </button>
      </div>
    </AuthLayout>
  );
}

/* --------------------------- Passager / Admin --------------------------- */

export function PassengerAuth({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { setUserSession, toast, theme, t } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState(params.get('code') || '');
  const [resetCode, setResetCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const titles = {
    login: [t('passengerLogin'), `${t('login')} · ${t('myTickets')}`],
    register: [t('register'), t('welcome')],
    forgot: [t('forgotPassword'), t('sendCode')],
    reset: [t('newPassword'), `${t('resetCode')} · ${t('newPassword')}`],
  } as const;

  type Target = 'login' | 'register' | 'forgot' | 'reset';

  const finish = (result: AuthResult) => {
    const unverified = needsVerification(result);
    const user = { ...result.user, verified: !unverified };
    setUserSession(makeUserSession({ ...result, user }));
    if (unverified) {
      const space = user.role === 'admin' ? 'admin' : 'passenger';
      navigate(verifyPath(space, user.phone || phone.trim(), result.code, params.get('next'), result.verification?.channel), { replace: true });
      return;
    }
    toast(t('welcome'), 'success');
    navigate(params.get('next') || (user.role === 'admin' ? '/admin' : '/passenger'), { replace: true });
  };

  const run = async (target: Target) => {
    setError('');
    if (target !== 'forgot' && password.length < 8) {
      setError(`${t('password')} · ${t('required')}`);
      return;
    }
    if (target === 'register' && password !== confirm) {
      setError(t('confirmPassword'));
      return;
    }
    setBusy(true);
    try {
      if (target === 'login') {
        finish(await auth.login({ phone: phone.trim(), password }));
      } else if (target === 'register') {
        finish(await auth.register({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), password }));
      } else if (target === 'forgot') {
        const res = await auth.forgotPassword(phone.trim());
        if (res.code) setResetCode(res.code);
        toast(res.message || t('sendCode'), 'success');
        setBusy(false);
      } else {
        await auth.resetPassword({ phone: phone.trim(), code: code.trim(), password });
        toast(`${t('resetPassword')} · ${t('login')}`, 'success');
        navigate('/passenger/login', { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void run(mode); };

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

  // Les écrans OTP restent sur une carte simple.
  if (mode === 'forgot' || mode === 'reset') {
    return (
      <AuthLayout title={titles[mode][0]} subtitle={titles[mode][1]} footer={<>{t('back')} <Link to="/passenger/login">{t('login')}</Link></>}>
        <ErrorBox error={error} />
        <form onSubmit={submit}>
          <Field label={t('phone')} required>
            <input className="input" inputMode="tel" placeholder="+225 07 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
          {mode === 'reset' && (
            <Field label={t('resetCode')} required>
              <input className="input" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
            </Field>
          )}
          <Field label={t('password')} required>
            <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {resetCode && (
            <div style={{ marginBottom: 12 }}>
              <Notice tone="info">{t('code')} : <strong style={{ fontFamily: 'monospace' }}>{resetCode}</strong></Notice>
              <div style={{ marginTop: 8, textAlign: 'right', fontSize: 13 }}>
                <Link to={`/passenger/reset?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(resetCode)}`}>{t('checkCode')} →</Link>
              </div>
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? t('loading') : mode === 'forgot' ? t('sendCode') : t('resetPassword')}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
      </AuthLayout>
    );
  }

  const loginForm = (
    <>
      <img className="auth-brand-logo" src="/vitoo-symbol.jpg" alt="Vitoo" />
      <h2>{t('login')}</h2>
      <p className="muted">{t('myTickets')} · {t('notifications')}</p>
      <ErrorBox error={error} />
      <form onSubmit={(e) => { e.preventDefault(); void run('login'); }}>
        <Field label={t('phone')} required>
          <input className="input" inputMode="tel" placeholder="+225 07 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Field label={t('password')} required>
          <input className="input" type="password" minLength={8} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <div style={{ textAlign: 'right', fontSize: 13, margin: '2px 0 8px' }}>
          <Link to="/passenger/forgot">{t('forgotPassword')}</Link>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? t('loading') : t('login')} {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      {GOOGLE_CLIENT_ID && (
        <>
          <div className="auth-divider"><span>{t('login')}</span></div>
          <GoogleButton onCredential={(token) => void signInWithGoogle(token)} />
        </>
      )}
      <div className="auth-spaces"><SpaceLinks /></div>
    </>
  );

  const registerForm = (
    <>
      <img className="auth-brand-logo" src="/vitoo-symbol.jpg" alt="Vitoo" />
      <h2>{t('register')}</h2>
      <p className="muted">{t('welcome')}</p>
      <ErrorBox error={error} />
      <form onSubmit={(e) => { e.preventDefault(); void run('register'); }}>
        <div className="field-row">
          <Field label={t('firstName')} required><input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
          <Field label={t('lastName')} required><input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></Field>
        </div>
        <Field label={t('phone')} required>
          <input className="input" inputMode="tel" placeholder="+225 07 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Field label={t('password')} required>
          <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label={t('confirm')} required>
          <input className="input" type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? t('loading') : t('createAccount')} {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      {GOOGLE_CLIENT_ID && (
        <>
          <div className="auth-divider"><span>{t('login')}</span></div>
          <GoogleButton onCredential={(token) => void signInWithGoogle(token)} />
        </>
      )}
      <div className="auth-spaces"><SpaceLinks /></div>
    </>
  );

  return (
    <AuthSplit
      active={mode === 'register'}
      login={loginForm}
      register={registerForm}
      leftPanel={{
        title: t('haveAccount'),
        text: `${t('myTickets')} · ${t('notifications')}`,
        buttonLabel: t('login'),
        onButton: () => navigate('/passenger/login'),
      }}
      rightPanel={{
        title: t('noAccount'),
        text: `${t('register')} · ${t('book')}`,
        buttonLabel: t('register'),
        onButton: () => navigate('/passenger/register'),
      }}
      dark={theme === 'dark'}
    />
  );
}

/* ------------------------------- Compagnie ------------------------------- */

export function CompanyAuth({ mode }: { mode: 'login' | 'register' }) {
  const { setCompanySession, toast, theme, t } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '', rccm: '', taxId: '', city: '', firstName: '', lastName: '', phone: '', email: '', password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const run = async (target: 'login' | 'register') => {
    setError('');
    if (form.password.length < 8) {
      setError(`${t('password')} · ${t('required')}`);
      return;
    }
    setBusy(true);
    try {
      const res = target === 'login'
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
      const verified = !needsVerification(res);
      const user = { ...res.user, verified };
      setCompanySession({ token: res.token, user, driverSpace: res.driverSpace });
      if (!verified) {
        navigate(verifyPath('company', user.email || form.email.trim(), res.code, undefined, res.verification?.channel), { replace: true });
        return;
      }
      toast(t('welcome'), 'success');
      navigate('/company', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const loginForm = (
    <>
      <img className="auth-brand-logo" src="/vitoo-symbol.jpg" alt="Vitoo" />
      <h2>{t('companyLogin')}</h2>
      <p className="muted">{t('trips')} · {t('drivers')} · {t('totalTickets')}</p>
      <ErrorBox error={error} />
      <form onSubmit={(e) => { e.preventDefault(); void run('login'); }}>
        <Field label={t('email')} required><input className="input" type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label={t('password')} required><input className="input" type="password" minLength={8} value={form.password} onChange={set('password')} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? t('loading') : t('login')} {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      <div className="auth-spaces"><SpaceLinks /></div>
      <div style={{ textAlign: 'center', fontSize: 13, marginTop: 6 }}>
        <Link to="/company/forgot">{t('forgotPassword')}</Link>
      </div>
    </>
  );

  const registerForm = (
    <>
      <img className="auth-brand-logo" src="/vitoo-symbol.jpg" alt="Vitoo" />
      <h2>{`${t('register')} ${t('company')}`}</h2>
      <p className="muted">{t('welcome')}</p>
      <ErrorBox error={error} />
      <form onSubmit={(e) => { e.preventDefault(); void run('register'); }}>
        <Field label={`${t('company')} · ${t('name')}`} required><input className="input" value={form.companyName} onChange={set('companyName')} required /></Field>
        <div className="field-row">
          <Field label="RCCM"><input className="input" value={form.rccm} onChange={set('rccm')} /></Field>
          <Field label={t('number')}><input className="input" value={form.taxId} onChange={set('taxId')} /></Field>
        </div>
        <Field label={t('city')} required><input className="input" value={form.city} onChange={set('city')} required /></Field>
        <div className="field-row">
          <Field label={t('firstName')} required><input className="input" value={form.firstName} onChange={set('firstName')} required /></Field>
          <Field label={t('lastName')} required><input className="input" value={form.lastName} onChange={set('lastName')} required /></Field>
        </div>
        <Field label={t('phone')} required><input className="input" inputMode="tel" value={form.phone} onChange={set('phone')} required /></Field>
        <Field label={t('email')} required><input className="input" type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label={t('password')} required><input className="input" type="password" minLength={8} value={form.password} onChange={set('password')} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? t('loading') : t('register')} {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      <div className="auth-spaces"><SpaceLinks /></div>
    </>
  );

  return (
    <AuthSplit
      active={mode === 'register'}
      login={loginForm}
      register={registerForm}
      leftPanel={{
        title: t('haveAccount'),
        text: t('login'),
        buttonLabel: t('login'),
        onButton: () => navigate('/company/login'),
      }}
      rightPanel={{
        title: t('companyLogin'),
        text: `${t('companyLogin')} · ${t('trips')}`,
        buttonLabel: t('register'),
        onButton: () => navigate('/company/register'),
      }}
      dark={theme === 'dark'}
    />
  );
}

/* ------------------ Mot de passe oublié : compagnie / admin ----------------- */

export function SpaceForgotPassword({ space }: { space: 'company' | 'admin' }) {
  const navigate = useNavigate();
  const { toast, t } = useApp();
  const [step, setStep] = useState<'ask' | 'code'>('ask');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isCompany = space === 'company';
  const home = isCompany ? '/company/login' : '/admin';

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = isCompany ? await auth.forgotCompany(value.trim()) : await auth.forgotAdmin(value.trim());
      if (res.code) setDevCode(res.code);
      toast(res.message, 'success');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(`${t('password')} · ${t('required')}`);
      return;
    }
    setBusy(true);
    try {
      const body = { code: code.trim(), password };
      if (isCompany) await auth.resetCompany({ email: value.trim(), ...body });
      else await auth.resetAdmin({ phone: value.trim(), ...body });
      toast(`${t('resetPassword')} · ${t('login')}`, 'success');
      navigate(home, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t('forgotPassword')}
      subtitle={`${t('sendCode')} · ${isCompany ? t('email') : t('phone')}`}
      footer={<>{t('back')} <Link to={home}>{t('login')}</Link></>}
    >
      <img className="auth-brand-logo" src="/vitoo-symbol.jpg" alt="Vitoo" />
      <ErrorBox error={error} />
      {devCode && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="info">{t('code')} : <strong style={{ fontFamily: 'monospace' }}>{devCode}</strong></Notice>
        </div>
      )}
      {step === 'ask' ? (
        <form onSubmit={(e) => void ask(e)}>
          <Field label={isCompany ? `${t('company')} ${t('email')}` : t('phone')} required>
            <input
              className="input"
              type={isCompany ? 'email' : 'tel'}
              inputMode={isCompany ? 'email' : 'tel'}
              placeholder={isCompany ? 'email@domain.com' : '+225 07 00 00 00 00'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? t('loading') : t('sendCode')} {!busy && <ArrowRight size={16} />}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void reset(e)}>
          <Field label={t('code')} required>
            <input className="input" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label={t('newPassword')} required>
            <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? t('loading') : t('resetPassword')} {!busy && <ArrowRight size={16} />}
          </button>
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('ask'); setDevCode(''); setError(''); }}>{t('sendCode')}</button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

/* ---------------------------------- Admin ---------------------------------- */

export function AdminLogin() {
  const { setUserSession, toast, theme, t } = useApp();
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
        // Ne pas répéter le sous-titre « espace réservé » dans la boîte d'erreur :
        // on affiche uniquement une vraie erreur d'authentification.
        setError(t('error'));
        setBusy(false);
        return;
      }
      const verified = !needsVerification(res);
      const user = { ...res.user, verified };
      setUserSession(makeUserSession({ ...res, user }));
      if (!verified) {
        navigate(verifyPath('admin', user.phone || phone.trim(), res.code, undefined, res.verification?.channel), { replace: true });
        return;
      }
      toast(`${t('welcome')} ${t('adminSpace')}`, 'success');
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthSplit
      active={false}
      login={
        <>
          <img className="auth-brand-logo" src="/vitoo-symbol.jpg" alt="Vitoo" />
          <h2>{t('adminSpace')}</h2>
          <p className="muted">{t('adminOnly')}</p>
          <ErrorBox error={error} />
          <form onSubmit={(e) => void submit(e)}>
            <div className="auth-secure">
              <ShieldCheck size={18} /> <LockKeyhole size={16} /> <span>{t('secureLogin')}</span>
            </div>
            <Field label={t('phone')} required><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
            <Field label={t('password')} required><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? t('loading') : t('login')}</button>
          </form>
          <div className="auth-spaces"><SpaceLinks /></div>
          <div style={{ textAlign: 'center', fontSize: 13, marginTop: 6 }}>
            <Link to="/admin/forgot">{t('forgotPassword')}</Link>
          </div>
        </>
      }
      register={<></>}
      leftPanel={{
        title: t('passengerLogin'),
        text: `${t('search')} · ${t('passengerLogin')}`,
        buttonLabel: t('passengerLogin'),
        onButton: () => navigate('/passenger'),
      }}
      rightPanel={{
        title: t('adminSpace'),
        text: `${t('users')} · ${t('stats')}`,
        buttonLabel: t('open'),
        onButton: () => navigate('/passenger'),
      }}
      dark={theme === 'dark'}
    />
  );
}
