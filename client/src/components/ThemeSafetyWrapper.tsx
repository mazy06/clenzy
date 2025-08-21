import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface ThemeSafetyWrapperProps {
  children: React.ReactNode;
}

export default function ThemeSafetyWrapper({ children }: ThemeSafetyWrapperProps) {
  const [themeReady, setThemeReady] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const validateTheme = () => {
      try {
        // Vérifier que le thème a toutes les propriétés nécessaires
        if (!theme) {
          throw new Error('Thème non défini');
        }

        // Vérifier les couleurs principales
        const requiredColors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
        for (const colorName of requiredColors) {
          const color = (theme.palette as any)[colorName];
          if (!color || !color.main || !color.contrastText) {
            throw new Error(`Couleur ${colorName} manquante ou incomplète`);
          }
        }

        // Vérifier les breakpoints
        if (!theme.breakpoints || !theme.breakpoints.down) {
          throw new Error('Breakpoints manquants');
        }

        // Vérifier zIndex
        if (!theme.zIndex || !theme.zIndex.drawer) {
          throw new Error('ZIndex manquants');
        }

        console.log('🔍 ThemeSafetyWrapper - Thème validé avec succès');
        setThemeReady(true);
      } catch (error) {
        console.error('🔍 ThemeSafetyWrapper - Erreur de validation du thème:', error);
        setThemeError(error instanceof Error ? error.message : 'Erreur inconnue du thème');
      }
    };

    // Délai pour laisser le thème se charger
    const timer = setTimeout(validateTheme, 100);
    return () => clearTimeout(timer);
  }, [theme]);

  if (themeError) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        p: 3
      }}>
        <Alert severity="error" sx={{ mb: 2, maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Erreur de thème détectée
          </Typography>
          <Typography variant="body1">
            {themeError}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Veuillez rafraîchir la page ou contacter l'administrateur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (!themeReady) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress size={60} sx={{ mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Chargement du thème...
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
}
