/* ============================================================
   Grammaire des verbes d'action HITL (constellation métiers, Phase 1)

   La projection l'a prouvé : le verbe porte le sens de la décision —
   « Verser » ≠ « Publier » ≠ « Bloquer » ≠ un « Appliquer » générique.
   Ce registre mappe chaque `applyActionType` sur son verbe CTA (clé i18n
   + icône) ; il est consommé par les trois surfaces de file
   (ConstellationQueue, TaskDeckQueue, PendingActionCard).

   Hors registre (flux dédiés, PAS des verbes) :
   - PRICE_DROP        → modale « Ajuster les tarifs » (simulation)
   - REVIEW_DRAFT_REPLY → modale « Répondre » (ReviewReplyDialog)
   Les types inconnus retombent sur « Appliquer » (comportement historique).
   ============================================================ */

import { Check, CalendarToday, Payments, Refresh, Schedule, Send } from '../../../icons';

export interface ActionVerb {
  labelKey: string;
  fallback: string;
  /** Composant d'icône du barrel (rendu en `<verb.Icon size={15} />`). */
  Icon: typeof Check;
}

const DEFAULT_VERB: ActionVerb = {
  labelKey: 'supervision.apply.action',
  fallback: 'Appliquer',
  Icon: Check,
};

/**
 * Un verbe par type appliqué DIRECTEMENT (sans modale intermédiaire).
 * Les types à venir (Phases 2-4 du plan) s'ajoutent ici, une ligne chacun.
 */
const VERBS: Record<string, ActionVerb> = {
  CALENDAR_BLOCK: { labelKey: 'supervision.verbs.block', fallback: 'Bloquer', Icon: CalendarToday },
  CLEANING_REQUEST: { labelKey: 'supervision.verbs.schedule', fallback: 'Planifier', Icon: Schedule },
  REASSIGN_CLEANING: { labelKey: 'supervision.verbs.reassign', fallback: 'Réaffecter', Icon: Refresh },
  DEPOSIT_REFUND: { labelKey: 'supervision.verbs.refund', fallback: 'Rembourser', Icon: Payments },
  DEPOSIT_RELEASE: { labelKey: 'supervision.verbs.release', fallback: 'Libérer', Icon: Payments },
  PAYMENT_REMINDER: { labelKey: 'supervision.verbs.remind', fallback: 'Relancer', Icon: Send },
};

/** Verbe CTA du type, ou « Appliquer » (icône Check) hors registre. */
export function verbFor(applyActionType: string | undefined): ActionVerb {
  return (applyActionType && VERBS[applyActionType]) || DEFAULT_VERB;
}
