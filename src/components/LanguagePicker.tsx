import { Globe2 } from 'lucide-react';
import { useApp } from '../lib/context';
import { LANGUAGES } from '../i18n';

/** Sélecteur de langue, à placer uniquement dans les paramètres. */
export function LanguagePicker() {
  const { lang, setLanguage, t } = useApp();
  return (
    <label className="lang-picker" title={t('language')}>
      <Globe2 size={16} />
      <select value={lang} onChange={(e) => setLanguage(e.target.value as typeof lang)} aria-label={t('language')}>
        {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
    </label>
  );
}
