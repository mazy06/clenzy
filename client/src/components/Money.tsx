import type { CSSProperties } from 'react';
import { SaudiRiyal, MoroccanDirham } from '../icons';
import { useCurrency } from '../hooks/useCurrency';
import { CURRENCY_OPTIONS } from '../utils/currencyUtils';

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
 * Montant formaté (mêmes règles que `convertAndFormat` — locale fr-FR, préfixe
 * de conversion) dont le symbole SAR/MAD est rendu en icône. Le glyphe étant
 * toujours en suffixe (locale fr-FR fixe), on détache le code de fin et on le
 * remplace par l'icône ; les autres devises (€) restent inchangées.
 */
export function Money({ value, from, compact, decimals, symbolSize = 13, symbolSx }: MoneyProps) {
  const { currency, convertAndFormat } = useCurrency();
  if (value == null || Number.isNaN(value)) return <>—</>;

  let s = convertAndFormat(value, from ?? currency);
  if (compact) s = s.replace(/[.,]\d+/g, '').replace(/^≈\s*/, '~');
  else if (decimals === 0) s = s.replace(/[.,]\d+/g, '');

  // Devise d'affichage à glyphe : remplacer le code suffixe par l'icône. Si le
  // code n'apparaît pas (taux indisponibles → montant rendu dans sa devise
  // source), on laisse la chaîne telle quelle (repli identique à l'existant).
  if (ICON_CURRENCIES.has(currency)) {
    const i = s.lastIndexOf(currency);
    if (i >= 0) {
      const head = s.slice(0, i).replace(/[\s ]+$/, '');
      return (
        <>
          {head}
          <CurrencySymbol code={currency} size={symbolSize} sx={{ ml: '3px', ...symbolSx }} />
        </>
      );
    }
  }
  return <>{s}</>;
}
