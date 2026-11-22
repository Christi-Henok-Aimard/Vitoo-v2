import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CarFront, Globe2, LogOut, Moon, Palette, Sun, UserCog } from 'lucide-react';
import { auth, errorMessage, parseList } from '../../api';
import { PaymentChips } from '../../components/PaymentChips';
import { useApp } from '../../lib/context';
import { normalizeMethods } from '../../paymentMethods';
import { updateCompanySessionUser } from '../../session';
import { Field, Notice, PageHeader } from '../../lib/ui';
import { LanguagePicker } from '../../components/LanguagePicker';

export function CompanyProfilePage() {
  const { companySession, theme, toggleTheme, t, logoutCompany, toast } = useApp();
  const navigate = useNavigate();
  const u = companySession!.user;
  const [form, setForm] = useState({
    companyName: u.companyName || '',
    rccm: u.rccm || '',
    taxId: u.taxId || '',
    city: u.city || '',
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    email: u.email || '',
    companyLogo: u.companyLogo || '',
    primaryColor: u.primaryColor || '#1d5df5',
    secondaryColor: u.secondaryColor || '#16a34a',
    paymentMethods: normalizeMethods(parseList(u.paymentMethods)),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const set = (k: Exclude<keyof typeof form, 'paymentMethods'>) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  const setMethods = (paymentMethods: string[]) => setForm((prev) => ({ ...prev, paymentMethods }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const res = await auth.patchCompanyMe(companySession!.token, {
        companyName: form.companyName.trim(),
        rccm: form.rccm.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        city: form.city.trim() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        companyLogo: form.companyLogo.trim() || undefined,
        primaryColor: form.primaryColor.trim() || undefined,
        secondaryColor: form.secondaryColor.trim() || undefined,
        paymentMethods: form.paymentMethods,
      });
      updateCompanySessionUser(res.user);
      setForm((prev) => ({ ...prev, paymentMethods: normalizeMethods(parseList(res.user.paymentMethods)) }));
      setMsg(t('save'));
      toast(t('save'), 'success');
    } catch (error) {
      setErr(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={`${t('company')} ${t('profile')}`} subtitle={`${t('branding')} · ${t('settings')}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <span className="stat-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', width: 48, height: 48 }}>
              {u.companyLogo ? <img src={u.companyLogo} alt={t('logo')} style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 10 }} /> : <Building2 size={22} />}
            </span>
            <div>
              <strong style={{ fontSize: 17 }}>{u.companyName || t('company')}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{u.city || "Côte d'Ivoire"}</div>
            </div>
          </div>
          {msg && <div style={{ marginBottom: 12 }}><Notice tone="success">{msg}</Notice></div>}
          {err && <div style={{ marginBottom: 12 }}><Notice tone="error">{err}</Notice></div>}
          <form onSubmit={(e) => void save(e)}>
            <Field label={t('company')} required><input className="input" value={form.companyName} onChange={set('companyName')} required /></Field>
            <div className="field-row">
              <Field label="RCCM"><input className="input" value={form.rccm} onChange={set('rccm')} /></Field>
              <Field label={t('number')}><input className="input" value={form.taxId} onChange={set('taxId')} /></Field>
            </div>
            <Field label={t('city')}><input className="input" value={form.city} onChange={set('city')} /></Field>
            <div className="divider" />
            <div className="label">{t('phone')}</div>
            <div className="field-row">
              <Field label={t('firstName')} required><input className="input" value={form.firstName} onChange={set('firstName')} required /></Field>
              <Field label={t('lastName')} required><input className="input" value={form.lastName} onChange={set('lastName')} required /></Field>
            </div>
            <div className="field-row">
              <Field label={t('phone')} required><input className="input" value={form.phone} onChange={set('phone')} required /></Field>
              <Field label={t('email')} required><input className="input" type="email" value={form.email} onChange={set('email')} required /></Field>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? t('loading') : t('save')}</button>
          </form>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}><Palette size={18} /> <strong>{t('branding')}</strong></div>
            <Field label={`${t('logo')} (URL)`}><input className="input" value={form.companyLogo} onChange={set('companyLogo')} placeholder="https://…" /></Field>
            <div className="field-row">
              <Field label={t('primaryColor')}><input className="input" type="color" value={form.primaryColor} onChange={set('primaryColor')} style={{ padding: 4, height: 42 }} /></Field>
              <Field label={t('secondaryColor')}><input className="input" type="color" value={form.secondaryColor} onChange={set('secondaryColor')} style={{ padding: 4, height: 42 }} /></Field>
            </div>
            <PaymentChips value={form.paymentMethods} onChange={setMethods} />
            <div className="notice notice-info">{t('save')} !</div>
          </div>

          <div className="card card-pad">
            <strong style={{ fontSize: 15 }}>{t('team')}</strong>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <Link className="btn btn-block" to="/company/team"><UserCog size={16} /> {t('manageDrivers')}</Link>
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} {t('theme')}</span>
              <button className={`btn btn-sm ${theme === 'dark' ? 'btn-secondary' : ''}`} onClick={toggleTheme}>{theme === 'dark' ? t('light') : t('dark')}</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Globe2 size={16} /> {t('language')}</span>
              <LanguagePicker />
            </div>
            <div className="divider" />
            <button className="btn btn-danger btn-block" onClick={() => { logoutCompany(); navigate('/company', { replace: true }); }}><LogOut size={16} /> {t('logout')}</button>
          </div>

          <div className="card card-pad" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <CarFront size={20} color="var(--primary)" />
            <span className="muted" style={{ fontSize: 12 }}>{t('needHelp')} christhenokaimard@gmail.com · 01 02 21 80 53</span>
          </div>
        </div>
      </div>
    </>
  );
}
