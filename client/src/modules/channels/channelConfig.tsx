import React from 'react';
import {
  Hub as AirbnbIcon,
  Hotel as BookingIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  Forum as ForumIcon,
} from '../../icons';
import type { ConversationDto } from '../../services/api/conversationApi';
import { formatPhoneNumber } from '../../utils/formatPhone';

/**
 * Configuration visuelle partagée des canaux de l'inbox unifiée (Contact >
 * Messagerie OTA). Centralisé ici pour être réutilisé par la liste
 * (ChannelInboxTab), le détail (ConversationDetailPanel) et le drawer
 * (ConversationQuickDrawer).
 */
export const CHANNEL_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  AIRBNB: { label: 'Airbnb', color: '#FF5A5F', icon: <AirbnbIcon size={'1.375rem'} strokeWidth={2} /> },
  BOOKING: { label: 'Booking.com', color: '#003580', icon: <BookingIcon size={'1.375rem'} strokeWidth={2} /> },
  WHATSAPP: { label: 'WhatsApp', color: '#25D366', icon: <WhatsAppIcon size={'1.375rem'} strokeWidth={2} /> },
  EMAIL: { label: 'Email', color: '#757575', icon: <EmailIcon size={'1.375rem'} strokeWidth={2} /> },
};

/** Canaux affichés dans l'inbox unifiée : OTA (Airbnb/Booking) + WhatsApp (compte global). */
export const OTA_CHANNELS = ['AIRBNB', 'BOOKING', 'WHATSAPP'];

/** Couleur générique du groupe « OTA » (bleu-gris accent Clenzy) pour le filtre. */
export const OTA_GROUP_COLOR = '#7BA3C2';

/**
 * Largeur unifiée de la colonne de gauche (liste) des onglets Contact —
 * Messagerie interne, Formulaires reçus, Messagerie OTA. Garantit des colonnes
 * identiques d'un onglet à l'autre. Mobile (<md) = pleine largeur (master-detail).
 */
export const CONTACT_LIST_WIDTH = { xs: '100%', md: 340, xl: 360 };

/** Filtre canal de la colonne de gauche. '' = tous. */
export type ChannelFilter = '' | 'WHATSAPP' | 'OTA';

export function getChannelConfig(channel: string) {
  return CHANNEL_CONFIG[channel] ?? {
    label: channel,
    color: '#9e9e9e',
    icon: <ForumIcon size={'1.375rem'} strokeWidth={2} />,
  };
}

/** Vrai si le canal appartient au groupe OTA (Airbnb / Booking). */
export function isOtaChannel(channel: string): boolean {
  return channel === 'AIRBNB' || channel === 'BOOKING';
}

/** Plage de séjour compacte : "12–15 juin" (même mois) ou "30 juin – 2 juil.". */
function formatStayRange(checkIn?: string | null, checkOut?: string | null): string {
  if (!checkIn) return '';
  const ci = new Date(checkIn);
  const co = checkOut ? new Date(checkOut) : null;
  const dayMonth = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  if (!co) return dayMonth(ci);
  const sameMonth = ci.getMonth() === co.getMonth() && ci.getFullYear() === co.getFullYear();
  return sameMonth ? `${ci.getDate()}–${dayMonth(co)}` : `${dayMonth(ci)} – ${dayMonth(co)}`;
}

/**
 * Titre d'affichage d'une conversation OTA/WhatsApp :
 * <ul>
 *   <li>rattachée à une réservation → « Logement · 12–15 juin · Guest »</li>
 *   <li>guest connu sans réservation → nom du guest</li>
 *   <li>numéro inconnu (« à trier ») → « À trier — +33 6 12 34 56 78 »</li>
 * </ul>
 */
export function conversationTitle(conv: ConversationDto): string {
  if (conv.propertyName && conv.checkIn && conv.guestName) {
    return `${conv.propertyName} · ${formatStayRange(conv.checkIn, conv.checkOut)} · ${conv.guestName}`;
  }
  if (conv.guestName) return conv.guestName;
  if (conv.channel === 'WHATSAPP' && conv.externalConversationId) {
    const phone = formatPhoneNumber(conv.externalConversationId);
    if ((conv.subject ?? '').toLowerCase().startsWith('à trier')) return `À trier — ${phone}`;
    return phone || conv.subject || 'WhatsApp';
  }
  return conv.subject || 'Conversation';
}
