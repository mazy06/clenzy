import React from 'react';
import { Paper, Box } from '@mui/material';
import { Lightbulb } from '../icons';
import { useIconSize } from '../hooks/useResponsiveSize';

interface EmptyStateProps {
  /** Icone affichee en grand, ton var(--faint). */
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
 *  - Icone discrete en `var(--faint)` taille hero (responsive)
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
        borderRadius: 'var(--radius-lg)',
        bgcolor: variant === 'transparent' ? 'transparent' : 'var(--card)',
        borderColor: variant === 'transparent' ? 'transparent' : 'var(--line)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        animation: 'clz-fade-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        ...(minHeight && { minHeight }),
      }}
    >
      <span className="inline-flex text-[var(--faint)] mb-0.5">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
              size: heroSize,
              strokeWidth: 1.5,
            })
          : icon}
      </span>
      <h6 className="cn-text-h6 font-[var(--font-display)] text-[var(--ink)]">
        {title}
      </h6>
      {description && (
        <p className="cn-text-body2 text-[var(--muted)] max-w-[480px]">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex gap-1.5 items-center flex-wrap justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
      {tip && (
        <Box
          sx={{
            mt: 2,
            px: 1.25,
            py: 0.75,
            borderRadius: 'var(--radius-sm)',
            bgcolor: 'var(--warn-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            maxWidth: 480,
            border: '1px solid',
            borderColor: 'color-mix(in srgb, var(--warn) 30%, transparent)',
          }}
        >
          <span className="inline-flex text-[var(--warn)] shrink-0">
            <Lightbulb size={12} strokeWidth={2} />
          </span>
          <span className="cn-text-caption text-[var(--warn)] text-start leading-[1.35]">
            {tip}
          </span>
        </Box>
      )}
    </Paper>
  );
}
