import { createTheme, type Theme } from '@mui/material/styles';
import lightTheme from './theme';
import darkTheme from './darkTheme';

/**
 * Stack font arabe : Tajawal (Google Fonts) en priorite, fallback sur les
 * fonts arabes systeme (Tahoma rend bien sur Windows, Geeza Pro sur macOS).
 *
 * <p>Charge via {@code <link>} dans {@code index.html} avec poids 300/400/500/700/800.
 * Subset arabic+latin pour ~30KB.</p>
 */
const ARABIC_FONT_STACK =
  '"Tajawal", "Tahoma", "Geeza Pro", "Arabic Typesetting", "Traditional Arabic", sans-serif';

export interface CreateClenzyThemeOpts {
  isDark?: boolean;
  isRtl?: boolean;
}

/**
 * Factory du theme MUI Clenzy — single source of truth pour les overrides
 * dependant de la langue / mode (dark/rtl).
 *
 * <p>Pourquoi pas direct {@code <ThemeProvider theme={lightTheme}>} partout :</p>
 * <ul>
 *   <li>{@code direction: 'rtl'} doit etre appliquee au theme (sinon le swap
 *       d'unites left/right des composants MUI ne se fait pas)</li>
 *   <li>{@code typography.fontFamily} doit etre Tajawal en mode arabe (sinon
 *       on rend l'arabe en Plus Jakarta Sans qui n'a pas de glyphs arabes
 *       correctement designes -> fallback navigateur sur font systeme)</li>
 * </ul>
 *
 * <p>Utilise par {@code AppWithTheme} (theme principal) + {@code AuthLayout}
 * et tout composant qui wrap son propre ThemeProvider. Avant cette factory,
 * AuthLayout ignorait l'isRtl -> les pages de login/inscription restaient en
 * Plus Jakarta Sans meme avec langue UI = arabe (bug user 2026-05-28).</p>
 */
export function createClenzyTheme(opts: CreateClenzyThemeOpts = {}): Theme {
  const { isDark = false, isRtl = false } = opts;
  const baseTheme = isDark ? darkTheme : lightTheme;
  return createTheme({
    ...baseTheme,
    direction: isRtl ? 'rtl' : 'ltr',
    typography: isRtl
      ? { ...baseTheme.typography, fontFamily: ARABIC_FONT_STACK }
      : baseTheme.typography,
  });
}
