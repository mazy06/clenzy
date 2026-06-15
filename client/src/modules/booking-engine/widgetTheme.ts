import type { BaitlyTheme } from './sdk/types';
import type { DesignTokens } from '../../services/api/bookingEngineApi';

/**
 * Mappe les design tokens (preset/template/édition Thème) vers le thème du widget de réservation.
 * Source unique partagée par la page publique ET l'aperçu « Réservation » du Studio, pour que le
 * widget soit rendu à l'identique dans les deux contextes. Hors du SDK (qui reste autonome) :
 * c'est de la colle app ↔ widget.
 */
export function widgetThemeFromTokens(
  primaryColor: string,
  fontFamily: string | null | undefined,
  t: DesignTokens | null,
): BaitlyTheme {
  return {
    primaryColor: t?.primaryColor || primaryColor,
    fontFamily: t?.bodyFontFamily || fontFamily || undefined,
    borderRadius: t?.borderRadius || undefined,
    shadow: t?.boxShadow || t?.cardShadow || undefined,
    backgroundColor: t?.backgroundColor || undefined,
    surfaceColor: t?.surfaceColor || undefined,
    borderColor: t?.borderColor || undefined,
    textColor: t?.textColor || undefined,
    textSecondaryColor: t?.textSecondaryColor || undefined,
    fontSize: t?.baseFontSize || undefined,
    density: (t?.spacing as 'compact' | 'normal' | 'spacious') || undefined,
    buttonStyle: (t?.buttonStyle as 'filled' | 'outlined') || undefined,
  };
}
