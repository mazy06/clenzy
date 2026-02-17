import { createTheme } from '@mui/material/styles';

// ============================================================================
// CLENZY PMS — Premium Dark Mode Theme
// ============================================================================
// Design Philosophy:
//   • Surfaces bleu-gris profondes (hue ~210-213) — aucun noir pur
//   • 4 niveaux d'élévation clairement distinguables
//   • Ombres avec inset top-edge highlight (technique Linear/Vercel)
//   • Couleurs sémantiques recalibrées WCAG AA sur fond sombre
//   • Glow interactifs au hover au lieu de shadows classiques
//   • Scrollbar thématisée, effets glass subtils
// ============================================================================

const darkTheme = createTheme({
  palette: {
    mode: 'dark',

    // ── Couleur principale : Bleu-gris Clenzy (éclairci pour contraste dark) ──
    primary: {
      main: '#7FA0B4',       // 5.8:1 sur #0F1923 (AA)
      light: '#A3BFD0',      // 8.2:1 sur #0F1923 (AAA)
      dark: '#5A7B8F',       // 3.8:1 (AA large text)
      contrastText: '#FFFFFF',
    },

    // ── Couleur secondaire : Bleu-gris clair Clenzy ──
    secondary: {
      main: '#94B5C7',
      light: '#B8D1DE',
      dark: '#7A9AAE',
      contrastText: '#0F1923',
    },

    // ── Success : Teal vibrant ──
    success: {
      main: '#5CB8AA',       // 6.1:1 sur #0F1923 (AA)
      light: '#82D0C4',
      dark: '#3D9486',
      contrastText: '#FFFFFF',
    },

    // ── Warning : Ambre chaud ──
    warning: {
      main: '#E0B483',       // 7.8:1 sur #0F1923 (AAA)
      light: '#EECFAA',
      dark: '#C4935E',
      contrastText: '#0F1923',
    },

    // ── Error : Rose doux ──
    error: {
      main: '#D98E8E',       // 6.0:1 sur #0F1923 (AA)
      light: '#EAAFAF',
      dark: '#BE6B6B',
      contrastText: '#FFFFFF',
    },

    // ── Info : Bleu harmonieux ──
    info: {
      main: '#8DB6D4',       // 6.5:1 sur #0F1923 (AA)
      light: '#ADC9DF',
      dark: '#6A94B5',
      contrastText: '#FFFFFF',
    },

    // ── Neutral : Gris-bleu harmonieux ──
    neutral: {
      main: '#9AACBC',
      light: '#B5C3D0',
      dark: '#7B8E9F',
      contrastText: '#FFFFFF',
    },

    // ── Clenzy : Couleur de marque ──
    clenzy: {
      main: '#94B5C7',
      light: '#B8D1DE',
      dark: '#7A9AAE',
      contrastText: '#0F1923',
    },

    // ── Nuances de gris : bleu-gris teinté (hue ~210-213) ──
    // En dark mode, 50 = plus sombre, 900 = plus clair
    grey: {
      50: '#0F1923',     // hsl(210, 40%, 10%) — background profond
      100: '#162231',    // hsl(212, 36%, 14%) — surface cards
      200: '#1D2B3D',    // hsl(213, 35%, 18%) — surface élevée
      300: '#253648',    // hsl(213, 33%, 21%) — borders, selected bg
      400: '#3D5468',    // hsl(211, 27%, 32%) — disabled, subtle text
      500: '#5A7589',    // hsl(209, 21%, 44%) — text secondaire
      600: '#8BA0B3',    // hsl(210, 22%, 62%) — medium emphasis
      700: '#B0C2D0',    // hsl(209, 26%, 75%) — sous-titres
      800: '#D1DCE5',    // hsl(210, 28%, 85%) — text principal
      900: '#E8EFF4',    // hsl(210, 33%, 93%) — high emphasis
      A100: '#1D2B3D',
      A200: '#253648',
      A400: '#5A7589',
      A700: '#B0C2D0',
    },

    common: {
      black: '#000000',
      white: '#ffffff',
    },

    // ── Actions : teintées bleu-gris (primary) ──
    action: {
      active: 'rgba(226, 236, 242, 0.7)',
      hover: 'rgba(127, 160, 180, 0.08)',
      selected: 'rgba(127, 160, 180, 0.16)',
      disabled: 'rgba(226, 236, 242, 0.3)',
      disabledBackground: 'rgba(127, 160, 180, 0.12)',
      focus: 'rgba(127, 160, 180, 0.24)',
      hoverOpacity: 0.08,
      selectedOpacity: 0.16,
      disabledOpacity: 0.38,
      focusOpacity: 0.24,
      activatedOpacity: 0.24,
    },

    // ── Backgrounds : bleu-gris profond (Level 0 & 1) ──
    background: {
      default: '#0F1923',   // Canvas app — le plus profond
      paper: '#162231',     // Cards, panels, sidebar
    },

    // ── Texte : haute lisibilité WCAG ──
    text: {
      primary: '#E2ECF2',     // 12.5:1 sur #0F1923 (AAA)
      secondary: '#8BA0B3',   // 5.2:1 sur #0F1923 (AA)
      disabled: '#556778',    // 3.1:1 (AA large text)
    },

    // ── Divider ──
    divider: 'rgba(138, 170, 196, 0.12)',
  },

  // ── Typography (identique au light theme) ──
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.01em' },
    h2: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.25, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.3 },
    h4: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.35 },
    h5: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4 },
    subtitle1: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 500 },
    subtitle2: { fontSize: '0.8125rem', lineHeight: 1.5, fontWeight: 500 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontSize: '0.6875rem', lineHeight: 1.4 },
    button: { fontWeight: 600, textTransform: 'none' as const, fontSize: '0.8125rem' },
  },

  shape: { borderRadius: 8 },
  spacing: 6,

  // ============================================================================
  // COMPONENT OVERRIDES
  // ============================================================================
  components: {

    // ── Scrollbar thématisée ──
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#3D5468 #0F1923',
          '&::-webkit-scrollbar': { width: 8, height: 8 },
          '&::-webkit-scrollbar-track': { background: '#0F1923' },
          '&::-webkit-scrollbar-thumb': {
            background: '#3D5468',
            borderRadius: 4,
            '&:hover': { background: '#5A7589' },
          },
        },
      },
    },

    // ── Boutons : flat, pas de glow ──
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '6px 16px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          minHeight: 36,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeSmall: { padding: '4px 12px', fontSize: '0.75rem', minHeight: 32 },
        sizeLarge: { padding: '8px 20px', fontSize: '0.875rem', minHeight: 40 },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          borderColor: 'rgba(138, 170, 196, 0.2)',
          '&:hover': {
            borderWidth: '1.5px',
            borderColor: 'rgba(138, 170, 196, 0.4)',
            backgroundColor: 'rgba(127, 160, 180, 0.08)',
          },
        },
      },
    },

    // ── Cards : border subtile, flat ──
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#162231',
          border: '1px solid rgba(138, 170, 196, 0.1)',
          boxShadow: 'none',
          '&:hover': {
            borderColor: 'rgba(138, 170, 196, 0.18)',
          },
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '16px',
          '&:last-child': { paddingBottom: '16px' },
        },
      },
    },

    // ── Paper : flat avec bordures ──
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundImage: 'none',
          border: '1px solid rgba(138, 170, 196, 0.08)',
        },
        elevation0: {
          boxShadow: 'none',
        },
        elevation1: {
          boxShadow: 'none',
          border: '1px solid rgba(138, 170, 196, 0.1)',
        },
        elevation2: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        },
        elevation3: {
          backgroundColor: '#1D2B3D',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        },
        elevation4: {
          backgroundColor: '#1D2B3D',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        },
      },
    },

    // ── TextFields : border subtile, focus primary ──
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            fontSize: '0.875rem',
            '& input': {
              padding: '10px 14px',
              height: '1.4375em',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(138, 170, 196, 0.15)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#7FA0B4',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#7FA0B4',
              borderWidth: '1.5px',
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.875rem',
          },
          '& .MuiFormHelperText-root': {
            fontSize: '0.75rem',
            marginTop: '4px',
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },

    // ── Chips : border outlined subtile ──
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
          height: 24,
          fontSize: '0.75rem',
          '& .MuiChip-label': { padding: '0 8px' },
        },
        sizeSmall: { height: 20, fontSize: '0.6875rem' },
        outlined: {
          borderWidth: '1px',
          borderColor: 'rgba(138, 170, 196, 0.2)',
        },
      },
    },

    // ── AppBar : flat, border-bottom uniquement ──
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundColor: '#162231',
          borderBottom: '1px solid rgba(138, 170, 196, 0.08)',
        },
      },
    },

    // ── Drawer : border subtile, pas de shadow lourd ──
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(138, 170, 196, 0.06)',
          boxShadow: 'none',
          backgroundColor: '#162231',
        },
      },
    },

    // ── ListItemButton : selected = overlay opacity ──
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '1px 6px',
          minHeight: 40,
          padding: '8px 12px',
          '&:hover': {
            backgroundColor: 'rgba(127, 160, 180, 0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(127, 160, 180, 0.16)',
            color: '#A3BFD0',
            '&:hover': {
              backgroundColor: 'rgba(127, 160, 180, 0.24)',
            },
            '& .MuiListItemIcon-root': {
              color: '#A3BFD0',
            },
          },
        },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          minHeight: 40,
          padding: '8px 16px',
          '&:hover': {
            backgroundColor: 'rgba(127, 160, 180, 0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(127, 160, 180, 0.16)',
          },
        },
      },
    },

    // ── Tables : hover primary-tinted, head bg élevée ──
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(127, 160, 180, 0.06)',
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
          fontSize: '0.875rem',
          borderBottomColor: 'rgba(138, 170, 196, 0.08)',
        },
        head: {
          fontSize: '0.8125rem',
          fontWeight: 600,
          padding: '10px 16px',
          backgroundColor: '#1D2B3D',
          color: '#8BA0B3',
        },
      },
    },

    // ── FAB : glow primary ──
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 16px rgba(127, 160, 180, 0.15)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(0,0,0,0.6), 0 0 20px rgba(127, 160, 180, 0.25)',
          },
        },
      },
    },

    // ── Dialog : surface élevée + border subtile ──
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1D2B3D',
          border: '1px solid rgba(138, 170, 196, 0.1)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 1px rgba(138, 170, 196, 0.1)',
        },
      },
    },

    // ── Tooltip : surface Level 3 ──
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#253648',
          border: '1px solid rgba(138, 170, 196, 0.12)',
          color: '#E2ECF2',
          fontSize: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        },
        arrow: {
          color: '#253648',
        },
      },
    },

    // ── Popover & Menu : surface élevée ──
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1D2B3D',
          border: '1px solid rgba(138, 170, 196, 0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1D2B3D',
          border: '1px solid rgba(138, 170, 196, 0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        },
      },
    },

    // ── Alerts : bg 12% opacity par sémantique ──
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: 'rgba(92, 184, 170, 0.12)',
          color: '#82D0C4',
        },
        standardError: {
          backgroundColor: 'rgba(217, 142, 142, 0.12)',
          color: '#EAAFAF',
        },
        standardWarning: {
          backgroundColor: 'rgba(224, 180, 131, 0.12)',
          color: '#EECFAA',
        },
        standardInfo: {
          backgroundColor: 'rgba(141, 182, 212, 0.12)',
          color: '#ADC9DF',
        },
      },
    },

    // ── ToggleButton : selected overlay ──
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(138, 170, 196, 0.15)',
          color: '#8BA0B3',
          '&.Mui-selected': {
            backgroundColor: 'rgba(127, 160, 180, 0.16)',
            color: '#A3BFD0',
            borderColor: 'rgba(127, 160, 180, 0.3)',
          },
        },
      },
    },

    // ── Divider ──
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(138, 170, 196, 0.08)',
        },
      },
    },

    // ── Switch track ──
    MuiSwitch: {
      styleOverrides: {
        track: {
          backgroundColor: '#3D5468',
        },
      },
    },

    // ── LinearProgress track ──
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(138, 170, 196, 0.12)',
        },
      },
    },

    // ── Skeleton ──
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(138, 170, 196, 0.08)',
        },
      },
    },

    // ── InputBase disabled ──
    MuiInputBase: {
      styleOverrides: {
        root: {
          '&.Mui-disabled': {
            color: '#556778',
          },
        },
      },
    },
  },
});

export default darkTheme;
