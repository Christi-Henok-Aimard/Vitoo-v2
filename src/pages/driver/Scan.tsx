import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle2, Keyboard, ScanLine, Square, UserRound } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { driverApi, errorMessage } from '../../api';
import { useApp } from '../../lib/context';
import { formatMoney } from '../../lib/format';
import { Empty, Notice, PageHeader, Spinner } from '../../lib/ui';
import type { Ticket } from '../../types';

function extractCode(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && 'code' in parsed) return String((parsed as { code: unknown }).code);
  } catch {
    /* texte brut */
  }
  try {
    const url = new URL(text);
    return url.searchParams.get('code') || url.pathname.split('/').pop() || text;
  } catch {
    return text;
  }
}

export function DriverScanPage() {
  const { userSession, toast, t } = useApp();
  const token = userSession!.token;
  const [params] = useSearchParams();
  const tripId = params.get('tripId') || '';
  const [mode, setMode] = useState<'manual' | 'camera'>('manual');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const validate = async (raw: string) => {
    const value = extractCode(raw);
    if (!value) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await driverApi.validate(token, value);
      setResult(res.ticket);
      toast(t('validate'), 'success');
    } catch (err) {
      setError(errorMessage(err));
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const scanner = new Html5Qrcode('qr-reader', { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { void validate(decoded); },
        () => undefined,
      );
      setScanning(true);
      setMode('camera');
    } catch (err) {
      setCameraError(errorMessage(err) || t('camera'));
      scannerRef.current = null;
    }
  };

  const stopCamera = async () => {
    try {
      await scannerRef.current?.stop();
    } catch {
      /* déjà arrêté */
    }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    const ref = scannerRef;
    return () => {
      if (ref.current) {
        try { void ref.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void validate(code);
  };

  return (
    <>
      <PageHeader title={t('scan')} subtitle={`${t('showQr')} · ${t('manualCode')}`} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button className={`btn btn-sm ${mode === 'manual' ? 'btn-secondary' : ''}`} onClick={() => { void stopCamera(); setMode('manual'); }}><Keyboard size={15} /> {t('manualCode')}</button>
        <button className={`btn btn-sm ${mode === 'camera' ? 'btn-secondary' : ''}`} onClick={() => void startCamera()}><Camera size={15} /> {t('camera')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad">
          {mode === 'manual' ? (
            <>
              <strong style={{ fontSize: 16 }}>{t('ticketCode')}</strong>
              <div className="divider" />
              <form onSubmit={submit}>
                <label className="label">{t('ticketCode')}</label>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VIT-XXXXXX" autoFocus />
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary btn-block" type="submit" disabled={busy || !code.trim()}>
                    {busy ? <Spinner label={t('loading')} /> : <><ScanLine size={16} /> {t('validate')}</>}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <strong style={{ fontSize: 16 }}>{t('camera')}</strong>
              <div className="divider" />
              <div id="qr-reader" style={{ width: '100%', minHeight: 260, background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden' }} />
              {scanning && <button className="btn btn-block" style={{ marginTop: 12 }} onClick={() => void stopCamera()}><Square size={15} /> {t('close')}</button>}
              {cameraError && <div style={{ marginTop: 12 }}><Notice tone="error">{cameraError}</Notice></div>}
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t('camera')} · {t('showQr')}</p>
            </>
          )}
        </div>

        <div className="card card-pad">
          <strong style={{ fontSize: 16 }}>{t('details')}</strong>
          <div className="divider" />
          {busy ? <Spinner label={t('loading')} /> : error ? (
            <Notice tone="error">{error}</Notice>
          ) : result ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}><CheckCircle2 size={20} /> <strong>{t('success')}</strong></div>
              <div style={{ marginTop: 14 }}>
                <div className="muted" style={{ fontSize: 12 }}>{t('code')}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16 }}>{result.code}</div>
                <div className="divider" />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><UserRound size={16} /> <strong>{result.passengerName || t('passenger')}</strong></div>
                <div className="muted" style={{ fontSize: 12 }}>{result.passengerPhone || '—'}</div>
                <div className="divider" />
                <div className="muted" style={{ fontSize: 12 }}>{t('seats')}</div>
                <div style={{ fontWeight: 700 }}>{result.seatNumber || t('none')}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('amount')}</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(result.amount)}</div>
              </div>
            </>
          ) : (
            <Empty icon={ScanLine} title={t('waitingPassengers')} text={t('validate')} />
          )}
          {tripId && <div style={{ marginTop: 16 }}><Link className="btn btn-block" to={`/driver/missions/${tripId}`}>{t('back')}</Link></div>}
        </div>
      </div>
    </>
  );
}
