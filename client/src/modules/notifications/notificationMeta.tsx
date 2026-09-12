import React from 'react';
import {
  Build,
  Description,
  Payment,
  Info,
  Groups,
  Email,
  EventNote,
  Person,
  Schedule,
  Star,
  VolumeUp,
  Warning,
} from '../../icons';
import { SCREEN_ICON } from '../../config/navigationIcons';
import {
  NAVIGATION_HUBS,
  STANDALONE_SCREENS,
  tabMatchesPath,
} from '../../config/navigationHubs';
import { parseApiDate } from '../../utils/formatUtils';
import type { Notification } from '../../services/api';

/**
 * Reperes partages par la liste et la carte de detail des notifications :
 * la teinte de categorie, l'age relatif, et la destination d'une actionUrl.
 * La liste et le detail lisent la MEME source — un evenement ne peut pas
 * porter un carre vert a gauche et un libelle d'une autre nature a droite.
 */

/**
 * Icone + teinte par categorie, selon la grille de la projection
 * (BNotificationsSectionDemo) : un carre teinte par nature d'evenement —
 * l'argent en succes, l'operationnel en info, ce qui attend une reaction en
 * warning, la messagerie entrante en destructif, le systeme en neutre.
 */
export const CATEGORY_STYLE: Record<Notification['category'], { icon: React.ReactNode; accent: string }> = {
  reservation: { icon: <EventNote size={16} strokeWidth={1.75} />, accent: 'text-success bg-success-soft' },
  payment: { icon: <Payment size={16} strokeWidth={1.75} />, accent: 'text-success bg-success-soft' },
  intervention: { icon: <Build size={16} strokeWidth={1.75} />, accent: 'text-info bg-info-soft' },
  team: { icon: <Groups size={16} strokeWidth={1.75} />, accent: 'text-info bg-info-soft' },
  service_request: { icon: <Description size={16} strokeWidth={1.75} />, accent: 'text-warning bg-warning-soft' },
  document: { icon: <Description size={16} strokeWidth={1.75} />, accent: 'text-warning bg-warning-soft' },
  contact: { icon: <Email size={16} strokeWidth={1.75} />, accent: 'text-destructive bg-destructive-soft' },
  guest_messaging: { icon: <Email size={16} strokeWidth={1.75} />, accent: 'text-destructive bg-destructive-soft' },
  system: { icon: <Info size={16} strokeWidth={1.75} />, accent: 'text-muted-foreground bg-muted' },
};

/** Teinte d'une notification, avec repli neutre pour une categorie inconnue du front. */
export function categoryStyle(category: Notification['category']) {
  return CATEGORY_STYLE[category] ?? CATEGORY_STYLE.system;
}

/** Variante de badge pour le niveau (`type`) d'une notification. */
export const TYPE_BADGE_VARIANT: Record<Notification['type'], 'info' | 'success' | 'warning' | 'destructive'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
};

/** Locale Intl deduite de la langue de l'interface. */
export function localeOf(lang: string): string {
  return lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'fr-FR';
}

export function timeAgo(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang = 'fr',
): string {
  const now = Date.now();
  const date = parseApiDate(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('notifications.timeAgo.now');
  if (minutes < 60) return t('notifications.timeAgo.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.timeAgo.hours', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.timeAgo.days', { count: days });
  return parseApiDate(dateStr).toLocaleDateString(localeOf(lang));
}

/** Horodatage absolu et complet — ce que la liste ne peut pas montrer. */
export function fullTimestamp(dateStr: string, lang = 'fr'): string {
  return parseApiDate(dateStr).toLocaleString(localeOf(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Minuit local du jour d'une notification — la cle de regroupement. */
export function startOfDay(dateStr: string): number {
  const d = parseApiDate(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── Identifiants portes par une notification ────────────────────────────────

/**
 * Entier lu dans les FAITS de la notification.
 *
 * <p>C'est la source de verite : l'emetteur l'a depose la exactement pour
 * qu'on le lise.</p>
 */
export function factId(notification: Notification, key: string): number | null {
  const raw = notification.metadata?.[key];
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Entier repeche dans le LIEN PROFOND de la notification.
 *
 * <p>Les faits structures sont recents ; les notifications emises avant ne les
 * portent pas, et rien ne les fera renotifier. Leur `actionUrl`, elle, a
 * toujours designe l'objet — c'est un lien CHOISI par l'emetteur, pas de la
 * prose, et le seul moyen de ne pas laisser ces fiches muettes a vie.</p>
 *
 * <p>Deux formes coexistent selon l'ecran vise : un parametre `highlight`
 * (&laquo; ouvre cet onglet, surligne cette ligne &raquo;) ou un segment de
 * chemin (&laquo; ouvre cette fiche &raquo;). Le segment doit etre entierement
 * numerique : {@code /interventions/pending-payment} est une route, pas un
 * identifiant.</p>
 */
export function deepLinkId(
  notification: Notification,
  source: { param: string } | { pathPrefix: string },
): number | null {
  const url = notification.actionUrl;
  if (!url) return null;

  if ('param' in source) {
    const value = new URLSearchParams(url.split('?')[1] ?? '').get(source.param);
    return value && /^\d+$/.test(value) ? Number(value) : null;
  }

  const path = url.split('?')[0].split('#')[0];
  if (!path.startsWith(`${source.pathPrefix}/`)) return null;
  const segment = path.slice(source.pathPrefix.length + 1).split('/')[0];
  return /^\d+$/.test(segment) ? Number(segment) : null;
}

export interface NotificationDestination {
  /** Chemin complet (query comprise) passe a navigate(). */
  path: string;
  /** Libelle de l'ecran cible, quand la route est connue du registre de navigation. */
  translationKey?: string;
  fallbackLabel?: string;
  /**
   * Route CANONIQUE de l'ecran vise (cle de `SCREEN_ICON`) — permet d'afficher
   * l'ecran avec sa propre icone, celle du fil d'Ariane et de la barre
   * laterale, plutot qu'un glyphe generique.
   */
  screenPath?: string;
}

/**
 * Ecran vise par l'`actionUrl` d'une notification. Le libelle vient du registre
 * de navigation (`navigationHubs`) plutot que d'une table locale : l'ecran
 * s'appelle dans la carte exactement comme dans la barre laterale.
 */
export function resolveDestination(actionUrl?: string): NotificationDestination | null {
  if (!actionUrl) return null;
  const pathname = actionUrl.split('?')[0].split('#')[0];

  for (const hub of NAVIGATION_HUBS) {
    const tab = hub.tabs.find((candidate) => tabMatchesPath(candidate, pathname));
    if (tab) {
      return {
        path: actionUrl,
        translationKey: tab.translationKey,
        fallbackLabel: tab.fallbackLabel,
        screenPath: tab.path,
      };
    }
  }

  const screen = STANDALONE_SCREENS.find(
    (candidate) => pathname === candidate.path || pathname.startsWith(`${candidate.path}/`),
  );
  if (screen) {
    return {
      path: actionUrl,
      translationKey: screen.translationKey,
      fallbackLabel: screen.fallbackLabel,
      screenPath: screen.path,
    };
  }

  // Route hors registre (fiche detail, ecran non liste) : la destination existe,
  // seul son nom manque — le bouton retombe sur un libelle generique.
  return { path: actionUrl };
}

// ─── Faits structures joints a l'evenement ───────────────────────────────────

/**
 * Vocabulaire des faits qu'une notification peut porter, dans l'ordre de
 * lecture. Il MIROITE `NotificationMetadata` cote serveur : une cle absente de
 * cette table n'est pas affichee — l'ecran ne devine pas ce qu'il ne sait pas
 * nommer ni mettre en forme. Ajouter un fait, c'est une entree ici et un
 * libelle `notifications.detail.metadata.<cle>` dans les trois locales.
 */
const METADATA_FIELDS: { key: string; kind: 'text' | 'date' | 'money' | 'rating' | 'decibels' }[] = [
  { key: 'property', kind: 'text' },
  { key: 'guest', kind: 'text' },
  { key: 'rating', kind: 'rating' },
  { key: 'reservationReference', kind: 'text' },
  { key: 'checkIn', kind: 'date' },
  { key: 'checkOut', kind: 'date' },
  { key: 'amount', kind: 'money' },
  { key: 'channel', kind: 'text' },
  { key: 'noiseDb', kind: 'decibels' },
  { key: 'noiseThresholdDb', kind: 'decibels' },
  { key: 'request', kind: 'text' },
  { key: 'intervention', kind: 'text' },
  { key: 'assignee', kind: 'text' },
  { key: 'dueDate', kind: 'date' },
  { key: 'document', kind: 'text' },
  { key: 'template', kind: 'text' },
  { key: 'error', kind: 'text' },
];

export type NotificationFact =
  | { key: string; kind: 'text'; value: string }
  | { key: string; kind: 'date'; value: string }
  | { key: string; kind: 'stay'; from: string; to: string }
  | { key: string; kind: 'rating'; value: number }
  | { key: string; kind: 'decibels'; value: number }
  | { key: string; kind: 'money'; value: number; currency?: string };

function asText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Traduit les metadonnees brutes en faits affichables. Tout ce qui n'a pas la
 * forme attendue est ignore en silence : une notification reste lisible meme
 * si l'emetteur s'est trompe de type, et rien d'arbitraire n'atteint l'ecran.
 *
 * En revanche, une cle que le SERVEUR emet et qui manque ici disparait tout
 * aussi silencieusement — c'est arrive a `assignee`, `dueDate`, `request`,
 * `document` et `rating`, declares dans `NotificationMetadata`, pourvus d'une
 * icone, envoyes par les services, et jamais affiches. Ajouter un fait cote
 * serveur, c'est donc TOUJOURS trois gestes, jamais deux.
 *
 * Les deux bornes du sejour se disent en UN fait — « du 12 au 15 septembre »
 * plutot que deux lignes qu'il faut recoller soi-meme.
 */
/**
 * Auteur d'un geste humain, tel que la notification l'a enregistre.
 *
 * <p>Pris dans les FAITS et jamais relu : qui a fait CE geste-la ne change pas,
 * alors que l'objet sur lequel il portait a pu etre retouche depuis par
 * quelqu'un d'autre. C'est l'inverse exact d'un code d'acces, qui lui doit etre
 * relu a chaque ouverture de fiche.</p>
 *
 * <p>`null` pour un geste automatique : les acteurs techniques n'ont pas de nom,
 * et c'est ainsi qu'on les reconnait.</p>
 */
export function notificationActorOf(notification: Notification): string | null {
  const raw = notification.metadata?.actor;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export function resolveMetadataFacts(metadata: Record<string, unknown> | null | undefined): NotificationFact[] {
  if (!metadata || typeof metadata !== 'object') return [];

  const checkIn = asText(metadata.checkIn);
  const checkOut = asText(metadata.checkOut);
  const pairedStay = checkIn && checkOut;
  const currency = asText(metadata.currency) ?? undefined;

  const facts: NotificationFact[] = [];
  for (const field of METADATA_FIELDS) {
    if (pairedStay && field.key === 'checkIn') {
      facts.push({ key: 'stay', kind: 'stay', from: checkIn, to: checkOut });
      continue;
    }
    if (pairedStay && field.key === 'checkOut') continue;

    const raw = metadata[field.key];
    if (raw == null) continue;

    if (field.kind === 'money') {
      const value = asNumber(raw);
      if (value !== null) facts.push({ key: field.key, kind: 'money', value, currency });
      continue;
    }
    if (field.kind === 'rating') {
      const value = asNumber(raw);
      if (value !== null) facts.push({ key: field.key, kind: 'rating', value });
      continue;
    }
    if (field.kind === 'decibels') {
      const value = asNumber(raw);
      if (value !== null) facts.push({ key: field.key, kind: 'decibels', value });
      continue;
    }
    const text = asText(raw);
    if (text) facts.push({ key: field.key, kind: field.kind, value: text });
  }
  return facts;
}

/** Date ISO (yyyy-MM-dd) rendue dans la langue de l'interface. */
export function formatFactDate(iso: string, lang = 'fr'): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Icone de chaque fait, empruntee au vocabulaire DEJA en place dans le PMS.
 *
 * Quand le fait designe un objet qui a son propre ecran — un logement, une
 * reservation, une intervention, un montant, un canal — l'icone vient de
 * `SCREEN_ICON`, la source unique du fil d'Ariane, de la barre laterale et des
 * pastilles de titre. Un logement se reconnait donc ici au meme glyphe qu'a
 * chaque autre endroit de l'application, au lieu d'en inventer un de plus.
 *
 * Les faits sans ecran propre (voyageur, echeance, note, motif d'echec)
 * reprennent l'icone que leur ecran d'origine leur donne deja.
 */
export const FACT_ICON: Record<string, React.ReactNode> = {
  property: SCREEN_ICON['/properties'],
  guest: <Person />,
  reservationReference: SCREEN_ICON['/reservations'],
  stay: SCREEN_ICON['/reservations'],
  checkIn: SCREEN_ICON['/reservations'],
  checkOut: SCREEN_ICON['/reservations'],
  amount: SCREEN_ICON['/billing'],
  channel: SCREEN_ICON['/channels'],
  template: SCREEN_ICON['/contact'],
  intervention: SCREEN_ICON['/interventions'],
  request: SCREEN_ICON['/interventions'],
  document: SCREEN_ICON['/documents'],
  assignee: <Groups />,
  dueDate: <Schedule />,
  rating: <Star />,
  noiseDb: <VolumeUp />,
  noiseThresholdDb: <VolumeUp />,
  error: <Warning />,
};
