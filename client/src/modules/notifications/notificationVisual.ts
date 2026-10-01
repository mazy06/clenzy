import type { Notification } from '../../services/api/notificationsApi';
import {
  AGENT_ILLUSTRATIONS, structuredActionIllustration,
} from '../supervision/core/actionIllustration';
import type { NotificationIllustrationKey } from './notificationArtwork';

export type NotificationVisual =
  | { kind: 'stock'; name: string; stockItemId?: number }
  | { kind: 'illustration'; visual: NotificationIllustrationKey };

/** Event identity, never translated copy, selects the scene. Status remains live text. */
export const EVENT_ILLUSTRATIONS: Readonly<Record<string, NotificationIllustrationKey>> = {
  PROPERTY_CREATED: 'property',
  PROPERTY_UPDATED: 'property',
  PROPERTY_DELETED: 'property',
  PROPERTY_STATUS_CHANGED: 'property',
  PORTFOLIO_CREATED: 'property',
  PORTFOLIO_CLIENT_ADDED: 'property',
  PORTFOLIO_CLIENT_REMOVED: 'property',
  PORTFOLIO_UPDATED: 'property',

  TEAM_CREATED: 'team-directory',
  TEAM_UPDATED: 'team-directory',
  TEAM_DELETED: 'team-directory',
  TEAM_MEMBER_ADDED: 'team-directory',
  TEAM_MEMBER_REMOVED: 'team-directory',
  TEAM_ROLE_CHANGED: 'team-directory',
  TEAM_MEMBER_JOINED: 'team-directory',
  PORTFOLIO_TEAM_MEMBER_ADDED: 'team-directory',
  PORTFOLIO_TEAM_MEMBER_REMOVED: 'team-directory',

  INTERVENTION_ASSIGNED_TO_USER: 'team-assigned',
  INTERVENTION_ASSIGNED_TO_TEAM: 'team-assigned',
  SERVICE_REQUEST_ASSIGNED: 'team-assigned',
  SERVICE_REQUEST_TEAM_ASSIGNED: 'team-assigned',
  SERVICE_REQUEST_NO_TEAM_AVAILABLE: 'provider-search',
  TEAM_ASSIGNED_INTERVENTION: 'team-assigned',
  CONVERSATION_ASSIGNED: 'team-assigned',

  USER_CREATED: 'user-profile',
  USER_UPDATED: 'user-profile',
  USER_DELETED: 'user-profile',
  USER_ROLE_CHANGED: 'user-profile',
  USER_DEACTIVATED: 'user-profile',
  MARKETPLACE_APPLICATION_RECEIVED: 'user-profile',

  GDPR_DATA_EXPORTED: 'privacy',
  GDPR_USER_ANONYMIZED: 'privacy',
  GDPR_CONSENTS_UPDATED: 'privacy',

  PERMISSION_ROLE_UPDATED: 'security',
  PERMISSION_CACHE_INVALIDATED: 'security',
  BOOKING_FRAUD_REVIEW: 'security',
  IOT_MOTION_DETECTED: 'security',

  CONTACT_MESSAGE_SENT: 'message-sent',
  GUEST_MESSAGE_SENT: 'message-sent',
  CONTACT_MESSAGE_REPLIED: 'message-sent',
  DOCUMENT_SENT_BY_EMAIL: 'message-sent',

  CONTACT_MESSAGE_RECEIVED: 'message-received',
  CONVERSATION_NEW_MESSAGE: 'message-received',

  GUEST_MESSAGE_FAILED: 'message-delivery',
  MARKETPLACE_INVITATION_FAILED: 'message-delivery',

  DOCUMENT_GENERATED: 'document',
  DOCUMENT_GENERATION_FAILED: 'document-error',
  DOCUMENT_TEMPLATE_UPLOADED: 'document',
  CONTACT_FORM_RECEIVED: 'document',
  CONTACT_FORM_STATUS_CHANGED: 'document',
  CONTACT_MESSAGE_ARCHIVED: 'document',
  MARKETPLACE_APPLICATION_DOCUMENTS_ADDED: 'document',

  CONCIERGE_ESCALATION: 'conversation',

  ACCESS_CODE_ROTATED: 'access-code',
  SMART_LOCK_CODE_ROTATED_MANUALLY: 'access-code',

  SMART_LOCK_CODE_GENERATION_FAILED: 'access-problem',
  SMART_LOCK_CODE_DELIVERY_FAILED: 'access-problem',

  GUEST_DOOR_UNLOCKED: 'door-access',

  RESERVATION_CREATED: 'reservation',
  RESERVATION_UPDATED: 'reservation',
  RESERVATION_CANCELLED: 'reservation-cancelled',
  BOOKING_INQUIRY_RECEIVED: 'reservation',
  CHANNEX_AIRBNB_REQUEST: 'reservation',

  SERVICE_REQUEST_CREATED: 'service-request',
  SERVICE_REQUEST_UPDATED: 'service-request',
  SERVICE_REQUEST_APPROVED: 'service-request',
  SERVICE_REQUEST_REJECTED: 'request-rejected',
  SERVICE_REQUEST_CANCELLED: 'request-cancelled',
  SERVICE_REQUEST_URGENT: 'request-urgent',
  SERVICE_REQUEST_ESCALATION: 'request-urgent',

  ISSUE_REPORTED: 'property-maintenance',
  ISSUE_CONVERTED: 'property-maintenance',
  SERVICE_REQUEST_INTERVENTION_CREATED: 'property-maintenance',
  INTERVENTION_CREATED: 'property-maintenance',
  INTERVENTION_UPDATED: 'property-maintenance',
  INTERVENTION_STARTED: 'property-maintenance',
  INTERVENTION_PROGRESS_UPDATED: 'property-maintenance',
  INTERVENTION_REOPENED: 'property-maintenance',
  INTERVENTION_STATUS_CHANGED: 'property-maintenance',
  INTERVENTION_CANCELLED: 'request-cancelled',
  INTERVENTION_DELETED: 'request-cancelled',

  INTERVENTION_COMPLETED: 'intervention-completed',
  INTERVENTION_VALIDATED: 'intervention-completed',
  INTERVENTION_AWAITING_VALIDATION: 'work-review',
  INTERVENTION_PHOTOS_ADDED: 'work-review',
  INTERVENTION_NOTES_UPDATED: 'work-review',

  INTERVENTION_OVERDUE: 'intervention-overdue',
  INTERVENTION_REMINDER: 'assignment',

  PAYMENT_SESSION_CREATED: 'payment',
  PAYMENT_CONFIRMED: 'payment-confirmed',
  PAYMENT_FAILED: 'payment-failed',
  PAYMENT_GROUPED_SESSION_CREATED: 'payment',
  PAYMENT_GROUPED_CONFIRMED: 'payment-confirmed',
  PAYMENT_GROUPED_FAILED: 'payment-failed',
  PAYMENT_DEFERRED_REMINDER: 'payment-reminder',
  PAYMENT_DEFERRED_OVERDUE: 'payment-reminder',
  PAYMENT_REFUND_INITIATED: 'refund',
  PAYMENT_REFUND_COMPLETED: 'refund',
  INTERVENTION_AWAITING_PAYMENT: 'payment',
  PAYOUT_FAILED: 'payment-failed',

  PAYOUT_SENT: 'service-transfer',
  PAYOUT_BLOCKED_ONBOARDING: 'payout-blocked',

  PAYOUT_BATCH_GENERATED: 'owner-transfer',
  PAYOUT_PENDING_APPROVAL: 'owner-transfer',
  PAYOUT_APPROVED: 'owner-transfer',
  PAYOUT_EXECUTED: 'owner-transfer',
  PAYOUT_CONFIG_SUBMITTED: 'owner-transfer',
  PAYOUT_CONFIG_VERIFIED: 'owner-transfer',

  PAYMENT_INCIDENT_OPENED: 'dispute',

  CONTRACT_SIGNED: 'management-contract',

  ICAL_IMPORT_SUCCESS: 'channel-sync',
  ICAL_IMPORT_PARTIAL: 'sync-problem',
  ICAL_IMPORT_FAILED: 'sync-problem',
  ICAL_SYNC_COMPLETED: 'channel-sync',
  ICAL_FEED_DELETED: 'channel-sync',
  CHANNEX_SYNC_ERROR: 'sync-problem',
  CHANNEX_SYNC_RECOVERED: 'channel-sync',
  CHANNEX_SYNC_WARNING: 'sync-problem',

  CHANNEX_CHANNEL_EVENT: 'distribution',

  CHANNEX_UNMAPPED_BOOKING: 'booking-unmapped',

  CHANNEX_PRICE_DRIFT_DETECTED: 'pricing-alert',
  CHANNEX_RATE_ERROR: 'pricing-alert',
  GUEST_PRICING_PUSHED: 'pricing',

  CHANNEX_RESTRICTION_DRIFT_DETECTED: 'calendar',

  ICAL_AUTO_INTERVENTIONS_TOGGLED: 'automation',
  AI_MODEL_EOL: 'automation',
  KB_INDEX_RETUNE: 'automation',
  SUPERVISION_AUTO_APPLIED: 'automation',
  SUPERVISION_AUTO_RULE_SUGGESTED: 'automation',
  AUTOMATION_STAFF_ALERT: 'automation',
  VISION_USAGE_THRESHOLD_REACHED: 'automation',

  RECONCILIATION_COMPLETED: 'system-health',
  RECONCILIATION_DIVERGENCE_HIGH: 'system-incident',
  RECONCILIATION_FAILED: 'system-incident',
  KPI_THRESHOLD_BREACH: 'system-incident',
  KPI_CRITICAL_FAILURE: 'system-incident',
  INCIDENT_OPENED: 'system-incident',
  INCIDENT_RESOLVED: 'system-restored',
  WEBHOOK_DELIVERY_FAILED: 'system-incident',
  OPS_ALERT: 'system-incident',

  BRIEFING_READY: 'owner-report',

  GUEST_NO_EMAIL_FOR_CHECKIN: 'traveler-form',
  ONLINE_CHECKIN_STARTED: 'traveler-form',
  ONLINE_CHECKIN_COMPLETED: 'traveler-form',

  NOISE_ALERT_WARNING: 'noise',
  NOISE_ALERT_CRITICAL: 'noise',
  NOISE_ALERT_RESOLVED: 'noise-resolved',
  NOISE_ALERT_CONFIG_CHANGED: 'noise',

  REVIEW_RECEIVED: 'reviews',
  REVIEW_NEGATIVE_ALERT: 'review-negative',

  IOT_SMOKE_DETECTED: 'smoke-alert',
};

function lookup<T extends string>(values: Readonly<Record<string, T>>, key: unknown): T | undefined {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
}

/** Only structured identities select artwork. Unknown unrelated events keep their category icon. */
export function notificationVisual(notification: Notification): NotificationVisual | null {
  const facts = notification.metadata;
  // An explicit event owns its state: an old action hint cannot turn a failed
  // payment into a refund or a missing provider into an assigned team.
  const event = lookup(EVENT_ILLUSTRATIONS, notification.notificationKey);
  const supervision = notification.notificationKey?.startsWith('SUPERVISION_');
  if (event && !supervision) return { kind: 'illustration', visual: event };
  const type = facts?.actionType;
  if (type === 'LINEN_STOCK_ORDER') {
    const rawId = facts?.stockItemId;
    const id = typeof rawId === 'number' ? rawId
      : typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : undefined;
    const stockItemId = id != null && Number.isSafeInteger(id) && id > 0 ? id : undefined;
    // Historical notifications carry the exact scanner title, not a product name field.
    const name = notification.title.match(/^Stock bas : (.+) \(\d+ restants?\)$/)?.[1] ?? '';
    if (stockItemId || name) return { kind: 'stock', stockItemId, name };
  }
  const visual = structuredActionIllustration(type, facts?.sourceTool, facts?.priceDirection) ?? event;
  if (visual) return { kind: 'illustration', visual };
  if (notification.notificationKey?.startsWith('SUPERVISION_')) {
    return { kind: 'illustration', visual: lookup(AGENT_ILLUSTRATIONS, facts?.module) ?? 'approval' };
  }
  return null;
}
