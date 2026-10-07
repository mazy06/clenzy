/**
 * Dynamic currency formatting — multi-currency support.
 *
 * <p>Remplace le `new Intl.NumberFormat('fr-FR', { currency: 'EUR' })` code en
 * dur par un utilitaire qui respecte la devise reelle de chaque entite ET la
 * langue active : separateurs, place du symbole et sens de lecture changent
 * d'une langue a l'autre.</p>
 *
 * <p><b>Chiffres latins en arabe</b> (`-nu-latn`, cf. `localeDate`) : les
 * montants s'alignent sur des chiffres tabulaires, a cote de quantiemes qui
 * sortent eux aussi en latin.</p>
 */
import i18n from '../i18n/config';
import { intlLocale } from './localeDate';

/** Etiquette `Intl` de la langue active. */
function activeLocale(): string {
  return intlLocale(i18n.language);
}

/**
 * Options `Intl` communes a tout montant : on demande le SIGNE de la devise,
 * jamais son code ISO.
 *
 * <p>`narrowSymbol` donne « € » et « $ » la ou le defaut rendrait « EUR » et
 * « US$ ». En arabe, il donne aussi « ر.س. » et « د.م. ». En francais et en
 * anglais, en revanche, `Intl` n'a pas de symbole pour SAR ni MAD et retombe
 * sur le code — c'est la que `Money` prend le relais avec une ICONE (cf.
 * `components/Money.tsx`) : le symbole officiel du riyal (U+20C1) et celui du
 * dirham n'existent dans aucune police courante.</p>
 */
const SIGN_DISPLAY = { currencyDisplay: 'narrowSymbol' } as const;

const FRACTION_PATTERNS = new Map<string, RegExp>();

/** Remove only the locale's decimal fraction, never its thousands separator. */
export function stripCurrencyFraction(formatted: string, locale = activeLocale()): string {
  let pattern = FRACTION_PATTERNS.get(locale);
  if (!pattern) {
    const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
    const escaped = decimal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(`${escaped}\\p{Number}+`, 'u');
    FRACTION_PATTERNS.set(locale, pattern);
  }
  return formatted.replace(pattern, '');
}

/**
 * Le SIGNE de la devise tel qu'il sera rendu dans un montant — « € », « ر.س. »,
 * ou le code ISO quand `Intl` n'a pas mieux a proposer.
 *
 * <p>Source unique : `formatCurrency` s'en sert pour composer le montant, et
 * `Money` pour retrouver le fragment a remplacer par son icone. Deux
 * definitions paralleles auraient fini par diverger, et l'icone n'aurait plus
 * trouve sa place.</p>
 */
export function currencySign(currency: string, locale: string = activeLocale()): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...SIGN_DISPLAY,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Format an amount with the specified currency.
 * Defaults to EUR if no currency is provided.
 *
 * @param amount  The numeric amount
 * @param currency  ISO 4217 currency code (EUR, MAD, SAR, USD, etc.)
 * @param locale  BCP 47 locale — celle de la langue active par defaut
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'EUR',
  locale: string = activeLocale(),
): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...SIGN_DISPLAY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if the currency code is invalid
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// Memorise par locale : construire un `Intl.NumberFormat` coute cher, et un
// seul objet de module resterait fige sur la langue du chargement.
const TAX_RATE_FORMATS = new Map<string, Intl.NumberFormat>();

function taxRateFormat(): Intl.NumberFormat {
  const locale = activeLocale();
  let format = TAX_RATE_FORMATS.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    TAX_RATE_FORMATS.set(locale, format);
  }
  return format;
}

/**
 * Format a tax rate as a percentage.
 * Input: 0.10 → "10 %", 0.20 → "20 %"
 */
export function formatTaxRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return taxRateFormat().format(rate);
}

/**
 * Comment `Intl` rend la DEVISE dans une langue donnée — « SAR » en français,
 * « ر.س.‏ » en arabe, « € » partout.
 *
 * <p>C'est ce fragment, et lui seul, qu'un appelant peut retirer d'un montant
 * déjà formaté pour lui substituer autre chose (une icône, par exemple).
 * Chercher le code ISO en dur n'y suffit pas : l'arabe rend un glyphe, et
 * l'anglais place le code AVANT le nombre au lieu de le suivre.</p>
 */
export function currencyDisplayPart(currency: string, locale: string = activeLocale()): string {
  return currencySign(currency, locale);
}

/**
 * Signe d'une devise, pour un contexte de CHAINE (libelle de champ, suffixe
 * « /h », export). En composant, preferer `<CurrencySymbol>` : lui rend une
 * icone la ou aucune police n'a de glyphe.
 */
export function getCurrencySymbol(currency: string = 'EUR', locale: string = activeLocale()): string {
  return currencySign(currency, locale);
}

/**
 * Common currency options for select dropdowns.
 */
export const CURRENCY_OPTIONS = [
  // `label` est un REPLI : a l'ecran, passer par `t('currencies.<code>')` — la
  // liste restait en francais sous une interface arabe. Le libelle ne porte
  // PAS le code ISO : le signe est deja rendu a cote de lui.
  // `symbol` en est un aussi : SAR et MAD s'affichent via l'icone de
  // `<CurrencySymbol>`, faute de glyphe dans les polices.
  { code: 'EUR', label: 'Euro', symbol: '\u20AC' },
  { code: 'MAD', label: 'Dirham marocain', symbol: 'MAD' },
  { code: 'SAR', label: 'Riyal saoudien', symbol: 'SAR' },
] as const;

/**
 * Country options for fiscal profile.
 */
// Meme regle que ci-dessus : `label` est un repli, `t('countries.<code>')`
// est la source d'affichage.
export const COUNTRY_OPTIONS = [
  { code: 'FR', label: 'France' },
  { code: 'MA', label: 'Maroc' },
  { code: 'SA', label: 'Arabie Saoudite' },
] as const;
