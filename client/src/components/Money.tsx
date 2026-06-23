import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { SaudiRiyal, MoroccanDirham } from '../icons';
import { useCurrency } from '../hooks/useCurrency';
import { CURRENCY_OPTIONS } from '../utils/currencyUtils';

/**
 * Devises sans glyphe Unicode rendu par les polices : le riyal saoudien (SAR)
 * et le dirham marocain (MAD) s'affichent en ICÔNE, jamais en code « SAR »/« MAD ».
 * L'euro (et tout autre code) reste son symbole textuel.
 */
const ICON_CURRENCIES = new Set(['SAR', 'MAD']);

interface CurrencySymbolProps {
  /** Code ISO de la devise à symboliser. */
  code: string;
  /** Taille de l'icône en px (ignoré pour les symboles textuels). */
  size?: number;
  sx?: SxProps<Theme>;
}

/** Symbole d'une devise : icône pour SAR/MAD, texte (€…) sinon. */
export function CurrencySymbol({ code, size = 13, sx }: CurrencySymbolProps) {
  if (code === 'SAR') {
    return (
      <Box component="span" sx={{ display: 'inline-flex', verticalAlign: '-0.12em', ...sx }}>
        <SaudiRiyal size={size} strokeWidth={2.25} aria-label="Riyal saoudien" />
      </Box>
    );
  }
  if (code === 'MAD') {
    return (
      <Box component="span" sx={{ display: 'inline-flex', verticalAlign: '-0.12em', ...sx }}>
        {/* Glyphe plus étroit que la moyenne → +2px pour un poids visuel équivalent. */}
        <MoroccanDirham size={size + 2} aria-label="Dirham marocain" />
      </Box>
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
  /** sx appliqué à l'icône de symbole. */
  symbolSx?: SxProps<Theme>;
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
      const head = s.slice(0, i).replace(/[\s ]+$/, '');
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
