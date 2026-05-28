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

  // IMPORTANT : utiliser createTheme(base, ...overrides) (signature 2-arg) qui
  // fait un DEEP MERGE des overrides sur le baseTheme. Si on faisait
  // createTheme({ ...baseTheme, typography: { fontFamily } }) avec un spread
  // shallow, les sub-structures internes de MUI (components.MuiCssBaseline,
  // palette, etc.) seraient cassees -> certains composants ne re-emettraient
  // pas leur fontFamily depuis le nouveau theme (bug visible : tooltips
  // hereditent OK mais body / Typography variants restent en Plus Jakarta).
  if (!isRtl) {
    // LTR : pas besoin d'override, on retourne le baseTheme inchange
    return baseTheme;
  }
  return createTheme(baseTheme, {
    direction: 'rtl',
    typography: {
      fontFamily: ARABIC_FONT_STACK,
      // Force la fontFamily sur TOUS les variants Typography. Sans ca, MUI
      // peut garder la fontFamily du baseTheme sur certains variants (h1, h2,
      // body1, etc.) car ils n'heritent pas toujours de typography.fontFamily
      // au runtime selon comment le baseTheme les a definis.
      h1: { fontFamily: ARABIC_FONT_STACK },
      h2: { fontFamily: ARABIC_FONT_STACK },
      h3: { fontFamily: ARABIC_FONT_STACK },
      h4: { fontFamily: ARABIC_FONT_STACK },
      h5: { fontFamily: ARABIC_FONT_STACK },
      h6: { fontFamily: ARABIC_FONT_STACK },
      subtitle1: { fontFamily: ARABIC_FONT_STACK },
      subtitle2: { fontFamily: ARABIC_FONT_STACK },
      body1: { fontFamily: ARABIC_FONT_STACK },
      body2: { fontFamily: ARABIC_FONT_STACK },
      button: { fontFamily: ARABIC_FONT_STACK },
      caption: { fontFamily: ARABIC_FONT_STACK },
      overline: { fontFamily: ARABIC_FONT_STACK },
    },
    components: {
      // Override CssBaseline pour forcer le body en Tajawal. Le CssBaseline
      // par defaut applique theme.typography.fontFamily au body, mais avec
      // le spread shallow il pouvait recoper l'ancienne valeur du baseTheme.
      MuiCssBaseline: {
        styleOverrides: {
          body: { fontFamily: ARABIC_FONT_STACK },
        },
      },
    },
  });
}
