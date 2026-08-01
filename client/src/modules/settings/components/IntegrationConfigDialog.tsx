import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui';

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
 *   <li>Mobile-friendly : pleine largeur sous 600 px</li>
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

/**
 * Equivalents des paliers `maxWidth` de MUI, en classes LITTERALES : une classe
 * Tailwind ne peut pas naitre d'une variable, elle doit exister a la compilation.
 */
const MAX_WIDTH_CLASS: Record<NonNullable<IntegrationConfigDialogProps['maxWidth']>, string> = {
  xs: 'max-w-[444px]',
  sm: 'max-w-[600px]',
  md: 'max-w-[900px]',
  lg: 'max-w-[1200px]',
};

export default function IntegrationConfigDialog({
  open,
  onClose,
  children,
  maxWidth = 'sm',
}: IntegrationConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* La card interne (ApiKeyProviderCard, etc.) porte deja sa bordure et son
          rayon : on annule les siens pour ne pas doubler le liseré du modal.
          `aria-describedby={undefined}` : le contenu est libre, pas de description. */}
      <DialogContent
        aria-describedby={undefined}
        className={
          `${MAX_WIDTH_CLASS[maxWidth]} w-full p-0 max-h-[90vh] overflow-y-auto ` +
          'max-[599px]:max-w-full max-[599px]:rounded-none ' +
          '[&>[data-slot=card]]:rounded-[14px] [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:shadow-none ' +
          'max-[599px]:[&>[data-slot=card]]:rounded-none'
        }
      >
        {/* Titre porteur du nom accessible du dialogue : le contenu est libre,
            aucun des enfants ne garantit un intitulé. */}
        <DialogTitle className="sr-only">Configuration de l'intégration</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
