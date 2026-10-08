import type { AgentId, PendingAction } from '../types';
import { parseStockDescription } from './actionDescription';

/** Curated Baitly illustrations, served locally. Never resolve a URL from card text. */
export const ACTION_ILLUSTRATIONS = {
  'no-show': '/images/hitl/no-show.webp',
  'tourist-tax': '/images/hitl/tourist-tax.webp',
  'welcome-guide': '/images/hitl/welcome-guide.webp',
  'owner-transfer': '/images/hitl/owner-transfer.webp',
  'service-transfer': '/images/hitl/service-transfer.webp',
  'pricing': '/images/hitl/pricing.webp',
  'provider-search': '/images/hitl/provider-search.webp',
  'pricing-optimization': '/images/hitl/pricing-optimization.webp',
  'pricing-increase': '/images/hitl/pricing-increase.webp',
  'promotion-end': '/images/hitl/promotion-end.webp',
  'payment-reminder': '/images/hitl/payment-reminder.webp',
  'refund': '/images/hitl/refund.webp',
  'sync-problem': '/images/hitl/sync-problem.webp',
  'pricing-alert': '/images/hitl/pricing-alert.webp',
  'message-delivery': '/images/notifications/message-delivery.webp',
  'deposit': '/images/hitl/deposit.webp',
  'calendar': '/images/hitl/calendar.webp',
  'cleaning': '/images/hitl/cleaning.webp',
  'payment': '/images/hitl/payment.webp',
  'reviews': '/images/hitl/reviews.webp',
  'assignment': '/images/hitl/assignment.webp',
  'channel-sync': '/images/hitl/channel-sync.webp',
  'noise': '/images/hitl/noise.webp',
  'booking-recovery': '/images/hitl/booking-recovery.webp',
  'guest-experience': '/images/hitl/guest-experience.webp',
  'security': '/images/hitl/security.webp',
  'traveler-form': '/images/hitl/traveler-form.webp',
  'management-contract': '/images/hitl/management-contract.webp',
  'owner-report': '/images/hitl/owner-report.webp',
  'distribution': '/images/hitl/distribution.webp',
  'maintenance': '/images/hitl/maintenance.webp',
  'property-maintenance': '/images/hitl/property-maintenance.webp',
  'quotes': '/images/hitl/quotes.webp',
  'translation': '/images/hitl/translation.webp',
  'overbooking': '/images/hitl/overbooking.webp',
  'conversation': '/images/hitl/conversation.webp',
  'relocation': '/images/hitl/relocation.webp',
  'dispute': '/images/hitl/dispute.webp',
  'privacy': '/images/hitl/privacy.webp',
  'work-review': '/images/hitl/work-review.webp',
  'stock-order': '/images/hitl/stock-order.webp',
  'approval': '/images/hitl/approval.webp',
  'late-checkout': '/images/hitl/late-checkout.webp',
} as const;
export type ActionIllustrationKey = keyof typeof ACTION_ILLUSTRATIONS;

/** All server action types plus the frontend service-payment action. */
export const ACTION_TYPE_ILLUSTRATIONS: Readonly<Record<string, ActionIllustrationKey>> = {
  "PRICE_DROP": "pricing-optimization",
  "DEPOSIT_REFUND": "refund",
  "DEPOSIT_RELEASE": "deposit",
  "CALENDAR_BLOCK": "calendar",
  "NIGHTS_CAP_CLOSE": "calendar",
  "YIELD_PRICE_ADJUST": "pricing-optimization",
  "CLEANING_REQUEST": "cleaning",
  "PAYMENT_REMINDER": "payment-reminder",
  "REVIEW_DRAFT_REPLY": "reviews",
  "REASSIGN_CLEANING": "provider-search",
  "ICAL_RETRY": "sync-problem",
  "PARITY_REPUBLISH": "pricing-alert",
  "NOISE_WARNING_SEND": "noise",
  "CART_RECOVERY_SEND": "booking-recovery",
  "GUIDE_SEND": "welcome-guide",
  "REVIEW_REQUEST_SEND": "reviews",
  "CLEANING_PAYOUT": "service-transfer",
  "PROVIDER_PAYOUT_BENEFICIARY": "service-transfer",
  "FRAUD_BLOCK": "security",
  "POLICE_DECLARE": "traveler-form",
  "MANDATE_SIGN_SEND": "management-contract",
  "OWNER_STATEMENT_SEND": "owner-report",
  "MIN_STAY_RESTRICTION": "calendar",
  "PROMO_DEACTIVATE": "promotion-end",
  "UPSELL_OFFER": "guest-experience",
  "LOCK_BATTERY_REPLACE": "maintenance",
  "PREVENTIVE_MAINTENANCE": "property-maintenance",
  "DEPOSIT_WITHHOLD": "deposit",
  "GOODWILL_REFUND": "refund",
  "OWNER_PAYOUT": "owner-transfer",
  "OWNER_WORKS_APPROVAL": "quotes",
  "SITE_TRANSLATION_DRAFT": "translation",
  "OVERBOOKING_RESOLVE": "overbooking",
  "CONVERSATION_TAKEOVER": "conversation",
  "OWNER_REVENUE_NOTE": "owner-report",
  "TAX_MARK_FILED": "tourist-tax",
  "RELODGE_TRANSFER": "relocation",
  "NOSHOW_MARK": "no-show",
  "CHARGEBACK_SUBMIT": "dispute",
  "QUOTE_APPROVAL": "quotes",
  "LINEN_STOCK_ORDER": "stock-order",
  "LATE_CHECKOUT_APPROVAL": "late-checkout",
  "STAY_MODIFICATION": "calendar",
  "GDPR_ERASE": "privacy",
  "CHANNEL_PUBLISH": "distribution",
  "ASSIGNMENT_RECAP": "assignment",
  "REASSIGN_MANUAL": "provider-search",
  "WORK_REVIEW": "work-review",
  "SERVICE_REQUEST_SETTLE": "payment",
};

/** Informational scanners have no executable action type. Keep their stable identity. */
export const SOURCE_ILLUSTRATIONS: Readonly<Record<string, ActionIllustrationKey>> = {
  "guest_email_missing": "traveler-form",
  "guest_message_failed": "message-delivery",
  "guest_instructions_missing": "welcome-guide",
  "late_checkout_busy": "late-checkout",
  "stay_change_unclear": "calendar",
  "stay_change_unavailable": "calendar",
  "channel_not_distributed": "distribution",
  "listing_quality_low": "distribution",
  "mission_to_confirm": "assignment",
  "gdpr_unlinked": "privacy",
  "license_expiring": "management-contract",
  "registration_missing": "management-contract",
  "nights_cap_near": "calendar",
  "tourist_tax_undeclared": "tourist-tax",
  "police_owner_bears": "traveler-form",
  "payout_reminder": "owner-transfer",
};
export const AGENT_ILLUSTRATIONS: Readonly<Record<AgentId, ActionIllustrationKey>> = {
  "com": "conversation",
  "rev": "pricing",
  "ops": "cleaning",
  "fin": "payment",
  "rep": "reviews",
  "sync": "channel-sync",
  "cmp": "security",
  "gst": "guest-experience",
  "own": "owner-report",
  "gro": "distribution",
};

/** Same semantic choice for HITL cards, modals and notification history. */
export function structuredActionIllustration(type: unknown, source: unknown, priceDirection?: unknown): ActionIllustrationKey | undefined {
  if ((type === 'PRICE_DROP' || type === 'YIELD_PRICE_ADJUST') && priceDirection === 'up') return 'pricing-increase';
  if (typeof type === 'string' && Object.prototype.hasOwnProperty.call(ACTION_TYPE_ILLUSTRATIONS, type)) return ACTION_TYPE_ILLUSTRATIONS[type];
  if (typeof source === 'string' && Object.prototype.hasOwnProperty.call(SOURCE_ILLUSTRATIONS, source)) return SOURCE_ILLUSTRATIONS[source];
  return undefined;
}

function priceDirection(type?: string, actionParams?: string): unknown {
  if (!actionParams) return undefined;
  try {
    const params = JSON.parse(actionParams);
    if (type === 'YIELD_PRICE_ADJUST') {
      const percent = params?.percent;
      return typeof percent === 'number' && Number.isFinite(percent) && percent !== 0
        ? percent > 0 ? 'up' : 'down' : undefined;
    }
    return params?.direction;
  } catch { return undefined; }
}

export function actionIllustration(action?: PendingAction, agentId?: AgentId): ActionIllustrationKey | null {
  // The existing product photo stays in the stock facts, once per card or modal.
  if (action && parseStockDescription(action)) return null;
  if (action?.opensGuestCard) return 'traveler-form';
  if (action?.kind === 'payment') return 'payment';
  const visual = structuredActionIllustration(action?.applyActionType, action?.sourceTool,
    priceDirection(action?.applyActionType, action?.actionParams));
  if (visual) return visual;
  // Compatibility with older reminder snapshots that predate sourceTool.
  if (action?.kind === 'reminder' && action.id.startsWith('payout-reminder-')) return 'owner-transfer';
  const agent = action?.agentId ?? agentId;
  return agent && Object.prototype.hasOwnProperty.call(AGENT_ILLUSTRATIONS, agent) ? AGENT_ILLUSTRATIONS[agent] : 'approval';
}
