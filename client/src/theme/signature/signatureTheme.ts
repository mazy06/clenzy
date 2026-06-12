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

/**
 * Peau sémantique d'alerte (baseline §2 modales : alerte fond `-soft` +
 * texte couleur + hairline `color-mix` 30%) — appliquée à toutes les
 * variantes MUI (standard/outlined/filled) pour une seule peau validée.
 */
const alertSeverity = (token: 'ok' | 'warn' | 'err' | 'info') => ({
  backgroundColor: `var(--${token}-soft)`,
  color: `var(--${token})`,
  border: `1px solid color-mix(in srgb, var(--${token}) 30%, transparent)`,
  '& .MuiAlert-icon': { color: `var(--${token})` },
});

/**
 * Sélecteurs binaires (Checkbox/Radio) : `--faint` au repos, `--accent`
 * coché, ring focus-visible accent-soft (baseline §3), désactivé .45.
 */
const SELECTION_CONTROL_STYLES = {
  color: 'var(--faint)',
  transition: 'color .14s',
  '&:hover': { backgroundColor: 'var(--hover)' },
  '&.Mui-checked': { color: 'var(--accent)' },
  '&.Mui-focusVisible': { boxShadow: '0 0 0 3px var(--accent-soft)' },
  '&.Mui-disabled': { color: 'var(--faint)', opacity: 0.45 },
  '&.Mui-disabled.Mui-checked': { color: 'var(--accent)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
};

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
          // Compacts : rayon 9 (échelle des rayons — 9px compacts/segments)
          sizeSmall: { borderRadius: 9 },
        },
      },
      // Tailles small de champs : 12px (aligné contrôles small — .s-btn small)
      MuiInputBase: {
        styleOverrides: {
          sizeSmall: { fontSize: '12px' },
        },
      },
      // Label de champ : secondaire muted, focus accent, erreur err, disabled .45
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: 'var(--muted)',
            '&.Mui-focused': { color: 'var(--accent)' },
            '&.Mui-error': { color: 'var(--err)' },
            '&.Mui-disabled': { color: 'var(--muted)', opacity: 0.45 },
          },
        },
      },
      // Flèche de Select : icône muted (convention icon-buttons)
      MuiSelect: {
        styleOverrides: {
          icon: { color: 'var(--muted)' },
        },
      },
      // Options de menus/Select : 12.5px, hover --hover, sélection accent-soft + accent
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '12.5px',
            '&:hover': { backgroundColor: 'var(--hover)' },
            '&.Mui-focusVisible': { backgroundColor: 'var(--hover)' },
            '&.Mui-selected': {
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
              '&:hover': { backgroundColor: 'var(--accent-soft)' },
              '&.Mui-focusVisible': { backgroundColor: 'var(--accent-soft)' },
            },
          },
        },
      },
      // Autocomplete : papier aligné Menus/Popovers (hairline r12 + shadow-pop),
      // options harmonisées avec les MenuItem (les options vivent sous le slot
      // listbox dans MUI v5 — un slot `option` théme n'est pas résolu).
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
          },
          listbox: {
            '& .MuiAutocomplete-option': {
              fontSize: '12.5px',
              '&.Mui-focused': { backgroundColor: 'var(--hover)' },
              '&.Mui-focusVisible': { backgroundColor: 'var(--hover)' },
              '&[aria-selected="true"]': {
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
                '&.Mui-focused': { backgroundColor: 'var(--accent-soft)' },
                '&.Mui-focusVisible': { backgroundColor: 'var(--accent-soft)' },
              },
            },
          },
        },
      },
      // Cases à cocher / radios : accent cochés, faint sinon, ring accent-soft
      MuiCheckbox: {
        styleOverrides: {
          root: {
            ...SELECTION_CONTROL_STYLES,
            '&.MuiCheckbox-indeterminate': { color: 'var(--accent)' },
          },
        },
      },
      MuiRadio: {
        styleOverrides: {
          root: SELECTION_CONTROL_STYLES,
        },
      },
      // Toggle global — pattern .rm-toggle promu (baseline §2) : track 42×24
      // r99 --line-2→--accent, pouce 20 blanc (--on-accent), disabled .45.
      // Dimensions nichées sous root pour primer sur la variante small MUI :
      // toutes les tailles sont normalisées sur l'unique pattern validé.
      MuiSwitch: {
        defaultProps: { disableRipple: true },
        styleOverrides: {
          root: {
            width: 42,
            height: 24,
            padding: 0,
            '& .MuiSwitch-switchBase': {
              padding: 2,
              transition: 'transform .14s',
              '&:hover': { backgroundColor: 'transparent' },
              '&.Mui-checked': {
                transform: 'translateX(18px)',
                '& + .MuiSwitch-track': { backgroundColor: 'var(--accent)', opacity: 1 },
              },
              '&.Mui-focusVisible + .MuiSwitch-track': {
                boxShadow: '0 0 0 3px var(--accent-soft)',
              },
              '&.Mui-disabled': { opacity: 0.45 },
              '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.45 },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            },
            '& .MuiSwitch-thumb': {
              width: 20,
              height: 20,
              backgroundColor: 'var(--on-accent)',
            },
            '& .MuiSwitch-track': {
              borderRadius: 99,
              backgroundColor: 'var(--line-2)',
              opacity: 1,
              transition: 'background-color .14s',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
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
      // Pagination de table : 12px, chiffres tabular-nums, icônes 28px r8
      MuiTablePagination: {
        styleOverrides: {
          root: {
            fontSize: '12px',
            '& .MuiTablePagination-select': { fontSize: '12px' },
          },
          selectLabel: { fontSize: '12px' },
          displayedRows: { fontSize: '12px', fontVariantNumeric: 'tabular-nums' },
          actions: {
            '& .MuiIconButton-root': { width: 28, height: 28, padding: 0, borderRadius: 8 },
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
      // Alertes : sémantiques fond -soft + texte couleur + icône assortie,
      // r11, hairline color-mix 30% (toutes variantes ramenées à la peau unique)
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 11,
            '&.MuiAlert-standardSuccess, &.MuiAlert-outlinedSuccess, &.MuiAlert-filledSuccess':
              alertSeverity('ok'),
            '&.MuiAlert-standardWarning, &.MuiAlert-outlinedWarning, &.MuiAlert-filledWarning':
              alertSeverity('warn'),
            '&.MuiAlert-standardError, &.MuiAlert-outlinedError, &.MuiAlert-filledError':
              alertSeverity('err'),
            '&.MuiAlert-standardInfo, &.MuiAlert-outlinedInfo, &.MuiAlert-filledInfo':
              alertSeverity('info'),
          },
        },
      },
      // Toast neutre (Snackbar sans Alert) : panneau flottant r11
      // (hairline --line + --shadow-pop — pattern Menus/Popovers)
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            borderRadius: 11,
            backgroundColor: 'var(--card)',
            color: 'var(--body)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-pop)',
          },
        },
      },
      // Skeletons : fond --hover, vague par défaut (à privilégier vs spinner)
      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: {
          root: {
            backgroundColor: 'var(--hover)',
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              '&::after': { animation: 'none' },
            },
          },
        },
      },
      // Barres de progression : piste --field, barre --accent, pilule
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99 },
          colorPrimary: { backgroundColor: 'var(--field)' },
          bar: { borderRadius: 99 },
          barColorPrimary: { backgroundColor: 'var(--accent)' },
        },
      },
      MuiCircularProgress: {
        styleOverrides: {
          colorPrimary: { color: 'var(--accent)' },
        },
      },
      // Séparateurs : hairline --line (y compris variante avec libellé)
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: 'var(--line)',
            '&::before, &::after': { borderColor: 'var(--line)' },
          },
        },
      },
      // Onglets BRUTS (hors primitive PageTabs — fallback aligné .s-tab) :
      // souligné 2px accent, labels fw600 muted→accent, pas d'uppercase
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 2, backgroundColor: 'var(--accent)' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            fontSize: '0.75rem',
            color: 'var(--muted)',
            transition: 'color .14s',
            '&:hover': { color: 'var(--body)' },
            '&.Mui-selected': { color: 'var(--accent)' },
            '&.Mui-disabled': { opacity: 0.45 },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          },
        },
      },
      // Segmented control (.s-seg — valeurs du PlanningToolbar finalisé) :
      // conteneur --field hairline r10 p3, segments r7, actif carte + accent
      // + ombre 0 1px 3px ink-teintée. Les classes first/middle/lastButton de
      // MUI (rayons mis à 0 par défaut) sont re-arrondies au même niveau.
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            backgroundColor: 'var(--field)',
            border: '1px solid var(--field-line)',
            borderRadius: 10,
            padding: 3,
            gap: 2,
            '& .MuiToggleButtonGroup-grouped': { border: 0, margin: 0, borderRadius: 7 },
            '& .MuiToggleButtonGroup-firstButton, & .MuiToggleButtonGroup-middleButton, & .MuiToggleButtonGroup-lastButton':
              { borderRadius: 7, marginLeft: 0, borderLeft: 0 },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            fontSize: '0.75rem',
            fontWeight: 600,
            lineHeight: 1,
            padding: '6px 13px',
            textTransform: 'none' as const,
            letterSpacing: '0.01em',
            color: 'var(--muted)',
            transition: 'background-color 140ms, color 140ms',
            '&:hover': { backgroundColor: 'transparent', color: 'var(--body)' },
            '&.Mui-selected': {
              backgroundColor: 'var(--card)',
              color: 'var(--accent)',
              boxShadow: '0 1px 3px color-mix(in srgb, var(--ink) 10%, transparent)',
              '&:hover': { backgroundColor: 'var(--card)' },
            },
            '&.Mui-disabled': { opacity: 0.45, border: 0 },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          },
        },
      },
    },
  };
}
