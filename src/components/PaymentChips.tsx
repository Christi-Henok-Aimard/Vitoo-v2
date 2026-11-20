import { Check } from 'lucide-react';
import { normalizeMethods, PAYMENT_METHODS } from '../paymentMethods';

/**
 * Grille de boutons toggles pour la liste fermée des moyens de paiement.
 * « Espèces » reste toujours actif.
 */
export function PaymentChips({
  value,
  onChange,
  label = 'Moyens de paiement',
}: {
  value: string[];
  onChange: (methods: string[]) => void;
  label?: string;
}) {
  const selected = normalizeMethods(value);

  const toggle = (method: string) => {
    const next = selected.includes(method)
      ? selected.filter((item) => item !== method)
      : [...selected, method];
    onChange(normalizeMethods(next));
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
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
              <span>{method}</span>
            </button>
          );
        })}
      </div>
      <span className="muted" style={{ fontSize: 11 }}>
        Actifs : {selected.join(', ')}
      </span>
    </div>
  );
}
