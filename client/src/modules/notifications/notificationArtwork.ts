import { ACTION_ILLUSTRATIONS } from '../supervision/core/actionIllustration';

/** Local Baitly artwork. Keep HITL imagery identical across both surfaces. */
export const NOTIFICATION_ILLUSTRATIONS = {
  ...ACTION_ILLUSTRATIONS,
  'message-sent': '/images/notifications/message-sent.webp',
  'message-received': '/images/notifications/message-received.webp',
  'access-code': '/images/notifications/access-code.webp',
  'access-problem': '/images/notifications/access-problem.webp',
  'door-access': '/images/notifications/door-access.webp',
  'team-assigned': '/images/notifications/team-assigned.webp',
  'team-directory': '/images/notifications/team-directory.webp',
  'user-profile': '/images/notifications/user-profile.webp',
  'service-request': '/images/notifications/service-request.webp',
  'document': '/images/notifications/document.webp',
  'property': '/images/notifications/property.webp',
  'reservation': '/images/notifications/reservation.webp',
  'system-health': '/images/notifications/system-health.webp',
  'automation': '/images/notifications/automation.webp',
  'smoke-alert': '/images/notifications/smoke-alert.webp',
  'payment-confirmed': '/images/notifications/payment-confirmed.webp',
  'payment-failed': '/images/notifications/payment-failed.webp',
  'reservation-cancelled': '/images/notifications/reservation-cancelled.webp',
  'request-urgent': '/images/notifications/request-urgent.webp',
  'request-rejected': '/images/notifications/request-rejected.webp',
  'request-cancelled': '/images/notifications/request-cancelled.webp',
  'document-error': '/images/notifications/document-error.webp',
  'system-incident': '/images/notifications/system-incident.webp',
  'system-restored': '/images/notifications/system-restored.webp',
  'noise-resolved': '/images/notifications/noise-resolved.webp',
  'review-negative': '/images/notifications/review-negative.webp',
  'booking-unmapped': '/images/notifications/booking-unmapped.webp',
  'intervention-overdue': '/images/notifications/intervention-overdue.webp',
  'payout-blocked': '/images/notifications/payout-blocked.webp',
  'intervention-completed': '/images/notifications/intervention-completed.webp',
} as const;

export type NotificationIllustrationKey = keyof typeof NOTIFICATION_ILLUSTRATIONS;
