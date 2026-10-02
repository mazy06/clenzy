import { SaudiRiyal, MoroccanDirham } from '../../icons';
import { useCurrency } from '../../hooks/currencyDisplayContext';
import { CURRENCY_OPTIONS, currencyDisplayPart } from '../../utils/currencyUtils';

/**
 * Baitly — remaster de components/Money.tsx : même logique devise
 * (useCurrency, conversion, glyphes SAR/MAD en icône), rendu sans MUI
 * (spans + tabular-nums).
 */
const ICON_CURRENCIES = new Set(['SAR', 'MAD']);

export interface CurrencySymbolProps {
  code: string;
  size?: number;
  className?: string;
}

export function CurrencySymbol({ code, size = 13, className }: CurrencySymbolProps) {
  if (code === 'SAR') {
    return (
      <span className={className} style={{ display: 'inline-flex', verticalAlign: '-0.12em' }}>
        <SaudiRiyal size={size} aria-label="Riyal saoudien" />
      </span>
    );
  }
  if (code === 'MAD') {
    return (
      <span className={className} style={{ display: 'inline-flex', verticalAlign: '-0.12em' }}>
        {/* Glyphe plus étroit que la moyenne → +2px pour un poids visuel équivalent. */}
        <MoroccanDirham size={size + 2} aria-label="Dirham marocain" />
      </span>
    );
  }
  const meta = CURRENCY_OPTIONS.find((o) => o.code === code);
  return <>{meta?.symbol ?? code}</>;
}

export interface MoneyProps {
  /** Montant à afficher (null/NaN → « — »). */
  value: number | null | undefined;
  /** Devise SOURCE. Omise → montant déjà dans la devise d'affichage. */
  from?: string;
  /** Sans décimales (+ préfixe « ~ » si converti). */
  compact?: boolean;
  decimals?: number;
  symbolSize?: number;
}

export function Money({ value, from, compact, decimals, symbolSize = 13 }: MoneyProps) {
  const { currency, convertAndFormat, renderAmount } = useCurrency();
  if (value == null || Number.isNaN(value)) return <>—</>;
  if (renderAmount) return <>{renderAmount(value, { from, decimals: compact ? 0 : decimals, symbolSize })}</>;

  let s = convertAndFormat(value, from ?? currency);
  if (compact) s = s.replace(/[.,]\d+/g, '').replace(/^≈\s*/, '~');
  else if (decimals === 0) s = s.replace(/[.,]\d+/g, '');

  // L'icône remplace la devise LÀ OÙ `Intl` l'a mise : suffixe en français,
  // préfixe en anglais, glyphe arabe où le code ISO n'apparaît pas. Cf. le
  // commentaire de `components/Money.tsx`.
  if (ICON_CURRENCIES.has(currency)) {
    const token = currencyDisplayPart(currency);
    const at = s.lastIndexOf(token);
    if (at >= 0) {
      const before = s.slice(0, at).replace(/[\s\u00a0\u202f\u200e\u200f]+$/u, '');
      const after = s.slice(at + token.length).replace(/^[\s\u00a0\u202f\u200e\u200f]+/u, '');
      return (
        <span className="tabular-nums">
          {before}
          <CurrencySymbol
            code={currency}
            size={symbolSize}
            className={before ? 'ms-[3px]' : 'me-[3px]'}
          />
          {after}
        </span>
      );
    }
  }
  return <span className="tabular-nums">{s}</span>;
}
