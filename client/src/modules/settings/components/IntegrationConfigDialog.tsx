import React from 'react';
import { Dialog, DialogContent, IconButton, Box, useTheme, useMediaQuery } from '@mui/material';
import { Close as CloseIcon } from '../../../icons';

/**
 * Modal generique pour configurer une integration (signature, pricing,
 * comptabilite, conformite, ...).
 *
 * <h2>UX intent</h2>
 * <p>Le clic sur une card de la grille d'integrations ouvre ce modal,
 * plutot que de render un panneau de config inline en dessous. Avantages :</p>
 * <ul>
 *   <li>Pas de layout shift entre les sections</li>
 *   <li>Le contexte de selection (grille) reste visible (overlay)</li>
 *   <li>Mobile-friendly : full-screen automatique sous breakpoint sm</li>
 *   <li>Scalable : 50 integrations = toujours le meme pattern</li>
 * </ul>
 *
 * <h2>API</h2>
 * <p>Wrapper minimaliste : on passe le composant enfant (Card existante :
 * ApiKeyProviderCard, OAuthProviderCard, PricingProviderCard) en tant que
 * children. La Card retient sa logique propre (load status, connect,
 * disconnect, formulaire). Ce composant ajoute juste la coque modale +
 * bouton de fermeture.</p>
 */

interface IntegrationConfigDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Largeur max du modal (defaut sm = 600px, suffisant pour les forms). */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function IntegrationConfigDialog({
  open,
  onClose,
  children,
  maxWidth = 'sm',
}: IntegrationConfigDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          // Skin (radius, ombre, backdrop) herite du theme Dialog global Signature.
          borderRadius: fullScreen ? 0 : undefined,
          overflow: 'visible',
        },
      }}
    >
      {/* Bouton de fermeture floating en haut-droite */}
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          aria-label="Fermer"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            width: 28,
            height: 28,
            color: 'text.secondary',
            backgroundColor: 'var(--card)',
            border: '1px solid',
            borderColor: 'divider',
            transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            '&:hover': {
              backgroundColor: 'background.paper',
              borderColor: 'text.secondary',
              color: 'text.primary',
            },
          }}
        >
          <CloseIcon size={14} strokeWidth={2.2} />
        </IconButton>

        <DialogContent
          sx={{
            p: 0,
            // La card interne (ApiKeyProviderCard, etc.) a sa propre Paper avec
            // bordure. On la rend sans padding pour qu'elle prenne tout le
            // modal sans double bordure.
            '& > .MuiPaper-root': {
              borderRadius: fullScreen ? 0 : '14px',
              border: 'none',
              boxShadow: 'none',
            },
          }}
        >
          {children}
        </DialogContent>
      </Box>
    </Dialog>
  );
}
