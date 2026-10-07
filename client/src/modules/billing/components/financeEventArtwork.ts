import { ACTION_ILLUSTRATIONS } from '../../supervision/core/actionIllustration';

/** Uses the same local assets as HITL cards; labels never become asset URLs. */
export function financeEventArtwork(label: string, kind?: string): string {
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/cleaning|menage|nettoyage/.test(normalized)) return ACTION_ILLUSTRATIONS.cleaning;
  if (/maintenance|reparation|plomberie|travaux|renovation|climatisation|electricite|serrurerie|peinture/.test(normalized)) return ACTION_ILLUSTRATIONS.maintenance;
  if (/rembours|refund/.test(normalized)) return ACTION_ILLUSTRATIONS.refund;
  if (/linge|laundry|blanchisserie/.test(normalized)) return ACTION_ILLUSTRATIONS['stock-order'];
  if (kind === 'OWNER_PAYOUT') return ACTION_ILLUSTRATIONS['owner-transfer'];
  if (kind === 'PROVIDER_PAYOUT') return ACTION_ILLUSTRATIONS['service-transfer'];
  if (kind === 'RESERVATION') return ACTION_ILLUSTRATIONS.calendar;
  return ACTION_ILLUSTRATIONS.payment;
}
