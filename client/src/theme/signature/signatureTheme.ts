import type { ThemeOptions } from '@mui/material/styles';

/**
 * Couche thème MUI « Signature » (refonte Baitly — handoff §2, baitly-theme).
 *
 * Adaptation MUI v5 du fichier de référence `refonte_pms/handoff/baitly-theme.ts.txt`
 * (écrit pour le CssVarsProvider v6) : la palette est dupliquée clair/sombre en
 * constantes hex (MUI a besoin de vraies couleurs pour calculer ses variantes),
 * tandis que les styleOverrides composants utilisent les variables CSS des
 * tokens (`var(--…)`) — ainsi un changement de `data-theme` / `data-accent`
 * reteinte aussi les composants MUI sans re-render.
 *
 * Appliquée en DERNIÈRE couche par {@link createBaitlyTheme} (deep merge sur le
 * baseTheme existant) : rien n'est supprimé du thème actuel, la peau Signature
 * prime simplement là où elle redéfinit (handoff §0 — incrémental, design only).
 */

const FONT_SANS = "'Plus Jakarta Sans', system-ui, sans-serif";
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif";

/** Palette Signature par mode — valeurs issues de tokens.css (source de vérité). */
const SIGNATURE_PALETTE = {
  light: {
    primary: { main: '#5F7E8C', dark: '#4E6E7C', contrastText: '#FFFFFF' },
    success: { main: '#4A9B8E' },
    warning: { main: '#C28A52' },
    error: { main: '#C97A7A' },
    info: { main: '#7BA3C2' },
    background: { default: '#F5F8F9', paper: '#FFFFFF' },
    text: { primary: '#15242D', secondary: '#67757C', disabled: '#98A4AB' },
    divider: '#E7ECEF',
  },
  dark: {
    primary: { main: '#7FA3B1', dark: '#6E91A0', contrastText: '#0E141A' },
    success: { main: '#4A9B8E' },
    warning: { main: '#C28A52' },
    error: { main: '#C97A7A' },
    info: { main: '#7BA3C2' },
    background: { default: '#0E141A', paper: '#161E26' },
    text: { primary: '#EAF0F3', secondary: '#869199', disabled: '#647079' },
    divider: '#252F39',
  },
} as const;

export function signatureOverrides(isDark: boolean): ThemeOptions {
  const palette = isDark ? SIGNATURE_PALETTE.dark : SIGNATURE_PALETTE.light;

  return {
    palette,

    shape: { borderRadius: 11 }, // base contrôles ; cartes = 14 (overrides ci-dessous)

    typography: {
      fontFamily: FONT_SANS,
      // Display & chiffres en Space Grotesk (handoff §1)
      h1: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-.02em' },
      h2: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-.015em' },
      h3: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-.01em' },
      h4: { fontFamily: FONT_DISPLAY, fontWeight: 600 },
      h5: { fontFamily: FONT_DISPLAY, fontWeight: 600 },
      h6: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: '0.95rem' },
      button: { fontWeight: 600, textTransform: 'none' as const, letterSpacing: 0 },
      body2: { fontSize: '0.8125rem' },
      overline: { fontWeight: 700, letterSpacing: '.06em' },
    },

    components: {
      // Boutons — référence « états des icônes de boutons » (.s-btn) :
      // base h38 r11 12.5px fw600 gap 8 icône 15, press .97 ;
      // PRIMAIRE = CONTOUR accent (jamais d'aplat) ; danger/ok/warn = contour
      // + fond soft assorti ; text = fantôme ; disabled opacity .45.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            height: 38,
            paddingInline: 17,
            borderRadius: 11,
            fontSize: '12.5px',
            fontWeight: 600,
            gap: 8,
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            transition: 'transform .12s, background-color .14s, border-color .14s, color .14s',
            '&:active': { transform: 'scale(.97)' },
            '& svg': { width: 15, height: 15, flexShrink: 0 },
            '&.Mui-disabled': { opacity: 0.45 },
            '&.Mui-disabled:active': { transform: 'none' },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              '&:active': { transform: 'none' },
            },
          },
          sizeSmall: {
            height: 32,
            paddingInline: 12,
            fontSize: '12px',
            borderRadius: 9,
            '& svg': { width: 13, height: 13 },
          },
          sizeLarge: { height: 44, paddingInline: 22, fontSize: '13.5px' },
          // .s-btn--p : contour accent, hover accent-soft
          containedPrimary: {
            backgroundColor: 'transparent',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            boxShadow: 'none',
            '&:hover': { backgroundColor: 'var(--accent-soft)', boxShadow: 'none' },
          },
          // .s-btn--danger / sémantiques : contour + soft assorti
          containedError: {
            backgroundColor: 'transparent',
            border: '1px solid var(--err)',
            color: 'var(--err)',
            '&:hover': { backgroundColor: 'var(--err-soft)' },
          },
          containedSuccess: {
            backgroundColor: 'transparent',
            border: '1px solid var(--ok)',
            color: 'var(--ok)',
            '&:hover': { backgroundColor: 'var(--ok-soft)' },
          },
          containedWarning: {
            backgroundColor: 'transparent',
            border: '1px solid var(--warn)',
            color: 'var(--warn)',
            '&:hover': { backgroundColor: 'var(--warn-soft)' },
          },
          // .s-btn--g : secondaire neutre (carte hairline)
          outlined: {
            backgroundColor: 'var(--card)',
            borderColor: 'var(--line-2)',
            color: 'var(--body)',
            '&:hover': { borderColor: 'var(--faint)', backgroundColor: 'var(--card)' },
          },
          outlinedError: {
            backgroundColor: 'transparent',
            borderColor: 'var(--err)',
            color: 'var(--err)',
            '&:hover': { backgroundColor: 'var(--err-soft)', borderColor: 'var(--err)' },
          },
          // .s-btn--ghost : fantôme
          text: {
            color: 'var(--body)',
            '&:hover': { backgroundColor: 'var(--hover)' },
          },
          textError: {
            color: 'var(--err)',
            '&:hover': { backgroundColor: 'var(--err-soft)' },
          },
        },
      },
      // Icône seule (.s-btn--icon adapté aux densités MUI) : carré arrondi,
      // muted → hover surface + ink.
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            color: 'var(--muted)',
            transition: 'background-color .14s, color .14s',
            '&:hover': { backgroundColor: 'var(--hover)', color: 'var(--ink)' },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          },
        },
      },
      // Paper global : plat (pas d'elevation par defaut), pas de gradient overlay dark.
      // NB : pas de border/rayon ici — ça casserait menus, drawers, popovers.
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      // Menus / popovers : panneau hairline + ombre flottante (handoff --shadow-pop)
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
          },
        },
      },
      // Modales : peau .s-modal-ovl/.s-modal (référence « Modale Nouvelle Réservation »)
      // Backdrop scopé au Dialog (pas MuiBackdrop global : Drawer/Popover non concernés).
      MuiDialog: {
        styleOverrides: {
          root: {
            '& .MuiBackdrop-root': {
              backgroundColor: 'rgba(10,18,24,.5)',
              backdropFilter: 'blur(3px)',
            },
          },
          paper: {
            borderRadius: 18,
            border: '1px solid var(--line)',
            // Ombre ink-teintée littérale (le voile sombre vient du backdrop)
            boxShadow: '0 30px 70px -24px rgba(21,36,45,.5)',
            backgroundImage: 'none',
            // Entrée .s-modal : translateY(12px) scale(.985) → none (cohabite avec le Fade MUI)
            '@keyframes signatureModalIn': {
              from: { transform: 'translateY(12px) scale(.985)' },
              to: { transform: 'none' },
            },
            animation: 'signatureModalIn .22s cubic-bezier(.16,1,.3,1)',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          },
        },
      },
      // Entête modale (.rm-head) : titre display, hairline basse
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-.01em',
            padding: '18px 22px',
            borderBottom: '1px solid var(--line)',
          },
        },
      },
      // Corps modale (.rm-col)
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: '22px' },
          dividers: {
            borderTopColor: 'var(--line)',
            borderBottomColor: 'var(--line)',
          },
        },
      },
      // Pied modale (.rm-foot) : surface sur-élevée + hairline haute
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: '14px 22px',
            borderTop: '1px solid var(--line)',
            backgroundColor: 'var(--surface-2)',
            gap: 10,
          },
        },
      },
      // Cartes / panneaux : 1px hairline, rayon 14, AUCUNE ombre au repos
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: '1px solid var(--line)',
            boxShadow: 'none',
            backgroundImage: 'none',
            transition: 'border-color .14s, box-shadow .14s',
            '&:hover': { borderColor: 'var(--line-2)' },
          },
        },
      },
      // Chips / badges : pilule, label compact
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 700, fontSize: '10.5px', height: 22 },
          label: { paddingInline: 10 },
        },
      },
      // Champs : fond gris neutre (dé-bleui), rayon 11, focus accent
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 11,
            backgroundColor: 'var(--field)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--field-line)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--faint)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--accent)',
              borderWidth: 1,
            },
          },
        },
      },
      // Tableaux : entêtes en overline, lignes hairline, hover doux
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '.05em',
            textTransform: 'uppercase' as const,
            color: 'var(--faint)',
            borderColor: 'var(--line)',
          },
          body: { fontSize: '12.5px', borderColor: 'var(--line)' },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color .12s',
            '&:hover': { backgroundColor: 'var(--hover)' },
          },
        },
      },
      // Tooltips : encre sur fond — s'inversent avec le thème (handoff §3)
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: '11.5px',
            fontWeight: 600,
            backgroundColor: 'var(--ink)',
            color: 'var(--bg)',
            padding: '5px 10px',
          },
          arrow: { color: 'var(--ink)' },
        },
      },
    },
  };
}
