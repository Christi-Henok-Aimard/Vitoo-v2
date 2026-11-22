import { useEffect, useRef, useState } from 'react';
import { Download, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { useApp } from '../lib/context';
import type { TranslationKey } from '../i18n';
import { companyName, formatDate, formatMoney, tripStops } from '../lib/format';
import { StatusBadge } from '../lib/ui';
import { kbrAppearance, type KbrHandle } from './kbr';
import type { Ticket, Trip } from '../types';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ticketLines(ticket: Ticket, tr: (key: TranslationKey) => string, trip?: Trip | null): string[] {
  const d = trip || ticket.trip;
  return [
    `${tr('company')} : ${d ? companyName(d) : 'Vitoo'}`,
    `${tr('tripDetail')} : ${d?.depart || '?'} → ${d?.arrivee || '?'}`,
    `${tr('date')} : ${formatDate(d?.date)} · ${d?.time || '—'}`,
    `${tr('passenger')} : ${ticket.passengerName || '—'}`,
    `${tr('phone')} : ${ticket.passengerPhone || '—'}`,
    `${tr('yourSeat')} : ${ticket.seatNumber || '—'}`,
    `${tr('amount')} : ${formatMoney(ticket.amount)}`,
    `${tr('paymentMethods')} : ${ticket.paymentMethod || '—'}`,
    `${tr('code')} : ${ticket.code}`,
  ];
}

/** Copie le code via le composant KBR et conserve les notifications de l'app. */
function KbrCopy({ value, appearance }: { value: string; appearance: 'light' | 'dark' }) {
  const { toast, t } = useApp();
  const ref = useRef<KbrHandle | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCopied = () => toast(t('copied'), 'success');
    const onFailed = () => toast(t('error'), 'error');
    el.addEventListener('copy', onCopied);
    el.addEventListener('fail', onFailed);
    return () => {
      el.removeEventListener('copy', onCopied);
      el.removeEventListener('fail', onFailed);
    };
  }, [toast, t]);
  return (
    <copy-button
      ref={ref}
      value={value}
      label={t('copy')}
      done-label={t('copied')}
      fail-label={t('error')}
      show-value="false"
      mono="true"
      appearance={appearance}
    />
  );
}

export function TicketCard({ ticket, trip }: { ticket: Ticket; trip?: Trip | null }) {
  const { theme, toast, t } = useApp();
  const [qr, setQr] = useState('');
  const tripInfo = trip || ticket.trip;
  const appearance = kbrAppearance(theme);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(ticket.qrData || ticket.code, { width: 320, margin: 1 })
      .then((url) => active && setQr(url))
      .catch(() => undefined);
    return () => { active = false; };
  }, [ticket.code, ticket.qrData]);

  const print = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast(t('error'), 'error');
      return;
    }
    const lines = ticketLines(ticket, t, tripInfo).map((l) => `<div style="margin:4px 0">${esc(l)}</div>`).join('');
    win.document.write(`<!doctype html><html><head><title>${t('ticket')} ${esc(ticket.code)}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}h1{color:#1d5df5} .box{border:2px dashed #1d5df5;border-radius:12px;padding:20px;margin-top:16px;display:flex;gap:24px;align-items:center} img{width:150px;height:150px}@media print{.no{display:none}}</style>
      </head><body><h1>VITOO — ${t('ticket')}</h1><div class="box"><img src="${qr}" alt="${t('showQr')}" /><div>${lines}</div></div>
      <p class="no" style="margin-top:16px"><button onclick="window.print()">${t('print')}</button></p></body></html>`);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 400);
  };

  const pdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(29, 93, 245);
    doc.text(`VITOO - ${t('ticket')}`, 16, 20);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    ticketLines(ticket, t, tripInfo).forEach((line, i) => doc.text(line, 16, 34 + i * 8));
    if (qr) doc.addImage(qr, 'PNG', 16, 115, 55, 55);
    doc.setFontSize(10);
    doc.text(t('presentTicket'), 16, 185);
    doc.save(`ticket-${ticket.code}.pdf`);
  };

  return (
    <div className="ticket-paper">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>VITOO</div>
          <div className="muted" style={{ fontSize: 12 }}>{tripInfo ? companyName(tripInfo) : t('ticket')}</div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="kbr-ticket-wrap">
        <tear-ticket
          kicker={tripInfo ? companyName(tripInfo) : 'Vitoo'}
          title={`${tripInfo?.depart || '?'} → ${tripInfo?.arrivee || '?'}`}
          venue={tripInfo?.station ? `${t('station')} ${tripInfo.station}` : `${t('ticket')} Vitoo`}
          label-1={t('date')}
          value-1={formatDate(tripInfo?.date)}
          label-2={t('departure')}
          value-2={tripInfo?.time || '—'}
          label-3={t('yourSeat')}
          value-3={ticket.seatNumber || '—'}
          label-4={t('passenger')}
          value-4={ticket.passengerName || '—'}
          admit={t('validate')}
          seat={ticket.seatNumber || '—'}
          serial={`${t('ticket')} ${ticket.code}`}
          code="false"
          width="330"
          appearance={appearance}
        />
      </div>

      <div className="divider" />

      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', padding: 8, borderRadius: 10, border: '1px solid var(--border)', lineHeight: 0 }}>
          {qr ? <img src={qr} alt={`${t('showQr')} ${t('ticket')}`} width={112} height={112} /> : <QrCode size={112} />}
        </div>
        <div style={{ minWidth: 180, flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{tripInfo?.depart || '?'} <span style={{ color: 'var(--primary)' }}>→</span> {tripInfo?.arrivee || '?'}</div>
          <div className="muted" style={{ fontSize: 13 }}>{formatDate(tripInfo?.date)} · {tripInfo?.time || '—'}</div>
          {tripInfo?.station && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('station')} {tripInfo.station}</div>}
          {tripStops(tripInfo).length > 0 && <div className="muted" style={{ fontSize: 12 }}>{t('stops')} : {tripStops(tripInfo).join(' · ')}</div>}
          <div style={{ marginTop: 8 }}>
            <span className="chip">{ticket.passengerName || t('passenger')}</span>{' '}
            {ticket.seatNumber && <span className="chip">{t('yourSeat')} {ticket.seatNumber}</span>}
          </div>
        </div>
      </div>

      <div className="divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>{t('ticketCode')}</div>
          <div style={{ fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.06em', fontSize: 15 }}>{ticket.code}</div>
          <div className="muted" style={{ fontSize: 12 }}>{formatMoney(ticket.amount)} · {ticket.paymentMethod || t('cash')}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <KbrCopy value={ticket.code} appearance={appearance} />
          <button className="btn btn-sm" onClick={print}><Printer size={14} /> {t('print')}</button>
          <button className="btn btn-sm" onClick={pdf}><Download size={14} /> {t('downloadPdf')}</button>
        </div>
      </div>
    </div>
  );
}
