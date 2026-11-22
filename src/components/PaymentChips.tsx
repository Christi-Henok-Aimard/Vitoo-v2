import { Check } from 'lucide-react';
import { normalizeMethods, paymentMethodLabel, PAYMENT_METHODS } from '../paymentMethods';
import { useApp } from '../lib/context';

/**
 * Grille de boutons toggles pour la liste fermée des moyens de paiement.
 * « Espèces » reste toujours actif.
 */
export function PaymentChips({
  value,
  onChange,
  label,
}: {
  value: string[];
  onChange: (methods: string[]) => void;
  label?: string;
}) {
  const { lang, t } = useApp();
  const selected = normalizeMethods(value);

  const toggle = (method: string) => {
    const next = selected.includes(method)
      ? selected.filter((item) => item !== method)
      : [...selected, method];
    onChange(normalizeMethods(next));
  };

  return (
    <div className="field">
      <span className="label">{label ?? t('paymentMethods')}</span>
      <div className="payment-chips">
        {PAYMENT_METHODS.map((method) => {
          const active = selected.includes(method);
          return (
            <button
              type="button"
              key={method}
              className={`payment-chip ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => toggle(method)}
            >
              {active && <Check size={13} />}
              <span>{paymentMethodLabel(method, lang)}</span>
            </button>
          );
        })}
      </div>
      <span className="muted" style={{ fontSize: 11 }}>
        {t('active')} : {selected.map((m) => paymentMethodLabel(m, lang)).join(', ')}
      </span>
    </div>
  );
}
