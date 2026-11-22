import { useEffect, useRef, useState } from 'react';
import { Download, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { useApp } from '../lib/context';
import type { TranslationKey } from '../i18n';
import { companyName as companyNameOf, formatDate, formatMoney, tripStops } from '../lib/format';
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
    `${tr('company')} : ${d ? companyNameOf(d) : 'Vitoo'}`,
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

export function TicketCard({
  ticket,
  trip,
  companyName,
  companyLogo,
}: {
  ticket: Ticket;
  trip?: Trip | null;
  /** Nom et logo de la compagnie à afficher (sinon déduits du trajet / de la session). */
  companyName?: string;
  companyLogo?: string | null;
}) {
  const { theme, toast, t, companySession } = useApp();
  const [qr, setQr] = useState('');
  const tripInfo = trip || ticket.trip;
  const appearance = kbrAppearance(theme);

  // On n'affiche que les données réelles : compagnie du trajet, puis session compagnie en repli.
  const tripCompany = tripInfo?.company;
  const tripLogo = tripCompany && typeof tripCompany !== 'string' ? tripCompany.logo || '' : '';
  const fromTrip = tripInfo ? companyNameOf(tripInfo) : '';
  const brandName = companyName?.trim()
    || (fromTrip && fromTrip !== 'Vitoo' ? fromTrip : '')
    || companySession?.user.companyName
    || 'Vitoo';
  const brandLogo = companyLogo?.trim() || tripLogo || companySession?.user.companyLogo || '';

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
      <style>
        @page{size:A4 landscape;margin:12mm}
        body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}
        h1{color:#1d5df5;font-size:20px;margin:0}
        .box{border:2px dashed #1d5df5;border-radius:12px;padding:16px;margin-top:12px;display:flex;gap:20px;align-items:center}
        img{width:120px;height:120px}
        @media print{.no{display:none}}
      </style>
      </head><body><h1>${esc(brandName)} — ${t('ticket')}</h1><div class="box"><img src="${qr}" alt="${t('showQr')}" /><div>${lines}</div></div>
      <p class="no" style="margin-top:14px"><button onclick="window.print()">${t('print')}</button></p></body></html>`);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 400);
  };

  const pdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.setTextColor(29, 93, 245);
    doc.text(`${brandName} - ${t('ticket')}`, 16, 18);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    ticketLines(ticket, t, tripInfo).forEach((line, i) => doc.text(line, 16, 32 + i * 8));
    if (qr) doc.addImage(qr, 'PNG', 215, 28, 50, 50);
    doc.setFontSize(10);
    doc.text(t('presentTicket'), 16, 122);
    doc.save(`ticket-${ticket.code}.pdf`);
  };

  return (
    <div className="ticket-paper">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {brandLogo && (
            <img src={brandLogo} alt={brandName} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain', background: '#fff' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandName}</div>
            <div className="muted" style={{ fontSize: 11 }}>{t('ticket')}</div>
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Billet horizontal KBR : partie principale + talon avec code-barres. */}
      <div className="kbr-ticket-wrap">
        <tear-ticket-horizontal
          kicker={brandName}
          title={`${tripInfo?.depart || '?'} → ${tripInfo?.arrivee || '?'}`}
          venue={tripInfo?.station ? `${t('station')} ${tripInfo.station}` : `${t('ticket')} ${brandName}`}
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
          code="true"
          width="360"
          appearance={appearance}
        />
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', padding: 6, borderRadius: 8, border: '1px solid var(--border)', lineHeight: 0 }}>
          {qr ? <img src={qr} alt={`${t('showQr')} ${t('ticket')}`} width={92} height={92} /> : <QrCode size={92} />}
        </div>
        <div style={{ minWidth: 160, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{tripInfo?.depart || '?'} <span style={{ color: 'var(--primary)' }}>→</span> {tripInfo?.arrivee || '?'}</div>
          <div className="muted" style={{ fontSize: 12 }}>{formatDate(tripInfo?.date)} · {tripInfo?.time || '—'}</div>
          {tripInfo?.station && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{t('station')} {tripInfo.station}</div>}
          {tripStops(tripInfo).length > 0 && <div className="muted" style={{ fontSize: 12 }}>{t('stops')} : {tripStops(tripInfo).join(' · ')}</div>}
          <div style={{ marginTop: 6 }}>
            <span className="chip">{ticket.passengerName || t('passenger')}</span>{' '}
            {ticket.seatNumber && <span className="chip">{t('yourSeat')} {ticket.seatNumber}</span>}
          </div>
        </div>
      </div>

      <div className="divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>{t('ticketCode')}</div>
          <div style={{ fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.06em', fontSize: 14 }}>{ticket.code}</div>
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
