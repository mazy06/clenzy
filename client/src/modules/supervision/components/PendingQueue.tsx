/* ============================================================
   <PendingQueue> — file « Attend ta validation »

   Pile de PendingActionCard. Deux dispositions :
   - 'floating' : superposée en haut-droite de la constellation (par logement)
   - 'panel'    : colonne pleine hauteur avec état vide (vue d'ensemble, Phase 6)
   ============================================================ */

import { useState } from 'react';
import { CheckCircle } from '../../../icons';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';
import EmptyState from '../../../components/baitly/EmptyState';
import ReviewReplyDialog from '../../../components/baitly/ReviewReplyDialog';
import { PendingActionCard } from './PendingActionCard';
import type { OpenReviewPayload } from './ConstellationQueue';
import type { PendingAction, PortfolioPendingAction } from '../types';

export interface PendingQueueProps {
  actions: (PendingAction | PortfolioPendingAction)[];
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: PendingAction | PortfolioPendingAction) => void;
  variant?: 'floating' | 'panel';
}

export function PendingQueue({ actions, onValidate, onEdit, onAdjustPrice, variant = 'floating' }: PendingQueueProps) {
  const { t } = useTranslation();

  // Modale de réponse à un avis (composant du dashboard, réutilisé tel quel).
  // Montée SEULEMENT ouverte : elle porte des hooks liés au Router.
  const [openReview, setOpenReview] = useState<OpenReviewPayload | null>(null);

  // Disposition flottante : rien à afficher quand la file est vide.
  if (variant === 'floating' && actions.length === 0) return null;

  if (actions.length === 0) {
    return (
      <div data-pending-empty>
        {/* Le conteneur (carte du portefeuille) porte déjà sa bordure → variante transparente. */}
        <EmptyState
          variant="transparent"
          icon={<CheckCircle className="text-success" />}
          title={t('supervision.hitl.empty')}
        />
      </div>
    );
  }

  return (
    // En 'floating' : hauteur max mesurée (bornée au viewport, cf. SupervisionPanel)
    // posée DIRECTEMENT sur la colonne → elle prend min(contenu, maxHeight) et scrolle.
    // (Pas de flex:1 : dans un parent à height auto, il collapse à 0.) La colonne démarre
    // à ~278px du haut, donc calc(100vh - 300px) la fait toujours finir avant le bas de
    // fenêtre → dernière carte atteignable au scroll (vérifié dans Chrome). Scrollbar
    // masquée (scroll actif) + padding bas pour dégager la DERNIÈRE carte.
    // `overscroll-contain` : le planning détourne la molette verticale en scroll
    // horizontal, ce marqueur fait respecter le scroll vertical natif (cf. useInfiniteTimeline).
    // `-ms-overflow-style` abandonné au passage : IE/Edge legacy sont hors cible Tailwind v4.
    <div
      data-pending-queue
      data-vertical-scroll
      className={cn(
        'flex flex-col gap-[7.5px] overscroll-contain',
        variant === 'floating'
          ? 'w-[300px] max-h-[max(220px,calc(100vh-300px))] overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'w-full overflow-y-visible',
      )}
    >
      {actions.map((action) => (
        <PendingActionCard
          key={action.id}
          action={action}
          onValidate={onValidate}
          onEdit={onEdit}
          onAdjustPrice={onAdjustPrice}
          onOpenReview={setOpenReview}
        />
      ))}

      {openReview && (
        <ReviewReplyDialog
          reviewId={openReview.reviewId}
          preview={{ guestName: openReview.guestName, rating: openReview.rating }}
          onClose={() => setOpenReview(null)}
          // Réponse publiée : la carte HITL est remplie, on l'écarte (dismiss
          // serveur) — surtout PAS onValidate, qui publierait le brouillon IA
          // une seconde fois par-dessus la réponse choisie.
          onPublished={() => onEdit(openReview.actionId)}
        />
      )}
    </div>
  );
}
