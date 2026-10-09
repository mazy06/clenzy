import type { ConversationDto } from '../../../services/api/conversationApi';
import type { ThreadMessage } from './unified';

/**
 * Modèle de présentation de la messagerie : des fonctions PURES, sans React ni
 * i18n, pour que le regroupement de la boîte, du fil et l'état du séjour se
 * testent sans rendre un composant.
 */

// ─── Boîte : regroupement par ancienneté ────────────────────────────────────

export type InboxBucket = 'today' | 'yesterday' | 'week' | 'older';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Classe une date dans « aujourd'hui », « hier », « cette semaine » ou « plus ancien ». */
export function inboxBucket(iso: string | null, now: Date = new Date()): InboxBucket {
  if (!iso) return 'older';
  const diffDays = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'week';
  return 'older';
}

const BUCKET_ORDER: InboxBucket[] = ['today', 'yesterday', 'week', 'older'];

/**
 * Regroupe une liste DÉJÀ triée par activité décroissante. L'ordre des
 * éléments est conservé, seules les têtes de groupe sont ajoutées ; un groupe
 * vide n'existe pas.
 */
export function groupByBucket<T extends { lastAt: string | null }>(
  items: T[],
  now: Date = new Date(),
): Array<{ bucket: InboxBucket; items: T[] }> {
  const groups = new Map<InboxBucket, T[]>();
  for (const item of items) {
    const bucket = inboxBucket(item.lastAt, now);
    const list = groups.get(bucket);
    if (list) list.push(item);
    else groups.set(bucket, [item]);
  }
  return BUCKET_ORDER.flatMap((bucket) => (groups.has(bucket) ? [{ bucket, items: groups.get(bucket)! }] : []));
}

// ─── Fil : jours et séries d'un même auteur ─────────────────────────────────

export interface MessageRun {
  message: ThreadMessage;
  /** Premier message de la série : porte l'avatar et le nom. */
  first: boolean;
  /** Dernier message de la série : porte l'heure et l'état de livraison. */
  last: boolean;
}

export interface MessageDay {
  /** Clé stable du jour (AAAA-MM-JJ, jour local). */
  key: string;
  /** Première date du jour, pour le libellé du séparateur. */
  at: string;
  runs: MessageRun[];
}

/** Au-delà de cet écart, deux messages du même auteur ne forment plus une série. */
const RUN_GAP_MS = 5 * 60 * 1000;

function dayKey(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function sameRun(a: ThreadMessage, b: ThreadMessage): boolean {
  return (
    a.out === b.out
    && (a.sender ?? '') === (b.sender ?? '')
    && Boolean(a.internalNote) === Boolean(b.internalNote)
    && Math.abs(new Date(b.at).getTime() - new Date(a.at).getTime()) <= RUN_GAP_MS
  );
}

/**
 * Trie chronologiquement, découpe par jour, puis marque les séries : l'avatar,
 * le nom et l'heure ne se répètent pas à chaque bulle d'un même auteur.
 */
export function groupMessages(messages: ThreadMessage[]): MessageDay[] {
  const sorted = [...messages].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const days: MessageDay[] = [];
  for (const message of sorted) {
    const key = dayKey(message.at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, at: message.at, runs: [] };
      days.push(day);
    }
    const previous = day.runs[day.runs.length - 1];
    const continues = previous ? sameRun(previous.message, message) : false;
    if (previous && continues) previous.last = false;
    day.runs.push({ message, first: !continues, last: true });
  }
  return days;
}

// ─── Livraison ──────────────────────────────────────────────────────────────

export type DeliveryState = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Le serveur renvoie une chaîne libre : on ne reconnaît que ce qu'on sait
 * dire. Un statut inconnu n'affiche RIEN plutôt qu'un état inventé.
 */
export function deliveryState(status: string | null | undefined): DeliveryState | null {
  switch ((status ?? '').toUpperCase()) {
    case 'SENT':
      return 'sent';
    case 'DELIVERED':
      return 'delivered';
    case 'READ':
      return 'read';
    case 'FAILED':
    case 'ERROR':
    case 'UNDELIVERED':
      return 'failed';
    default:
      return null;
  }
}

// ─── Séjour ─────────────────────────────────────────────────────────────────

export interface StayInfo {
  key: 'past' | 'current' | 'upcoming';
  arrival: Date;
  departure: Date | null;
  /** Nombre de nuits, si les deux dates sont connues. */
  nights: number | null;
  /** Date mise en avant : l'arrivée à venir, le départ en cours, le départ passé. */
  highlight: Date;
}

/**
 * Où en est le séjour AUJOURD'HUI, à partir des seules dates portées par la
 * conversation. Elle ne connaît pas l'état administratif de la réservation
 * (confirmée, annulée) : on ne l'invente donc pas.
 */
export function stayInfo(
  conv: Pick<ConversationDto, 'reservationId' | 'checkIn' | 'checkOut'>,
  now: Date = new Date(),
): StayInfo | null {
  if (!conv.reservationId || !conv.checkIn) return null;
  const today = startOfDay(now);
  const arrival = new Date(conv.checkIn);
  arrival.setHours(0, 0, 0, 0);
  const departure = conv.checkOut ? new Date(conv.checkOut) : null;
  if (departure) departure.setHours(0, 0, 0, 0);
  const nights = departure ? Math.max(0, Math.round((departure.getTime() - arrival.getTime()) / DAY_MS)) : null;

  if (departure && today > departure.getTime()) {
    return { key: 'past', arrival, departure, nights, highlight: departure };
  }
  if (today >= arrival.getTime()) {
    return { key: 'current', arrival, departure, nights, highlight: departure ?? arrival };
  }
  return { key: 'upcoming', arrival, departure, nights, highlight: arrival };
}

// ─── Sentiment ──────────────────────────────────────────────────────────────

export type SentimentTone = 'positive' | 'negative' | 'neutral';

export function sentimentTone(sentiment: string | null | undefined): SentimentTone {
  switch ((sentiment ?? '').toUpperCase()) {
    case 'POSITIVE':
      return 'positive';
    case 'NEGATIVE':
      return 'negative';
    default:
      return 'neutral';
  }
}

/**
 * Position d'un score de sentiment sur une jauge 0–100 (0 = très mécontent,
 * 50 = neutre, 100 = très satisfait). Le score serveur est borné à [-1, 1].
 */
export function sentimentPosition(score: number): number {
  const clamped = Math.max(-1, Math.min(1, Number.isFinite(score) ? score : 0));
  return Math.round(((clamped + 1) / 2) * 100);
}
