import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { Lightbulb } from '../icons';
import { useIconSize } from '../hooks/useResponsiveSize';

interface EmptyStateProps {
  /** Icone affichee en grand, ton text.disabled. */
  icon: React.ReactNode;
  /** Titre principal (variant h6 par defaut). */
  title: string;
  /** Description optionnelle sous le titre. */
  description?: string;
  /** CTA principale (bouton primaire). */
  action?: React.ReactNode;
  /** CTA secondaire (texte / lien) — affichee à droite de l'action principale. */
  secondaryAction?: React.ReactNode;
  /**
   * Astuce contextuelle affichee dans un bandeau discret en bas.
   * Encourage la decouverte ("Saviez-vous que...") plutôt qu'un message neutre.
   */
  tip?: React.ReactNode;
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
 *  - Slot `tip` : bandeau pédagogique (Impeccable empty-state law :
 *    *"Design empty states that teach the interface, not just say nothing here"*)
 *  - Slot `secondaryAction` : action de découverte alternative
 *
 * Usage :
 *   <EmptyState
 *     icon={<Inventory2 />}
 *     title="Aucun objet reference"
 *     description="Remplis le formulaire ci-dessus pour ajouter ton premier objet"
 *     action={<Button variant="outlined">Créer un objet</Button>}
 *     secondaryAction={<Button>Importer un CSV</Button>}
 *     tip="Les objets sont synchronisés en temps réel avec ton inventaire."
 *   />
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  tip,
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
        animation: 'clz-fade-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
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
      {(action || secondaryAction) && (
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {action}
          {secondaryAction}
        </Box>
      )}
      {tip && (
        <Box
          sx={{
            mt: 2,
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            bgcolor: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(212, 165, 116, 0.10)'
              : 'rgba(212, 165, 116, 0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            maxWidth: 480,
            border: '1px solid',
            borderColor: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(212, 165, 116, 0.25)'
              : 'rgba(212, 165, 116, 0.30)',
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', color: 'warning.dark', flexShrink: 0 }}>
            <Lightbulb size={12} strokeWidth={2} />
          </Box>
          <Typography variant="caption" sx={{ color: 'warning.dark', textAlign: 'left', lineHeight: 1.35 }}>
            {tip}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
