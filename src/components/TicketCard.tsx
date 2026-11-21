import { useEffect, useRef, useState } from 'react';
import { Download, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { useApp } from '../lib/context';
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

function ticketLines(ticket: Ticket, trip?: Trip | null): string[] {
  const t = trip || ticket.trip;
  return [
    `Compagnie : ${t ? companyName(t) : 'Vitoo'}`,
    `Trajet : ${t?.depart || '?'} → ${t?.arrivee || '?'}`,
    `Date : ${formatDate(t?.date)} à ${t?.time || '—'}`,
    `Passager : ${ticket.passengerName || '—'}`,
    `Téléphone : ${ticket.passengerPhone || '—'}`,
    `Place : ${ticket.seatNumber || '—'}`,
    `Montant : ${formatMoney(ticket.amount)}`,
    `Paiement : ${ticket.paymentMethod || '—'}`,
    `Code : ${ticket.code}`,
  ];
}

/** Copie le code via le composant KBR et conserve les notifications de l'app. */
function KbrCopy({ value, appearance }: { value: string; appearance: 'light' | 'dark' }) {
  const { toast } = useApp();
  const ref = useRef<KbrHandle | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCopied = () => toast('Code copié !', 'success');
    const onFailed = () => toast('Impossible de copier le code.', 'error');
    el.addEventListener('copy', onCopied);
    el.addEventListener('fail', onFailed);
    return () => {
      el.removeEventListener('copy', onCopied);
      el.removeEventListener('fail', onFailed);
    };
  }, [toast]);
  return (
    <copy-button
      ref={ref}
      value={value}
      label="Copier"
      done-label="Copié"
      fail-label="Échec"
      show-value="false"
      mono="true"
      appearance={appearance}
    />
  );
}

export function TicketCard({ ticket, trip }: { ticket: Ticket; trip?: Trip | null }) {
  const { theme, toast } = useApp();
  const [qr, setQr] = useState('');
  const t = trip || ticket.trip;
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
      toast('Autorisez les fenêtres pop-up pour imprimer.', 'error');
      return;
    }
    const lines = ticketLines(ticket, t).map((l) => `<div style="margin:4px 0">${esc(l)}</div>`).join('');
    win.document.write(`<!doctype html><html><head><title>Billet ${esc(ticket.code)}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}h1{color:#1d5df5} .box{border:2px dashed #1d5df5;border-radius:12px;padding:20px;margin-top:16px;display:flex;gap:24px;align-items:center} img{width:150px;height:150px}@media print{.no{display:none}}</style>
      </head><body><h1>VITOO — Billet de voyage</h1><div class="box"><img src="${qr}" alt="QR code" /><div>${lines}</div></div>
      <p class="no" style="margin-top:16px"><button onclick="window.print()">Imprimer</button></p></body></html>`);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 400);
  };

  const pdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(29, 93, 245);
    doc.text('VITOO - Billet de voyage', 16, 20);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    ticketLines(ticket, t).forEach((line, i) => doc.text(line, 16, 34 + i * 8));
    if (qr) doc.addImage(qr, 'PNG', 16, 115, 55, 55);
    doc.setFontSize(10);
    doc.text('Presentez ce billet (QR ou code) au chauffeur.', 16, 185);
    doc.save(`billet-${ticket.code}.pdf`);
  };

  return (
    <div className="ticket-paper">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>VITOO</div>
          <div className="muted" style={{ fontSize: 12 }}>{t ? companyName(t) : 'Billet de voyage'}</div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="kbr-ticket-wrap">
        <tear-ticket
          kicker={t ? companyName(t) : 'Vitoo'}
          title={`${t?.depart || '?'} → ${t?.arrivee || '?'}`}
          venue={t?.station ? `Gare de ${t.station}` : 'Billet de voyage Vitoo'}
          label-1="Date"
          value-1={formatDate(t?.date)}
          label-2="Départ"
          value-2={t?.time || '—'}
          label-3="Place"
          value-3={ticket.seatNumber || '—'}
          label-4="Passager"
          value-4={ticket.passengerName || '—'}
          admit="Admettre"
          seat={ticket.seatNumber || '—'}
          serial={`Billet ${ticket.code}`}
          code="false"
          width="330"
          appearance={appearance}
        />
      </div>

      <div className="divider" />

      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', padding: 8, borderRadius: 10, border: '1px solid var(--border)', lineHeight: 0 }}>
          {qr ? <img src={qr} alt="QR code du billet" width={112} height={112} /> : <QrCode size={112} />}
        </div>
        <div style={{ minWidth: 180, flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{t?.depart || '?'} <span style={{ color: 'var(--primary)' }}>→</span> {t?.arrivee || '?'}</div>
          <div className="muted" style={{ fontSize: 13 }}>{formatDate(t?.date)} · {t?.time || '—'}</div>
          {t?.station && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Gare : {t.station}</div>}
          {tripStops(t).length > 0 && <div className="muted" style={{ fontSize: 12 }}>Escales : {tripStops(t).join(' · ')}</div>}
          <div style={{ marginTop: 8 }}>
            <span className="chip">{ticket.passengerName || 'Passager'}</span>{' '}
            {ticket.seatNumber && <span className="chip">Place {ticket.seatNumber}</span>}
          </div>
        </div>
      </div>

      <div className="divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>Code du billet</div>
          <div style={{ fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.06em', fontSize: 15 }}>{ticket.code}</div>
          <div className="muted" style={{ fontSize: 12 }}>{formatMoney(ticket.amount)} · {ticket.paymentMethod || 'Espèces'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <KbrCopy value={ticket.code} appearance={appearance} />
          <button className="btn btn-sm" onClick={print}><Printer size={14} /> Imprimer</button>
          <button className="btn btn-sm" onClick={pdf}><Download size={14} /> PDF</button>
        </div>
      </div>
    </div>
  );
}
