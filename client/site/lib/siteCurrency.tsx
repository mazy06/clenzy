import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSiteLanguage, type SiteLanguage } from './siteLanguage';

export const SITE_CURRENCIES = ['MAD', 'EUR', 'SAR'] as const;
export type SiteCurrency = (typeof SITE_CURRENCIES)[number];
export const CURRENCY_CYCLE_MS = 7000;
// Illustrative ratios for fictional marketing scenarios, never billing or live FX.
export const DEMO_CURRENCY_RATIOS = { EUR: 1, MAD: 10, SAR: 4 } as const;
export const CURRENCY_NAMES = {
  fr: { EUR: 'Euro', MAD: 'Dirham marocain', SAR: 'Riyal saoudien' },
  en: { EUR: 'Euro', MAD: 'Moroccan dirham', SAR: 'Saudi riyal' },
  ar: { EUR: 'يورو', MAD: 'درهم مغربي', SAR: 'ريال سعودي' },
} as const;
export function convertDemoMoney(
  value: number,
  from: SiteCurrency,
  to: SiteCurrency,
) {
  return (
    Math.round(
      (value / DEMO_CURRENCY_RATIOS[from]) * DEMO_CURRENCY_RATIOS[to] * 100,
    ) / 100
  );
}
type CurrencyState = {
  language: SiteLanguage;
  currency?: SiteCurrency;
  playing: boolean;
  reduced: boolean;
  select: (currency: SiteCurrency) => void;
  pause: () => void;
  toggle: () => void;
};
const noop = () => {};
const SiteCurrencyContext = createContext<CurrencyState>({
  language: 'fr',
  playing: false,
  reduced: false,
  select: noop,
  pause: noop,
  toggle: noop,
});
export const useSiteCurrency = () => useContext(SiteCurrencyContext);

export function SiteCurrencyProvider({ children }: { children: ReactNode }) {
  const { language } = useSiteLanguage();
  // Volatile presentation state; never modifies the PMS or a saved preference.
  const [currency, setCurrency] = useState<SiteCurrency>(() =>
    language === 'ar' ? 'SAR' : language === 'en' ? 'EUR' : 'MAD',
  );
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => startTransition(() => setReduced(media.matches));
    const visibility = () => startTransition(() => setHidden(document.hidden));
    motion();
    visibility();
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const playing = !paused && !reduced;
  useEffect(() => {
    if (!playing || hidden) return;
    const timer = window.setInterval(
      () =>
        setCurrency(
          (current) =>
            SITE_CURRENCIES[
              (SITE_CURRENCIES.indexOf(current) + 1) % SITE_CURRENCIES.length
            ],
        ),
      CURRENCY_CYCLE_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, hidden]);
  const value = useMemo(
    () => ({
      currency,
      playing,
      reduced,
      language,
      select: (next: SiteCurrency) => {
        setCurrency(next);
        setPaused(true);
      },
      pause: () => setPaused(true),
      toggle: () => setPaused((current) => !current),
    }),
    [currency, playing, reduced, language],
  );
  return (
    <SiteCurrencyContext.Provider value={value}>
      {children}
    </SiteCurrencyContext.Provider>
  );
}
