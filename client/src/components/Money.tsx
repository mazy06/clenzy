import type { CSSProperties } from 'react';
import { SaudiRiyal, MoroccanDirham } from '../icons';
import { useCurrency } from '../hooks/useCurrency';
import { CURRENCY_OPTIONS, currencyDisplayPart } from '../utils/currencyUtils';

/**
 * Devises sans glyphe Unicode rendu par les polices : le riyal saoudien (SAR)
 * et le dirham marocain (MAD) s'affichent en ICÔNE, jamais en code « SAR »/« MAD ».
 * L'euro (et tout autre code) reste son symbole textuel.
 */
const ICON_CURRENCIES = new Set(['SAR', 'MAD']);

/**
 * Le `sx` historique n'a jamais servi qu'a detacher le glyphe du montant. On
 * garde le nom de prop (des appelants hors de ce fichier le passent) mais on le
 * ramene a un style React, en tolerant le raccourci MUI `ml` : recopie tel quel
 * dans un `style`, `ml` serait ignore EN SILENCE et la marge disparaitrait.
 */
type SymbolStyle = CSSProperties & { ml?: string | number };

function toStyle(sx?: SymbolStyle): CSSProperties {
  if (!sx) return {};
  const { ml, ...rest } = sx;
  return ml == null ? rest : { marginInlineStart: ml, ...rest };
}

interface CurrencySymbolProps {
  /** Code ISO de la devise à symboliser. */
  code: string;
  /** Taille de l'icône en px (ignoré pour les symboles textuels). */
  size?: number;
  sx?: SymbolStyle;
}

/** Symbole d'une devise : icône pour SAR/MAD, texte (€…) sinon. */
export function CurrencySymbol({ code, size = 13, sx }: CurrencySymbolProps) {
  if (code === 'SAR') {
    return (
      <span style={{ display: 'inline-flex', verticalAlign: '-0.12em', ...toStyle(sx) }}>
        <SaudiRiyal size={size} strokeWidth={2.25} aria-label="Riyal saoudien" />
      </span>
    );
  }
  if (code === 'MAD') {
    // Glyphe plus étroit que la moyenne → +2px pour un poids visuel équivalent.
    return (
      <span style={{ display: 'inline-flex', verticalAlign: '-0.12em', ...toStyle(sx) }}>
        <MoroccanDirham size={size + 2} aria-label="Dirham marocain" />
      </span>
    );
  }
  const meta = CURRENCY_OPTIONS.find((o) => o.code === code);
  return <>{meta?.symbol ?? code}</>;
}

interface MoneyProps {
  /** Montant à afficher (null/NaN → « — »). */
  value: number | null | undefined;
  /**
   * Devise SOURCE du montant. Omise → le montant est déjà dans la devise
   * d'affichage (aucune conversion). Renseignée → conversion vers l'affichage.
   */
  from?: string;
  /** Sans décimales (+ préfixe « ~ » si le montant a été converti). */
  compact?: boolean;
  /** Forcer un nombre de décimales (ignoré si `compact`). */
  decimals?: number;
  /** Taille de l'icône de symbole (SAR/MAD). */
  symbolSize?: number;
  /** Style appliqué à l'icône de symbole. */
  symbolSx?: SymbolStyle;
}

/**
 * Montant formaté (mêmes règles que `convertAndFormat`, préfixe de conversion
 * compris) dont le symbole SAR/MAD est rendu en ICÔNE.
 *
 * <p>La devise est retirée <b>là où `Intl` l'a mise</b>, et l'icône prend sa
 * place. Sa position n'est pas une constante : le français la suit
 * (« 1 234,50 SAR »), l'anglais la précède (« SAR 1,234.50 »), et l'arabe rend
 * un glyphe — « ‏1,234.50 ر.س.‏ » — où le code ISO n'apparaît même pas. Une
 * découpe qui présumait un suffixe en français faisait <b>disparaître le
 * montant</b> en anglais, et laissait le glyphe arabe à la place de l'icône.</p>
 */
export function Money({ value, from, compact, decimals, symbolSize = 13, symbolSx }: MoneyProps) {
  const { currency, convertAndFormat, renderAmount } = useCurrency();
  if (value == null || Number.isNaN(value)) return <>—</>;
  if (renderAmount) return <>{renderAmount(value, { from, decimals: compact ? 0 : decimals, symbolSize })}</>;

  let s = convertAndFormat(value, from ?? currency);
  if (compact) s = s.replace(/[.,]\d+/g, '').replace(/^≈\s*/, '~');
  else if (decimals === 0) s = s.replace(/[.,]\d+/g, '');

  // Devise d'affichage à glyphe : l'icône remplace la devise à sa place. Si
  // celle-ci n'apparaît pas (taux indisponibles → montant rendu dans sa devise
  // source), on laisse la chaîne telle quelle.
  if (ICON_CURRENCIES.has(currency)) {
    const token = currencyDisplayPart(currency);
    const at = s.lastIndexOf(token);
    if (at >= 0) {
      // Espaces insécables et marques de direction que `Intl` colle autour de
      // la devise : sans ce nettoyage, l'icône hériterait d'un blanc double.
      const before = s.slice(0, at).replace(/[\s\u00a0\u202f\u200e\u200f]+$/u, '');
      const after = s.slice(at + token.length).replace(/^[\s\u00a0\u202f\u200e\u200f]+/u, '');
      return (
        <>
          {before}
          <CurrencySymbol
            code={currency}
            size={symbolSize}
            sx={before ? { ml: '3px', ...symbolSx } : { marginInlineEnd: '3px', ...symbolSx }}
          />
          {after}
        </>
      );
    }
  }
  return <>{s}</>;
}
