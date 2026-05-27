import React from 'react';
import { Box, Paper, Typography, useTheme, alpha } from '@mui/material';

/**
 * Wrapper visuel commun aux sections de la page Settings > IA.
 *
 * <h3>Pourquoi</h3>
 * Avant, chaque section (PlatformAiConfigSection, AssistantBriefingPrefs,
 * KnowledgeBaseAdmin) avait son propre traitement esthetique : border violet +
 * gradient lavande pour l'une, bgcolor teinte primary 2.5% pour les autres,
 * tailles de titre incoherentes (h6 vs subtitle1). Resultat : empilement
 * visuel chaotique avec 3 esthetiques differentes.
 *
 * Ce composant impose un cadre unique :
 * - {@code Paper variant="outlined"} avec border discret (divider theme)
 * - {@code bgcolor: 'background.paper'} (s'adapte light/dark theme)
 * - Header titre + subtitle aligne a gauche, action optionnelle a droite
 * - Padding cohérent (24px desktop, 16px mobile)
 * - {@code mb: 3} entre sections
 *
 * <h3>Anti-patterns evites (Impeccable rules)</h3>
 * - Pas de dot colore au-dessus du title (AI-slop "templated")
 * - Pas de gradient text ni gradient background (interdit absolu)
 * - Pas de side-stripe colore en haut/cote (interdit absolu)
 * - Pas d'icon-badge rounded au-dessus du heading (pattern AI generique)
 * - Pas de bgcolor teinte brand (cassait le contraste sur la page)
 */
export interface AiSettingsCardProps {
  /** Titre principal de la section. */
  title: React.ReactNode;
  /** Sous-titre / description courte sous le titre. */
  subtitle?: React.ReactNode;
  /**
   * Slot d'action a droite du header (bouton primaire, icon button, etc.).
   * Reste aligne baseline avec le titre pour ne pas casser la grille verticale.
   */
  action?: React.ReactNode;
  /** Contenu de la section. */
  children: React.ReactNode;
  /** Override la marge basse (defaut mb=3). */
  mb?: number;
}

export default function AiSettingsCard({
  title,
  subtitle,
  action,
  children,
  mb = 3,
}: AiSettingsCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      variant="outlined"
      sx={{
        mb,
        p: { xs: 2, md: 3 },
        borderRadius: 2.5,
        borderColor: isDark
          ? alpha(theme.palette.divider, 0.5)
          : theme.palette.divider,
        bgcolor: 'background.paper',
        boxShadow: isDark ? 'none' : `0 1px 2px ${alpha('#1F2937', 0.04)}`,
        transition: 'border-color 200ms ease',
        '&:hover': {
          borderColor: isDark
            ? alpha(theme.palette.divider, 0.7)
            : alpha(theme.palette.text.primary, 0.18),
        },
      }}
    >
      {(title || subtitle || action) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'flex-start' },
            justifyContent: 'space-between',
            gap: 2,
            mb: 2.5,
            flexDirection: { xs: 'column', md: 'row' },
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {title && (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', md: '1.0625rem' },
                  lineHeight: 1.3,
                  color: 'text.primary',
                  textWrap: 'balance',
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  maxWidth: 720,
                  lineHeight: 1.5,
                  fontSize: '0.8125rem',
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && (
            <Box sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', md: 'flex-start' } }}>
              {action}
            </Box>
          )}
        </Box>
      )}
      {children}
    </Paper>
  );
}
