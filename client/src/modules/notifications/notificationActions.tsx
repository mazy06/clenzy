import React from 'react';
import {
  Assignment,
  Build,
  CalendarToday,
  Check,
  Description,
  Email,
  EventNote,
  Groups,
  Hub,
  Info,
  Inventory2,
  Payment,
  Payments,
  Refresh,
  Schedule,
  Send,
  Star,
  Warning,
} from '../../icons';
import { verbFor } from '../supervision/components/actionVerbs';
import type { Notification } from '../../services/api';

/**
 * Catalogue des ACTIONS METIER d'une notification.
 *
 * Une notification dit ce qui s'est passe ; elle ne disait pas ce qu'il y a a
 * FAIRE. « Stock bas : Taies d'oreiller (4 restant) » se lit vite, mais le
 * geste — commander le reassort — vivait dans un autre ecran, sans que rien ne
 * l'y relie. Ce catalogue nomme le geste et mene la ou il s'execute.
 *
 * <p><b>Ce que ces boutons font, et ne font pas.</b> Ils NAVIGUENT vers
 * l'endroit qui porte l'action ; ils ne l'executent pas depuis la fiche. Les
 * actions du produit se re-verifient a l'application (etat relu, montants
 * recalcules, refus explicite si la situation a change) — rejouer ce contrat
 * dans un second ecran le dupliquerait, et deux copies divergent. Le libelle
 * dit donc l'intention, le clic emmene au bon endroit.</p>
 *
 * <p>La cible est presque toujours l'`actionUrl` de la notification : c'est
 * l'emetteur, qui connait l'evenement, qui a choisi le lien profond. Le
 * catalogue apporte le NOM du geste, pas une route inventee. Les rares cibles
 * explicites ci-dessous sont des routes verifiees du registre applicatif.</p>
 */

export interface NotificationBusinessAction {
  labelKey: string;
  fallback: string;
  Icon: typeof Check;
  /** Cible resolue depuis la notification ; `null` = action non proposable. */
  href: (notification: Notification) => string | null;
}

/** Lien profond choisi par l'emetteur. */
const own = (notification: Notification) => notification.actionUrl ?? null;

/** Cible fixe (route verifiee du registre applicatif). */
const at = (path: string) => () => path;

/** Entier porte par les faits de la notification (identifiant de navigation). */
function factId(notification: Notification, key: string): number | null {
  const raw = notification.metadata?.[key];
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Un geste du catalogue. `intent` est un nom court, prefixe ici en cle i18n :
 * les libelles vivent dans les locales, jamais en dur dans le catalogue.
 * (Les gestes de la constellation, eux, reutilisent tels quels les cles du
 * registre de verbes partage avec la file de supervision.)
 */
const act = (
  intent: string,
  fallback: string,
  Icon: typeof Check,
  href: (n: Notification) => string | null = own,
): NotificationBusinessAction => ({
  labelKey: `notifications.detail.act.${intent}`,
  fallback,
  Icon,
  href,
});

const SUPERVISION_QUEUE = '/planning';

/**
 * Lien profond vers la carte HITL elle-meme : le planning ouvre l'accordeon du
 * logement concerne et vise l'agent qui la porte. Sans ces reperes on
 * atterrissait sur le planning nu, a charge de l'operateur de retrouver la
 * carte qui l'avait fait cliquer.
 */
function supervisionQueueHref(notification: Notification): string {
  const propertyId = factId(notification, 'propertyId');
  const module = notification.metadata?.module;
  if (!propertyId) return SUPERVISION_QUEUE;
  const params = new URLSearchParams({ property: String(propertyId) });
  if (typeof module === 'string' && module) params.set('agent', module);
  return `${SUPERVISION_QUEUE}?${params.toString()}`;
}

/**
 * Cle de notification → gestes proposes, du plus attendu au plus accessoire.
 * Une cle absente n'a pas d'action metier propre : la fiche retombe alors sur
 * « Ouvrir <ecran> ».
 */
const ACTIONS: Record<string, NotificationBusinessAction[]> = {
  // ─── Interventions ────────────────────────────────────────────────────────
  INTERVENTION_CREATED: [act('assignWorker', 'Assigner un intervenant', Groups)],
  INTERVENTION_ASSIGNED_TO_USER: [
    act('startMission', 'Démarrer la mission', Build, (n) => {
      const id = factId(n, 'interventionId');
      return id ? `/interventions/${id}/suivi` : own(n);
    }),
  ],
  INTERVENTION_ASSIGNED_TO_TEAM: [act('openMission', 'Ouvrir la mission', Build)],
  INTERVENTION_AWAITING_VALIDATION: [act('assignTeam', 'Assigner une équipe', Groups)],
  INTERVENTION_AWAITING_PAYMENT: [
    act('settleIntervention', 'Régler l’intervention', Payment, at('/interventions/pending-payment')),
  ],
  INTERVENTION_COMPLETED: [act('reviewWork', 'Contrôler le travail rendu', Check)],
  INTERVENTION_OVERDUE: [act('rescheduleIntervention', 'Replanifier l’intervention', Schedule)],
  INTERVENTION_REOPENED: [act('rescheduleIntervention', 'Replanifier l’intervention', Schedule)],
  INTERVENTION_PHOTOS_ADDED: [act('reviewWork', 'Contrôler le travail rendu', Check)],

  // ─── Demandes de service ──────────────────────────────────────────────────
  SERVICE_REQUEST_CREATED: [act('handleRequest', 'Traiter la demande', Assignment)],
  SERVICE_REQUEST_URGENT: [act('handleRequestUrgent', 'Traiter en priorité', Warning)],
  SERVICE_REQUEST_NO_TEAM_AVAILABLE: [
    act('assignManually', 'Assigner manuellement', Groups),
    act('openQueue', 'Ouvrir la file de supervision', Info, at(SUPERVISION_QUEUE)),
  ],
  SERVICE_REQUEST_ESCALATION: [act('takeOverRequest', 'Reprendre la demande en main', Warning)],
  ISSUE_REPORTED: [act('convertToIntervention', 'Convertir en intervention', Build)],

  // ─── Paiements ────────────────────────────────────────────────────────────
  PAYMENT_FAILED: [
    act('retryPayment', 'Relancer le paiement', Refresh),
    act('openBilling', 'Ouvrir la facturation', Payment, at('/billing')),
  ],
  PAYMENT_DEFERRED_REMINDER: [act('retryPayment', 'Relancer le paiement', Refresh)],
  PAYMENT_DEFERRED_OVERDUE: [act('retryPayment', 'Relancer le paiement', Refresh)],
  PAYMENT_INCIDENT_OPENED: [act('handleIncident', 'Traiter l’incident de paiement', Warning)],
  PAYMENT_GROUPED_FAILED: [act('retryPayment', 'Relancer le paiement', Refresh)],

  // ─── Versements ───────────────────────────────────────────────────────────
  PAYOUT_PENDING_APPROVAL: [act('approvePayout', 'Approuver le versement', Check)],
  PAYOUT_FAILED: [act('retryPayout', 'Relancer le versement', Refresh)],
  PAYOUT_BLOCKED_ONBOARDING: [
    act('completePayoutSetup', 'Compléter la configuration de versement', Payments,
      at('/settings?tab=my-payouts-pro')),
  ],
  PAYOUT_CONFIG_SUBMITTED: [act('verifyPayoutConfig', 'Vérifier la configuration', Check)],

  // ─── Réservations & séjours ───────────────────────────────────────────────
  RESERVATION_CREATED: [
    act('checkStay', 'Vérifier le séjour', EventNote),
    act('openPlanning', 'Ouvrir le planning', CalendarToday, at('/planning')),
  ],
  RESERVATION_CANCELLED: [
    act('checkCalendar', 'Vérifier le calendrier libéré', CalendarToday, at('/planning')),
    act('openReservation', 'Ouvrir la réservation', EventNote),
  ],
  BOOKING_FRAUD_REVIEW: [act('reviewFraud', 'Examiner la réservation à risque', Warning)],
  BOOKING_INQUIRY_RECEIVED: [act('answerInquiry', 'Répondre à la demande', Send)],
  ACCESS_CODE_ROTATED: [act('updateKeybox', 'Mettre à jour la boîte à clés', Info)],
  GUEST_NO_EMAIL_FOR_CHECKIN: [
    act('completeGuest', 'Compléter la fiche voyageur', Assignment, at('/guests')),
  ],

  // ─── Messagerie ───────────────────────────────────────────────────────────
  GUEST_MESSAGE_FAILED: [
    act('resendMessage', 'Renvoyer le message', Send, at('/messaging/history')),
    act('completeGuest', 'Compléter la fiche voyageur', Assignment, at('/guests')),
  ],
  CONTACT_FORM_RECEIVED: [act('reply', 'Répondre', Email)],
  CONTACT_MESSAGE_RECEIVED: [act('reply', 'Répondre', Email)],
  CONVERSATION_NEW_MESSAGE: [act('replyGuest', 'Répondre au voyageur', Email)],
  CONVERSATION_ASSIGNED: [act('openConversation', 'Ouvrir la conversation', Email)],
  CONCIERGE_ESCALATION: [act('takeOverConversation', 'Reprendre la conversation en main', Email)],

  // ─── Avis ─────────────────────────────────────────────────────────────────
  REVIEW_RECEIVED: [act('replyReview', 'Répondre à l’avis', Star, at('/channels/reviews'))],
  REVIEW_NEGATIVE_ALERT: [act('replyReview', 'Répondre à l’avis', Star, at('/channels/reviews'))],

  // ─── Documents & contrats ─────────────────────────────────────────────────
  DOCUMENT_GENERATION_FAILED: [
    act('retryGeneration', 'Relancer la génération', Refresh, at('/documents?tab=history')),
  ],
  DOCUMENT_SENT_BY_EMAIL: [
    act('openSendHistory', 'Voir l’historique d’envoi', Description, at('/documents?tab=history')),
  ],
  CONTRACT_SIGNED: [act('openContract', 'Ouvrir le mandat', Description, at('/contracts'))],

  // ─── Synchronisation & canaux ─────────────────────────────────────────────
  CHANNEX_SYNC_ERROR: [
    act('diagnoseSync', 'Diagnostiquer la synchronisation', Refresh, at('/admin/sync')),
    act('openChannels', 'Ouvrir les canaux', Hub, at('/channels')),
  ],
  CHANNEX_RATE_ERROR: [act('diagnoseSync', 'Diagnostiquer la synchronisation', Refresh, at('/admin/sync'))],
  CHANNEX_SYNC_WARNING: [act('diagnoseSync', 'Diagnostiquer la synchronisation', Refresh, at('/admin/sync'))],
  CHANNEX_UNMAPPED_BOOKING: [act('mapProperty', 'Rattacher le logement', Hub, at('/channels'))],
  CHANNEX_PRICE_DRIFT_DETECTED: [
    act('republishRates', 'Republier les tarifs', Refresh, at(SUPERVISION_QUEUE)),
    act('openPricing', 'Ouvrir la tarification', Payment, at('/tarification')),
  ],
  CHANNEX_RESTRICTION_DRIFT_DETECTED: [
    act('republishRates', 'Republier les tarifs', Refresh, at(SUPERVISION_QUEUE)),
  ],
  CHANNEX_AIRBNB_REQUEST: [act('openChannels', 'Ouvrir les canaux', Hub, at('/channels'))],
  CHANNEX_CHANNEL_EVENT: [act('openChannels', 'Ouvrir les canaux', Hub, at('/channels'))],
  ICAL_IMPORT_FAILED: [act('retryImport', 'Relancer l’import', Refresh)],
  ICAL_IMPORT_PARTIAL: [act('retryImport', 'Relancer l’import', Refresh)],
  WEBHOOK_DELIVERY_FAILED: [act('replayDelivery', 'Rejouer la livraison', Refresh)],

  // ─── Bruit & objets connectés ─────────────────────────────────────────────
  NOISE_ALERT_WARNING: [
    act('warnGuest', 'Avertir le voyageur', Send, at(SUPERVISION_QUEUE)),
    act('openNoiseSensors', 'Ouvrir les capteurs de bruit', Info, at('/connected-objects/noise')),
  ],
  NOISE_ALERT_CRITICAL: [
    act('warnGuest', 'Avertir le voyageur', Send, at(SUPERVISION_QUEUE)),
    act('openNoiseSensors', 'Ouvrir les capteurs de bruit', Info, at('/connected-objects/noise')),
  ],
  IOT_SMOKE_DETECTED: [act('checkProperty', 'Vérifier le logement', Warning)],
  IOT_MOTION_DETECTED: [act('checkProperty', 'Vérifier le logement', Warning)],
  GUEST_DOOR_UNLOCKED: [act('openLocks', 'Voir les serrures', Info, at('/connected-objects/locks'))],

  // ─── Comptabilité, KPI, plateforme ────────────────────────────────────────
  RECONCILIATION_FAILED: [act('openAccounting', 'Ouvrir la comptabilité', Payment, at('/accounting'))],
  RECONCILIATION_DIVERGENCE_HIGH: [
    act('openAccounting', 'Ouvrir la comptabilité', Payment, at('/accounting')),
  ],
  KPI_THRESHOLD_BREACH: [act('openKpi', 'Ouvrir les indicateurs', Info, at('/admin/kpi'))],
  KPI_CRITICAL_FAILURE: [act('openKpi', 'Ouvrir les indicateurs', Info, at('/admin/kpi'))],
  OPS_ALERT: [act('openMonitoring', 'Ouvrir le monitoring', Warning, at('/admin/monitoring'))],
  INCIDENT_OPENED: [act('openMonitoring', 'Ouvrir le monitoring', Warning, at('/admin/monitoring'))],
  AI_MODEL_EOL: [act('changeAiModel', 'Changer de modèle', Refresh, at('/settings?tab=ai'))],
  KB_INDEX_RETUNE: [act('openKnowledgeBase', 'Ouvrir la base de connaissances', Info, at('/settings?tab=ai'))],
  VISION_USAGE_THRESHOLD_REACHED: [act('openAiCredits', 'Ouvrir les crédits IA', Info, at('/settings?tab=ai'))],

  // ─── Constellation d'agents ───────────────────────────────────────────────
  SUPERVISION_AUTO_APPLIED: [
    act('reviewAutoApplied', 'Voir ce qui a été appliqué', Info, at(SUPERVISION_QUEUE)),
  ],
  SUPERVISION_AUTO_RULE_SUGGESTED: [
    act('tuneAutomation', 'Régler l’automatisation', Info, at('/automation-rules')),
  ],
  AUTOMATION_STAFF_ALERT: [act('tuneAutomation', 'Régler l’automatisation', Info, at('/automation-rules'))],
};

/**
 * Gestes proposes par une carte HITL de la constellation. Le verbe vient du
 * registre partage avec la file de supervision ({@link verbFor}) : « Commander »
 * pour un reassort, « Verser » pour un paiement — jamais un « Appliquer »
 * generique qui masquerait la nature de la decision.
 */
function supervisionActions(notification: Notification): NotificationBusinessAction[] {
  const actionType = notification.metadata?.actionType;
  const actions: NotificationBusinessAction[] = [];

  if (typeof actionType === 'string' && actionType) {
    const verb = verbFor(actionType);
    actions.push({
      labelKey: verb.labelKey,
      fallback: verb.fallback,
      Icon: verb.Icon,
      href: supervisionQueueHref,
    });
  } else {
    actions.push(act('openQueue', 'Ouvrir la file de supervision', Info, supervisionQueueHref));
  }

  // Le stock d'un consommable se lit et se corrige dans la fiche du logement :
  // commander n'est pas la seule issue — ajuster le seuil ou confier le
  // reassort a l'equipe de menage en sont d'autres.
  if (actionType === 'LINEN_STOCK_ORDER') {
    actions.push(act('openStock', 'Voir le stock du logement', Inventory2, (n) => {
      const propertyId = factId(n, 'propertyId');
      return propertyId ? `/properties/${propertyId}?tab=inventory&subtab=stock` : null;
    }));
  }

  return actions;
}

/**
 * Gestes proposes pour cette notification, deja resolus en liens. Une action
 * dont la cible ne se resout pas (identifiant absent des faits) n'est pas
 * proposee : mieux vaut un bouton de moins qu'un bouton qui ne mene nulle part.
 */
export function businessActionsFor(
  notification: Notification,
): { action: NotificationBusinessAction; href: string }[] {
  const key = notification.notificationKey;
  if (!key) return [];

  const candidates = key === 'SUPERVISION_SUGGESTION'
    ? supervisionActions(notification)
    : ACTIONS[key] ?? [];

  return candidates
    .map((action) => ({ action, href: action.href(notification) }))
    .filter((entry): entry is { action: NotificationBusinessAction; href: string } => entry.href !== null);
}

/** Cles de notification portant au moins un geste metier — utilisee par les tests. */
export const KEYS_WITH_BUSINESS_ACTION: string[] = [...Object.keys(ACTIONS), 'SUPERVISION_SUGGESTION'].sort();
