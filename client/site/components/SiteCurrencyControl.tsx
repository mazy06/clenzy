import { PauseIcon, PlayIcon } from 'lucide-react';
import { useSiteLanguage } from '../lib/siteLanguage';
import {
  CURRENCY_NAMES,
  SITE_CURRENCIES,
  useSiteCurrency,
} from '../lib/siteCurrency';
import { SiteCurrencySymbol } from './SiteMoney';

const COPY = {
  fr: {
    label: 'Devises',
    pause: 'Mettre la rotation des devises en pause',
    play: 'Reprendre la rotation des devises',
    note: 'Conversions illustratives dans les démos. Les offres utilisent la grille de chaque marché.',
  },
  en: {
    label: 'Currencies',
    pause: 'Pause currency rotation',
    play: 'Resume currency rotation',
    note: 'Illustrative conversions in demos. Plans use each market’s pricing schedule.',
  },
  ar: {
    label: 'العملات',
    pause: 'إيقاف تبديل العملات مؤقتاً',
    play: 'استئناف تبديل العملات',
    note: 'تحويلات توضيحية في العروض. تعتمد الباقات أسعار كل سوق.',
  },
};
export default function SiteCurrencyControl() {
  const { language } = useSiteLanguage();
  const { currency, select, playing, toggle, reduced } = useSiteCurrency();
  const m = COPY[language];
  return (
    <div
      className="site-currency-control"
      role="group"
      aria-label={m.label}
      title={m.note}
    >
      <span className="site-currency-caption">{m.label}</span>
      {SITE_CURRENCIES.map((code) => (
        <button
          type="button"
          key={code}
          aria-label={CURRENCY_NAMES[language][code]}
          aria-pressed={currency === code}
          onClick={() => select(code)}
        >
          <SiteCurrencySymbol currency={code} />
        </button>
      ))}
      {!reduced && (
        <button
          type="button"
          className="site-currency-play"
          aria-label={playing ? m.pause : m.play}
          onClick={toggle}
        >
          {playing ? (
            <PauseIcon aria-hidden="true" />
          ) : (
            <PlayIcon aria-hidden="true" />
          )}
        </button>
      )}
      <span className="sr-only">{m.note}</span>
    </div>
  );
}
