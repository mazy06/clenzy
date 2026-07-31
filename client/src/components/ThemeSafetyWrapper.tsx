import React, { useState, useEffect } from 'react';
import { Spinner } from './ui';
import { Alert } from '@mui/material';
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
          const color = (theme.palette as unknown as Record<string, { main?: string; contrastText?: string }>)[colorName];
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

        setThemeReady(true);
      } catch (error) {
        setThemeError(error instanceof Error ? error.message : 'Erreur inconnue du thème');
      }
    };

    // Délai pour laisser le thème se charger
    const timer = setTimeout(validateTheme, 100);
    return () => clearTimeout(timer);
  }, [theme]);

  if (themeError) {
    return (
      <div className="flex flex-col items-center justify-center h-[100vh] p-4">
        <Alert severity="error" sx={{ mb: 2, maxWidth: 600 }}>
          <h6 className="cn-text-h6 mb-[0.35em]">
            Erreur de thème détectée
          </h6>
          <p className="cn-text-body1">
            {themeError}
          </p>
          <p className="cn-text-body2 mt-1.5">
            Veuillez rafraîchir la page ou contacter l'administrateur.
          </p>
        </Alert>
      </div>
    );
  }

  if (!themeReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[100vh]">
        <Spinner className="size-[60px] mb-3" />
        <h6 className="cn-text-h6 text-muted-foreground">
          Chargement du thème...
        </h6>
      </div>
    );
  }

  return <>{children}</>;
}
