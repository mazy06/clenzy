import { Fragment, type ReactNode } from 'react';
import { SaudiRiyal } from 'lucide-react';
import { MoroccanDirham } from '../../src/icons';
import type { SiteLanguage } from '../lib/siteLanguage';
import {
  CURRENCY_NAMES,
  convertDemoMoney,
  useSiteCurrency,
  type SiteCurrency,
} from '../lib/siteCurrency';
import '../site-money.css';

const numberFormats = new Map<string, Intl.NumberFormat>();
function formatNumber(value: number, language: SiteLanguage, decimals: number) {
  const key = `${language}-${decimals}`;
  if (!numberFormats.has(key))
    numberFormats.set(
      key,
      new Intl.NumberFormat(`${language}-u-nu-latn`, {
        maximumFractionDigits: decimals,
      }),
    );
  return numberFormats.get(key)!.format(value);
}

export function SiteCurrencySymbol({
  currency,
  language,
  size,
}: {
  currency: SiteCurrency;
  language?: SiteLanguage;
  size?: number;
}) {
  const { language: currentLanguage } = useSiteCurrency();
  const Icon = currency === 'MAD' ? MoroccanDirham : SaudiRiyal;
  return (
    <span
      className="site-currency-symbol"
      role="img"
      aria-label={CURRENCY_NAMES[language ?? currentLanguage][currency]}
      style={size ? { fontSize: size } : undefined}
    >
      {currency === 'EUR' ? '€' : <Icon aria-hidden="true" size="1em" />}
    </span>
  );
}
export function moneyLabel(
  value: number,
  from: SiteCurrency,
  to: SiteCurrency,
  language: SiteLanguage,
  decimals = 2,
) {
  const amount = convertDemoMoney(value, from, to);
  return `${formatNumber(amount, language, decimals)} ${CURRENCY_NAMES[language][to]}`;
}
export default function SiteMoney({
  value,
  from = 'EUR',
  currency,
  language: lang,
  decimals = 2,
  symbol = true,
  size,
}: {
  value: number;
  from?: SiteCurrency;
  currency?: SiteCurrency;
  language?: SiteLanguage;
  decimals?: number;
  symbol?: boolean;
  size?: number;
}) {
  const { currency: rotating } = useSiteCurrency();
  const { language: currentLanguage } = useSiteCurrency();
  const language = lang ?? currentLanguage;
  const target = currency ?? rotating ?? from;
  const amount = convertDemoMoney(value, from, target);
  const number = formatNumber(amount, language, decimals);
  return (
    <span
      className="site-money"
      data-currency={target}
      data-amount={amount}
      aria-label={moneyLabel(value, from, target, language, decimals)}
    >
      <span
        className="site-money-motion"
        key={target}
        aria-hidden="true"
        dir="ltr"
      >
        {number}
        {symbol && (
          <SiteCurrencySymbol
            currency={target}
            language={language}
            size={size}
          />
        )}
      </span>
    </span>
  );
}
export function useSiteMoney(
  from: SiteCurrency = 'EUR',
  language?: SiteLanguage,
  fixed?: SiteCurrency,
) {
  const { currency } = useSiteCurrency();
  const { language: currentLanguage } = useSiteCurrency();
  const lang = language ?? currentLanguage;
  const render = (value: number) => (
    <SiteMoney value={value} from={from} currency={fixed} language={lang} />
  );
  render.label = (value: number) =>
    moneyLabel(value, from, fixed ?? currency ?? from, lang);
  return render;
}
export type SiteMoneyFormatter = ReturnType<typeof useSiteMoney>;

// Localized editorial strings only. Never transforms DOM, forms, IDs or percentages.
const MONEY_PATTERN =
  /(?:(MAD|SAR|EUR|€)\s*([−+-]?\d(?:[\d\s\u00a0\u202f,٬]*\d)?(?:\.\d+)?))|([−+-]?\d(?:[\d\s\u00a0\u202f,٬]*\d)?(?:\.\d+)?)\s*(MAD|SAR|EUR|€|ر\.س)/g;
export function SiteMoneyText({
  children,
  language,
}: {
  children: string;
  language?: SiteLanguage;
}) {
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of children.matchAll(MONEY_PATTERN)) {
    const token = match[1] ?? match[4];
    const raw = (match[2] ?? match[3]).trim();
    const number = Number(
      raw
        .replace(/[\s\u00a0\u202f٬]/g, '')
        .replace(/−/, '-')
        .replace(/,(?=\d{3}(?:\D|$))/g, '')
        .replace(',', '.'),
    );
    if (!Number.isFinite(number)) continue;
    parts.push(children.slice(end, match.index));
    const from: SiteCurrency =
      token === '€' || token === 'EUR'
        ? 'EUR'
        : token.startsWith('ر') || token === 'SAR'
          ? 'SAR'
          : 'MAD';
    parts.push(
      <Fragment key={match.index}>
        {raw.startsWith('+') ? '+' : ''}
        <SiteMoney value={number} from={from} language={language} />
      </Fragment>,
    );
    end = match.index! + match[0].length;
  }
  parts.push(children.slice(end));
  return <>{parts}</>;
}
