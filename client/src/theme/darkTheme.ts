import { createTheme } from '@mui/material/styles';

// Réutilisation des augmentations de types du thème principal (importées via theme.ts)
// Les déclarations de module dans theme.ts s'appliquent globalement

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    // Couleur principale : Bleu-gris Clenzy (plus clair pour le contraste en dark mode)
    primary: {
      main: '#8BA3B3', // Plus clair que le light theme pour meilleur contraste
      light: '#A6C0CE',
      dark: '#6B8A9A',
      contrastText: '#ffffff',
    },
    // Couleur secondaire : Bleu-gris clair Clenzy
    secondary: {
      main: '#A6C0CE',
      light: '#C5D5E0',
      dark: '#8BA3B3',
      contrastText: '#1e293b',
    },
    // Success : Vert harmonieux
    success: {
      main: '#6BB5A8',
      light: '#8CCFC2',
      dark: '#4A9B8E',
      contrastText: '#ffffff',
    },
    // Warning : Ambre/Orange harmonieux
    warning: {
      main: '#E8C19A',
      light: '#F0D4B5',
      dark: '#D4A574',
      contrastText: '#1e293b',
    },
    // Error : Rouge-rose doux
    error: {
      main: '#E09A9A',
      light: '#EBB5B5',
      dark: '#C97A7A',
      contrastText: '#ffffff',
    },
    // Info : Bleu harmonieux
    info: {
      main: '#9BB8D1',
      light: '#B5CCE0',
      dark: '#7BA3C2',
      contrastText: '#ffffff',
    },
    // Neutral : Gris-bleu harmonieux
    neutral: {
      main: '#A8B5C3',
      light: '#BFC9D4',
      dark: '#8B9AAB',
      contrastText: '#ffffff',
    },
    // Clenzy : Couleur de marque
    clenzy: {
      main: '#A6C0CE',
      light: '#C5D5E0',
      dark: '#8BA3B3',
      contrastText: '#1e293b',
    },
    // Nuances de gris pour dark mode
    grey: {
      50: '#1a1a2e',
      100: '#1e1e32',
      200: '#2a2a3e',
      300: '#3a3a4e',
      400: '#6b7280',
      500: '#9ca3af',
      600: '#d1d5db',
      700: '#e5e7eb',
      800: '#f3f4f6',
      900: '#f9fafb',
      A100: '#2a2a3e',
      A200: '#3a3a4e',
      A400: '#9ca3af',
      A700: '#e5e7eb',
    },
    common: {
      black: '#000000',
      white: '#ffffff',
    },
    action: {
      active: 'rgba(255, 255, 255, 0.7)',
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(255, 255, 255, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
      focus: 'rgba(255, 255, 255, 0.12)',
      hoverOpacity: 0.08,
      selectedOpacity: 0.16,
      disabledOpacity: 0.38,
      focusOpacity: 0.12,
      activatedOpacity: 0.24,
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '1.75rem',
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 700,
      fontSize: '1.5rem',
      lineHeight: 1.25,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.35,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: '0.875rem',
      lineHeight: 1.4,
    },
    subtitle1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      fontWeight: 500,
    },
    subtitle2: {
      fontSize: '0.8125rem',
      lineHeight: 1.5,
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.8125rem',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.6875rem',
      lineHeight: 1.4,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      fontSize: '0.8125rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 6,
  components: {
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
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          },
        },
        sizeSmall: {
          padding: '4px 12px',
          fontSize: '0.75rem',
          minHeight: 32,
        },
        sizeLarge: {
          padding: '8px 20px',
          fontSize: '0.875rem',
          minHeight: 40,
        },
        contained: {
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
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
          backgroundColor: '#1e1e1e',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 1px 1px rgba(0,0,0,0.2)',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '16px',
          '&:last-child': {
            paddingBottom: '16px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        },
        elevation2: {
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
        },
      },
    },
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
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#8BA3B3',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#8BA3B3',
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
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
          height: 24,
          fontSize: '0.75rem',
          '& .MuiChip-label': {
            padding: '0 8px',
          },
        },
        sizeSmall: {
          height: 20,
          fontSize: '0.6875rem',
        },
        outlined: {
          borderWidth: '1px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          backgroundColor: '#1e1e1e',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
          backgroundColor: '#1e1e1e',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '1px 6px',
          minHeight: 40,
          padding: '8px 12px',
          '&:hover': {
            backgroundColor: 'rgba(139, 163, 179, 0.12)',
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
          fontSize: '0.875rem',
          minHeight: 40,
          padding: '8px 16px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
          fontSize: '0.875rem',
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        },
        head: {
          fontSize: '0.8125rem',
          fontWeight: 600,
          padding: '10px 16px',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
          },
        },
      },
    },
  },
});

export default darkTheme;
