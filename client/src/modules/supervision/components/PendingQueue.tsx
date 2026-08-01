/* ============================================================
   <PendingQueue> — file « Attend ta validation »

   Pile de PendingActionCard. Deux dispositions :
   - 'floating' : superposée en haut-droite de la constellation (par logement)
   - 'panel'    : colonne pleine hauteur avec état vide (vue d'ensemble, Phase 6)
   ============================================================ */

import { CheckCircle } from '../../../icons';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';
import { PendingActionCard } from './PendingActionCard';
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

  // Disposition flottante : rien à afficher quand la file est vide.
  if (variant === 'floating' && actions.length === 0) return null;

  if (actions.length === 0) {
    return (
      <div className="flex items-center gap-[9px] p-[14px 8px] text-[var(--muted)]" data-pending-empty>
        <CheckCircle size={28} style={{ color: 'var(--ok)', flexShrink: 0 }} />
        <div>
          <div className="text-[13.5px] font-extrabold text-[var(--ink,_#1b2240)]">{t('supervision.hitl.empty')}</div>
        </div>
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
        <PendingActionCard key={action.id} action={action} onValidate={onValidate} onEdit={onEdit} onAdjustPrice={onAdjustPrice} />
      ))}
    </div>
  );
}
