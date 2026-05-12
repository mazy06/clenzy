import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    neutral: Palette['primary'];
    clenzy: Palette['primary'];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions['primary'];
    clenzy?: PaletteOptions['primary'];
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    neutral: true;
    clenzy: true;
  }
}

const theme = createTheme({
  palette: {
    // Couleur principale : Bleu-gris Clenzy (identité visuelle)
    primary: {
      main: '#6B8A9A', // Bleu-gris foncé Clenzy - couleur principale
      light: '#8BA3B3', // Bleu-gris moyen
      dark: '#5A7684', // Bleu-gris très foncé
      contrastText: '#ffffff',
    },
    // Couleur secondaire : Bleu-gris clair Clenzy
    secondary: {
      main: '#A6C0CE', // Bleu-gris clair Clenzy - couleur secondaire
      light: '#C5D5E0', // Bleu-gris très clair
      dark: '#8BA3B3', // Bleu-gris moyen
      contrastText: '#1e293b', // Texte foncé pour meilleur contraste
    },
    // Success : Vert harmonieux avec la palette bleu-gris
    success: {
      main: '#4A9B8E', // Vert-bleu harmonieux
      light: '#6BB5A8',
      dark: '#3A7A6F',
      contrastText: '#ffffff',
    },
    // Warning : Ambre/Orange harmonieux
    warning: {
      main: '#D4A574', // Ambre/beige chaud harmonieux
      light: '#E8C19A',
      dark: '#B88A5A',
      contrastText: '#1e293b',
    },
    // Error : Rouge-brun harmonieux (moins agressif)
    error: {
      main: '#C97A7A', // Rouge-rose doux harmonieux
      light: '#E09A9A',
      dark: '#B05A5A',
      contrastText: '#ffffff',
    },
    // Info : Bleu harmonieux avec la palette
    info: {
      main: '#7BA3C2', // Bleu harmonieux avec Clenzy
      light: '#9BB8D1',
      dark: '#5B7A92',
      contrastText: '#ffffff',
    },
    // Neutral : Gris harmonieux avec la palette
    neutral: {
      main: '#8B9AAB', // Gris-bleu harmonieux
      light: '#A8B5C3',
      dark: '#6B7A8A',
      contrastText: '#ffffff',
    },
    // Clenzy : Couleur de marque principale (bleu-gris clair)
    clenzy: {
      main: '#A6C0CE', // Bleu-gris clair Clenzy
      light: '#C5D5E0', // Bleu-gris très clair
      dark: '#8BA3B3', // Bleu-gris moyen
      contrastText: '#1e293b', // Texte foncé pour meilleur contraste
    },
    // Nuances de gris harmonisées avec la palette Clenzy
    grey: {
      50: '#F8FAFC', // Fond très clair
      100: '#F1F5F9', // Fond clair
      200: '#E2E8F0', // Bordure claire
      300: '#CBD5E1', // Bordure moyenne
      400: '#94A3B8', // Texte secondaire clair
      500: '#64748B', // Texte secondaire
      600: '#475569', // Texte secondaire foncé
      700: '#334155', // Texte principal foncé
      800: '#1E293B', // Texte principal très foncé
      900: '#0F172A', // Texte principal extrêmement foncé
      A100: '#E2E8F0',
      A200: '#CBD5E1',
      A400: '#64748B',
      A700: '#334155',
    },
    // Couleurs de base Material-UI
    common: {
      black: '#000000',
      white: '#ffffff',
    },
    // Couleurs d'action
    action: {
      active: 'rgba(0, 0, 0, 0.54)',
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(0, 0, 0, 0.08)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
      focus: 'rgba(0, 0, 0, 0.12)',
      hoverOpacity: 0.04,
      selectedOpacity: 0.08,
      disabledOpacity: 0.38,
      focusOpacity: 0.12,
      activatedOpacity: 0.12,
    },
    background: {
      default: '#F8FAFC', // Fond très clair harmonisé
      paper: '#ffffff',
    },
    text: {
      primary: '#1E293B', // Texte principal foncé
      secondary: '#64748B', // Texte secondaire harmonisé
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    // ─── Typography responsive ──────────────────────────────────────────────
    // 3 paliers : sm (laptop 13"-15") / md (1200+) / xl (1536+). La valeur de
    // base est la plus petite ; les paliers superieurs sont opt-in via media
    // queries pour eviter d'agrandir trop tot sur un ecran cible (laptop).
    // Tous les composants qui utilisent <Typography variant="..."> heritent
    // automatiquement de cette echelle — aucun changement consommateur.
    h1: {
      fontWeight: 700,
      fontSize: '1.25rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      '@media (min-width:1200px)': { fontSize: '1.375rem' },
      '@media (min-width:1536px)': { fontSize: '1.5rem' },
    },
    h2: {
      fontWeight: 700,
      fontSize: '1.0625rem',
      lineHeight: 1.25,
      letterSpacing: '-0.01em',
      '@media (min-width:1200px)': { fontSize: '1.1875rem' },
      '@media (min-width:1536px)': { fontSize: '1.3125rem' },
    },
    h3: {
      fontWeight: 600,
      fontSize: '0.9375rem',
      lineHeight: 1.3,
      '@media (min-width:1200px)': { fontSize: '1.0625rem' },
      '@media (min-width:1536px)': { fontSize: '1.125rem' },
    },
    h4: {
      fontWeight: 600,
      fontSize: '0.875rem',
      lineHeight: 1.35,
      '@media (min-width:1200px)': { fontSize: '0.9375rem' },
      '@media (min-width:1536px)': { fontSize: '1rem' },
    },
    h5: {
      fontWeight: 600,
      fontSize: '0.8125rem',
      lineHeight: 1.4,
      '@media (min-width:1200px)': { fontSize: '0.875rem' },
      '@media (min-width:1536px)': { fontSize: '0.9375rem' },
    },
    h6: {
      fontWeight: 600,
      fontSize: '0.75rem',
      lineHeight: 1.4,
      '@media (min-width:1200px)': { fontSize: '0.8125rem' },
      '@media (min-width:1536px)': { fontSize: '0.875rem' },
    },
    subtitle1: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      fontWeight: 500,
      '@media (min-width:1200px)': { fontSize: '0.8125rem' },
      '@media (min-width:1536px)': { fontSize: '0.875rem' },
    },
    subtitle2: {
      fontSize: '0.6875rem',
      lineHeight: 1.5,
      fontWeight: 500,
      '@media (min-width:1200px)': { fontSize: '0.75rem' },
      '@media (min-width:1536px)': { fontSize: '0.8125rem' },
    },
    body1: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      '@media (min-width:1200px)': { fontSize: '0.8125rem' },
      '@media (min-width:1536px)': { fontSize: '0.875rem' },
    },
    body2: {
      fontSize: '0.6875rem',
      lineHeight: 1.5,
      '@media (min-width:1200px)': { fontSize: '0.75rem' },
      '@media (min-width:1536px)': { fontSize: '0.8125rem' },
    },
    caption: {
      fontSize: '0.625rem',
      lineHeight: 1.4,
      '@media (min-width:1200px)': { fontSize: '0.6875rem' },
      '@media (min-width:1536px)': { fontSize: '0.6875rem' },
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      fontSize: '0.6875rem',
      '@media (min-width:1200px)': { fontSize: '0.75rem' },
      '@media (min-width:1536px)': { fontSize: '0.8125rem' },
    },
  },
  shape: {
    borderRadius: 8, // 12 → 8 pour plus de compacité
  },
  spacing: 6, // Réduire l'espacement de base (8px → 6px)
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '5px 12px',
          fontSize: '0.6875rem',
          '@media (min-width:1200px)': { fontSize: '0.75rem' },
          '@media (min-width:1536px)': { fontSize: '0.8125rem' },
          fontWeight: 600,
          minHeight: 28,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeSmall: {
          padding: '3px 10px',
          fontSize: '0.625rem',
          '@media (min-width:1200px)': { fontSize: '0.6875rem' },
          '@media (min-width:1536px)': { fontSize: '0.75rem' },
          minHeight: 24,
        },
        sizeLarge: {
          padding: '6px 16px',
          fontSize: '0.75rem',
          '@media (min-width:1200px)': { fontSize: '0.8125rem' },
          '@media (min-width:1536px)': { fontSize: '0.875rem' },
          minHeight: 34,
        },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: '1.5px', // 2px → 1.5px
          '&:hover': {
            borderWidth: '1.5px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          border: '1px solid',
          borderColor: '#E2E8F0',
          '&:hover': {
            borderColor: '#CBD5E1',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '12px',
          '&:last-child': {
            paddingBottom: '12px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        elevation0: {
          boxShadow: 'none',
        },
        elevation1: {
          boxShadow: 'none',
          border: '1px solid',
          borderColor: '#E2E8F0',
        },
        elevation2: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiTextField: {
      // Tous les TextField sont 'small' par défaut — plus de Form geant sur laptop.
      // Override possible localement via size="medium" si necessaire.
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            // Echelle responsive serrée : 11px laptop → 12px md → 13px xl
            fontSize: '0.6875rem',
            '@media (min-width:1200px)': { fontSize: '0.75rem' },
            '@media (min-width:1536px)': { fontSize: '0.8125rem' },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#6B8A9A',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#6B8A9A',
              borderWidth: '1.5px',
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.6875rem',
            '@media (min-width:1200px)': { fontSize: '0.75rem' },
            '@media (min-width:1536px)': { fontSize: '0.8125rem' },
          },
          '& .MuiFormHelperText-root': {
            fontSize: '0.625rem',
            marginTop: '2px',
            '@media (min-width:1536px)': { fontSize: '0.6875rem' },
          },
        },
      },
    },
    // Selects et Autocomplete suivent la meme echelle responsive.
    MuiFormControl: {
      defaultProps: { size: 'small' },
    },
    MuiAutocomplete: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
          height: 20,
          fontSize: '0.6875rem',
          '& .MuiChip-label': {
            padding: '0 6px',
          },
        },
        sizeSmall: {
          height: 18,
          fontSize: '0.625rem',
        },
        outlined: {
          borderWidth: '1px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid',
          borderColor: '#E2E8F0',
          boxShadow: 'none',
          borderRadius: 0,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '1px 6px',
          minHeight: 32,
          padding: '4px 10px',
          '&:hover': {
            backgroundColor: 'rgba(107, 138, 154, 0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: '#6B8A9A',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#5A7684',
            },
            '& .MuiListItemIcon-root': {
              color: '#ffffff',
            },
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
          minHeight: 30,
          padding: '4px 12px',
          '@media (min-width:1536px)': { fontSize: '0.8125rem' },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '8px 12px',
          fontSize: '0.75rem',
          '@media (min-width:1536px)': { fontSize: '0.8125rem' },
        },
        head: {
          fontSize: '0.6875rem',
          fontWeight: 600,
          padding: '6px 12px',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          },
        },
      },
    },
  },
});

export default theme;
