/* ============================================================
   Mapping toolName (type d'événement) → icône sémantique

   Dans le feed « En direct », la COULEUR du carré encode l'agent
   (AGENT_META[agentId].color) ; l'ICÔNE encode la NATURE de l'action
   (ce fichier). Sans ça, tous les events d'un même agent partagent la
   même icône (ex. l'agent Opérations → balai partout, même pour un
   échec de sync calendrier). Repli sur l'icône d'agent si le toolName
   est inconnu ou absent (entrées mock/résumé sans outil).

   Noms importés = alias ré-exportés par le barrel ../../../icons
   (pas d'import direct lucide/iconify).
   ============================================================ */

import type { ReactNode } from 'react';
import {
  BroomFill,
  Build, // Wrench
  Calendar,
  Chat,
  CreditCard,
  Description, // FileText
  Home,
  LocalOffer, // Tag
  Payments,
  Psychology, // Brain
  Receipt,
  Send,
  Shield,
  Star,
  Sync, // RotateCw
  Timeline, // Activity
  TrendingUp,
  VerifiedUser, // ShieldCheck
  VolumeUp, // Volume2
  VpnKey, // Key
  Warning, // TriangleAlert
} from '../../../icons';

type IconRender = (size: number) => ReactNode;

// Icône par type d'action métier, regroupée par domaine.
const TOOL_ICON: Record<string, IconRender> = {
  // Calendrier / réservations / canaux
  ical_sync_failed: (s) => <Warning size={s} strokeWidth={1.9} />,
  double_booking_prevented: (s) => <VerifiedUser size={s} strokeWidth={1.9} />,
  trigger_channel_sync: (s) => <Sync size={s} strokeWidth={1.9} />,
  open_close_channel_availability: (s) => <Sync size={s} strokeWidth={1.9} />,
  batch_block_calendar: (s) => <Calendar size={s} strokeWidth={1.9} />,
  block_calendar_day: (s) => <Calendar size={s} strokeWidth={1.9} />,
  create_reservation: (s) => <Calendar size={s} strokeWidth={1.9} />,
  cancel_reservation: (s) => <Calendar size={s} strokeWidth={1.9} />,
  update_reservation_status: (s) => <Calendar size={s} strokeWidth={1.9} />,
  rate_parity_issue: (s) => <Warning size={s} strokeWidth={1.9} />,

  // Ménage / interventions / logement
  cleaning_scheduled: (s) => <BroomFill size={s} />,
  create_intervention: (s) => <Build size={s} strokeWidth={1.9} />,
  assign_intervention: (s) => <Build size={s} strokeWidth={1.9} />,
  intervention_assigned: (s) => <Build size={s} strokeWidth={1.9} />,
  update_intervention_status: (s) => <Build size={s} strokeWidth={1.9} />,
  update_property_status: (s) => <Home size={s} strokeWidth={1.9} />,
  access_code_rotated: (s) => <VpnKey size={s} strokeWidth={1.9} />,

  // Capteurs / IoT
  sensor_anomaly: (s) => <Timeline size={s} strokeWidth={1.9} />,
  noise_alert: (s) => <VolumeUp size={s} strokeWidth={1.9} />,

  // Tarification
  pricing_pushed: (s) => <TrendingUp size={s} strokeWidth={1.9} />,
  elasticity_recomputed: (s) => <Timeline size={s} strokeWidth={1.9} />,
  set_rate_override: (s) => <LocalOffer size={s} strokeWidth={1.9} />,

  // Finance
  payment_failed: (s) => <CreditCard size={s} strokeWidth={1.9} />,
  booking_caution: (s) => <Shield size={s} strokeWidth={1.9} />,
  create_invoice: (s) => <Receipt size={s} strokeWidth={1.9} />,
  initiate_refund: (s) => <Payments size={s} strokeWidth={1.9} />,
  settle_intervention_payment: (s) => <Payments size={s} strokeWidth={1.9} />,
  send_owner_statement: (s) => <Description size={s} strokeWidth={1.9} />,

  // Communication
  send_guest_message: (s) => <Chat size={s} strokeWidth={1.9} />,
  cart_reminder_sent: (s) => <Send size={s} strokeWidth={1.9} />,
  // Automatisations messaging en échec (envoi non abouti — feed marqué en erreur)
  SEND_MESSAGE_FAILED: (s) => <Warning size={s} strokeWidth={1.9} />,
  SEND_GUIDE_FAILED: (s) => <Warning size={s} strokeWidth={1.9} />,
  SEND_CHECKIN_LINK_FAILED: (s) => <Warning size={s} strokeWidth={1.9} />,
  SEND_NOISE_WARNING_FAILED: (s) => <Warning size={s} strokeWidth={1.9} />,
  SEND_REVIEW_REQUEST_FAILED: (s) => <Warning size={s} strokeWidth={1.9} />,

  // Réputation
  reply_to_review: (s) => <Star size={s} strokeWidth={1.9} />,

  // Mémoire agent
  forget_fact: (s) => <Psychology size={s} strokeWidth={1.9} />,
};

/**
 * Icône du type d'événement (par `toolName`). Retourne `null` si le toolName est
 * absent ou inconnu — l'appelant retombe alors sur l'icône d'agent.
 */
export function toolIconFor(toolName: string | undefined | null, size = 14): ReactNode | null {
  if (!toolName) return null;
  const render = TOOL_ICON[toolName];
  return render ? render(size) : null;
}
