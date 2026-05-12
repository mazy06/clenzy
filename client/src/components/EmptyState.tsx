import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { useIconSize } from '../hooks/useResponsiveSize';

interface EmptyStateProps {
  /** Icone affichee en grand, ton text.disabled. */
  icon: React.ReactNode;
  /** Titre principal (variant h6 par defaut). */
  title: string;
  /** Description optionnelle sous le titre. */
  description?: string;
  /** Slot d'action en bas (ex. : un bouton CTA). */
  action?: React.ReactNode;
  /** Style du conteneur. 'dashed' = bordure pointillee, 'plain' = ligne plein, 'transparent' = pas de bordure. */
  variant?: 'dashed' | 'plain' | 'transparent';
  /** Hauteur min. Default : auto. */
  minHeight?: number | string;
}

/**
 * Etat vide standardise pour les listes / tableaux / sections sans contenu.
 *
 * Caracteristiques :
 *  - Icone discrete en `text.disabled` taille hero (responsive)
 *  - Titre + description centres
 *  - Variant 'dashed' (default) pour les zones "ajoute ton premier X"
 *  - Variant 'plain' pour les errors / etats info
 *  - Variant 'transparent' pour les contenants qui ont deja leur propre bordure
 *
 * Usage :
 *   <EmptyState
 *     icon={<Inventory2 />}
 *     title="Aucun objet reference"
 *     description="Remplis le formulaire ci-dessus pour ajouter ton premier objet"
 *   />
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'dashed',
  minHeight,
}: EmptyStateProps) {
  const heroSize = useIconSize('hero');

  return (
    <Paper
      variant={variant === 'transparent' ? 'elevation' : 'outlined'}
      elevation={0}
      sx={{
        py: 4,
        px: 3,
        textAlign: 'center',
        borderStyle: variant === 'dashed' ? 'dashed' : 'solid',
        borderRadius: 2,
        bgcolor: variant === 'transparent' ? 'transparent' : 'background.paper',
        borderColor: variant === 'transparent' ? 'transparent' : 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        ...(minHeight && { minHeight }),
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 0.5 }}>
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
              size: heroSize,
              strokeWidth: 1.5,
            })
          : icon}
      </Box>
      <Typography variant="h6" sx={{ color: 'text.secondary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'text.disabled', maxWidth: 480 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Paper>
  );
}
