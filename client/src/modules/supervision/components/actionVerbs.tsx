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

import { Check, CalendarToday, Edit, GppBad, Hand, Payments, Refresh, Schedule, Send, VisibilityOff } from '../../../icons';

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
  // Agent Synchronisation (Phase 2)
  ICAL_RETRY: { labelKey: 'supervision.verbs.retry', fallback: 'Relancer', Icon: Refresh },
  PARITY_REPUBLISH: { labelKey: 'supervision.verbs.republish', fallback: 'Republier', Icon: Refresh },
  // Messages sortants (Phase 2) — le verbe dit qu'un message PART vers le voyageur.
  NOISE_WARNING_SEND: { labelKey: 'supervision.verbs.send', fallback: 'Envoyer', Icon: Send },
  CART_RECOVERY_SEND: { labelKey: 'supervision.verbs.send', fallback: 'Envoyer', Icon: Send },
  // Agent Voyageur (Phase 2)
  GUIDE_SEND: { labelKey: 'supervision.verbs.send', fallback: 'Envoyer', Icon: Send },
  REVIEW_REQUEST_SEND: { labelKey: 'supervision.verbs.send', fallback: 'Envoyer', Icon: Send },
  // Opérations / Finance (Phase 2)
  CLEANING_PAYOUT: { labelKey: 'supervision.verbs.pay', fallback: 'Verser', Icon: Payments },
  FRAUD_BLOCK: { labelKey: 'supervision.verbs.block', fallback: 'Bloquer', Icon: GppBad },
  // Conformité / Propriétaire (Phase 2)
  POLICE_DECLARE: { labelKey: 'supervision.verbs.declare', fallback: 'Télédéclarer', Icon: Check },
  MANDATE_SIGN_SEND: { labelKey: 'supervision.verbs.signSend', fallback: 'Envoyer pour signature', Icon: Send },
  OWNER_STATEMENT_SEND: { labelKey: 'supervision.verbs.send', fallback: 'Envoyer', Icon: Send },
  // Revenue / Croissance / Voyageur (Phase 3)
  MIN_STAY_RESTRICTION: { labelKey: 'supervision.verbs.restrict', fallback: 'Restreindre', Icon: CalendarToday },
  PROMO_DEACTIVATE: { labelKey: 'supervision.verbs.deactivate', fallback: 'Désactiver', Icon: VisibilityOff },
  UPSELL_OFFER: { labelKey: 'supervision.verbs.send', fallback: 'Envoyer', Icon: Send },
  // Opérations maintenance (Phase 3)
  LOCK_BATTERY_REPLACE: { labelKey: 'supervision.verbs.schedule', fallback: 'Planifier', Icon: Schedule },
  PREVENTIVE_MAINTENANCE: { labelKey: 'supervision.verbs.schedule', fallback: 'Planifier', Icon: Schedule },
  // Finance incidents (Phase 3)
  DEPOSIT_WITHHOLD: { labelKey: 'supervision.verbs.withhold', fallback: 'Retenir', Icon: Payments },
  GOODWILL_REFUND: { labelKey: 'supervision.verbs.refund', fallback: 'Rembourser', Icon: Payments },
  // Relation propriétaire (Phase 3)
  OWNER_PAYOUT: { labelKey: 'supervision.verbs.approve', fallback: 'Approuver', Icon: Check },
  OWNER_WORKS_APPROVAL: { labelKey: 'supervision.verbs.send', fallback: 'Envoyer', Icon: Send },
  // Distribution (vague A tardive) — brouillons seulement, publication au Studio.
  SITE_TRANSLATION_DRAFT: { labelKey: 'supervision.verbs.translate', fallback: 'Traduire', Icon: Edit },
  // Escalades (vague C)
  OVERBOOKING_RESOLVE: { labelKey: 'supervision.verbs.resolve', fallback: 'Résoudre', Icon: Check },
  CONVERSATION_TAKEOVER: { labelKey: 'supervision.verbs.takeover', fallback: 'Reprendre la main', Icon: Hand },
};

/** Verbe CTA du type, ou « Appliquer » (icône Check) hors registre. */
export function verbFor(applyActionType: string | undefined): ActionVerb {
  return (applyActionType && VERBS[applyActionType]) || DEFAULT_VERB;
}
