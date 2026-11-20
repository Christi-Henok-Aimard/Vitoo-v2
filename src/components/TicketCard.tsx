import { useEffect, useState } from 'react';
import { Check, Copy, Download, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { useApp } from '../lib/context';
import { companyName, formatDate, formatMoney, tripStops } from '../lib/format';
import { StatusBadge } from '../lib/ui';
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

export function TicketCard({ ticket, trip }: { ticket: Ticket; trip?: Trip | null }) {
  const { toast } = useApp();
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const t = trip || ticket.trip;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(ticket.qrData || ticket.code, { width: 320, margin: 1 })
      .then((url) => active && setQr(url))
      .catch(() => undefined);
    return () => { active = false; };
  }, [ticket.code, ticket.qrData]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ticket.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast('Code copié !', 'success');
    } catch {
      toast('Impossible de copier le code.', 'error');
    }
  };

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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => void copy()}>
            {copied ? <Check size={14} /> : <Copy size={14} />} Copier
          </button>
          <button className="btn btn-sm" onClick={print}><Printer size={14} /> Imprimer</button>
          <button className="btn btn-sm" onClick={pdf}><Download size={14} /> PDF</button>
        </div>
      </div>
    </div>
  );
}
