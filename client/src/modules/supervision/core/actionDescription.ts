import type { PendingAction } from '../types';

/** Read-only presentation adapters. Never feed these values back into an action. */
export function readActionParams(raw?: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

export function isoDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export interface ReviewMotif { rating: number; meta: string; quote: string; rest: string }
export function parseReviewMotif(motif?: string): ReviewMotif | null {
  const match = motif?.match(/^Avis\s+([1-5])\/5\s+de\s+(.+?)\s+le\s+(.+?)\s*(?:\(([^)]+)\))?,\s*sans réponse hôte\.\s*«\s*([\s\S]+?)\s*»\s*([\s\S]*)$/);
  if (!match) return null;
  const [, rating, author, date, source, quote, rest] = match;
  const sourceLabel = source?.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return { rating: Number(rating), meta: [author, date, sourceLabel].filter(Boolean).join(' · '), quote, rest: rest.trim() };
}

export function parseReviewId(raw?: string): number | null {
  const { reviewId } = readActionParams(raw);
  return typeof reviewId === 'number' && Number.isSafeInteger(reviewId) && reviewId > 0 ? reviewId : null;
}

/** Older scanner cards carry display facts only in their stable French copy.
 * Match the complete shape before replacing any prose; unknown copy stays intact. */
export function parseStockDescription(action: PendingAction) {
  if (action.agentId !== 'ops') return null;
  const title = action.title.match(/^Stock bas : (.+) \((\d+) restant\)$/);
  const order = action.motif.match(/^Seuil de (\d+) atteint\. « Commander » envoie le bon de commande \((\d+)(?: ([^)]+))?\) à (.+?) [—–] ([\s\S]+)$/);
  const missing = action.motif.match(/^Seuil de (\d+) atteint et aucun fournisseur configuré [—–] ([\s\S]+)$/);
  if (!title || (!order && !missing)) return null;
  const remaining = Number(title[2]);
  const threshold = Number((order ?? missing)![1]);
  if (!Number.isSafeInteger(remaining) || !Number.isSafeInteger(threshold) || threshold <= 0 || remaining > threshold) return null;
  if (order && (!Number.isSafeInteger(Number(order[2])) || Number(order[2]) <= 0)) return null;
  return {
    name: title[1], remaining, threshold, quantity: order ? Number(order[2]) : null,
    unit: order?.[3] ?? '', supplier: order?.[4] ?? null,
    note: (order?.[5] ?? missing![2]).trim(),
  };
}

export function descriptionTitle(action: PendingAction): string {
  return parseStockDescription(action)?.name ?? action.title;
}

export function parseQuoteDescription(action: PendingAction) {
  if (action.applyActionType !== 'QUOTE_APPROVAL') return null;
  const match = action.motif.match(/^« (.+) » : (\d+) devis reçu\(s\) [—–] ([\s\S]+?)\. (« Approuver »[\s\S]+)$/);
  if (!match) return null;
  const rows = match[3].split(' · ').map((row) => {
    const parts = row.match(/^(.+?) [—–] (\d+(?:[.,]\d+)?) ([A-Z]{3})(?: \(dispo (\d{4}-\d{2}-\d{2})\))?$/);
    if (!parts || (parts[4] && !isoDay(parts[4]))) return null;
    const amount = Number(parts[2].replace(',', '.'));
    if (!Number.isFinite(amount)) return null;
    return { provider: parts[1], amount, currency: parts[3], date: parts[4] };
  });
  if (rows.length !== Number(match[2]) || rows.some((row) => !row)) return null;
  // No frontend ranking: the source's order is preserved, including mixed currencies.
  return { title: match[1], rows: rows.filter((row) => row !== null), note: match[4] };
}

export function parseNoShowDescription(action: PendingAction) {
  if (action.applyActionType !== 'NOSHOW_MARK') return null;
  const match = action.motif.match(/^Arrivée prévue le (\d{4}-\d{2}-\d{2}), aucun signe de vie depuis : pas de fiche voyageur déposée, aucun message reçu\. ([\s\S]+)$/);
  return match && isoDay(match[1]) ? { date: match[1], note: match[2] } : null;
}

export function parseOwnerRevenueDescription(action: PendingAction) {
  if (action.applyActionType !== 'OWNER_REVENUE_NOTE') return null;
  const match = action.motif.match(/^Revenus de (\d{4}-(?:0[1-9]|1[0-2])) : (\d+(?:[.,]\d+)?) € contre (\d+(?:[.,]\d+)?) € le même mois l'an dernier\. ([\s\S]+)$/);
  if (!match) return null;
  const current = Number(match[2].replace(',', '.')), previous = Number(match[3].replace(',', '.'));
  if (![current, previous].every(Number.isFinite) || previous <= 0) return null;
  return { month: match[1], current, previous, note: match[4] };
}

export function parsePrivacyDescription(action: PendingAction) {
  if (action.applyActionType !== 'GDPR_ERASE') return null;
  const match = action.motif.match(/^Demande de (\S+@\S+) reçue le (\d{4}-\d{2}-\d{2}(?:T[\d:.]+)?) [—–] échéance légale le (\d{4}-\d{2}-\d{2}) \((?:J-\d+|DÉPASSÉE)\)\. ([\s\S]+)$/);
  if (!match || !isoDay(match[2].slice(0, 10)) || !isoDay(match[3])) return null;
  // Keep the actual deadline, not a stale countdown saved when the scanner ran.
  return { email: match[1], received: match[2], due: match[3], note: match[4] };
}

export type FactKind = 'text' | 'date' | 'number' | 'percent' | 'nights' | 'days' | 'language';
export interface DescriptionFact { label: string; value: string | number; kind: FactKind }

/** Only user-facing, known parameters are exposed. Never dump raw action JSON,
 * technical ids, tokens, or default values that were not actually proposed. */
export function actionFacts(action: PendingAction): DescriptionFact[] {
  const params = readActionParams(action.actionParams);
  const facts: DescriptionFact[] = [];
  const add = (name: string, label: string, kind: FactKind = 'text') => {
    const value = params[name];
    if (kind === 'date') {
      if (isoDay(value)) facts.push({ label, value: value as string, kind });
    } else if (['number', 'percent', 'nights', 'days'].includes(kind)) {
      if (typeof value === 'number' && Number.isFinite(value) && (kind === 'percent' || value >= 0)) facts.push({ label, value, kind });
    } else if (typeof value === 'string' && value.trim()) facts.push({ label, value, kind });
  };
  const period = (exclusive: boolean) => {
    const start = isoDay(params.from), end = isoDay(params.to);
    if (!start || !end || end < start || (exclusive && +end === +start)) return;
    facts.push({ label: 'from', value: params.from as string, kind: 'date' });
    facts.push({ label: 'to', value: exclusive ? new Date(+end - 86_400_000).toISOString().slice(0, 10) : params.to as string, kind: 'date' });
  };
  switch (action.applyActionType) {
    case 'YIELD_PRICE_ADJUST': period(true); add('percent', 'adjustment', 'percent'); break;
    case 'MIN_STAY_RESTRICTION':
      period(true); add('minNights', 'minimumStay', 'nights');
      if (typeof params.weekendsOnly === 'boolean') facts.push({ label: 'scope', value: params.weekendsOnly ? 'weekends' : 'allNights', kind: 'text' });
      break;
    case 'STAY_MODIFICATION': add('newCheckIn', 'arrival', 'date'); add('newCheckOut', 'departure', 'date'); break;
    case 'CLEANING_REQUEST': add('checkOut', 'departure', 'date'); break;
    case 'CALENDAR_BLOCK': add('days', 'blockDuration', 'days'); break;
    case 'PARITY_REPUBLISH': add('days', 'syncWindow', 'days'); break;
    case 'GOODWILL_REFUND': add('percent', 'refund', 'percent'); break;
    case 'LATE_CHECKOUT_APPROVAL':
      if (typeof params.requestedTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(params.requestedTime)) add('requestedTime', 'requestedTime');
      break;
    case 'OWNER_STATEMENT_SEND': period(false); break;
    case 'OWNER_REVENUE_NOTE':
      if (typeof params.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month)) add('month', 'period');
      break;
    case 'SITE_TRANSLATION_DRAFT':
      if (typeof params.targetLocale === 'string' && /^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(params.targetLocale)) add('targetLocale', 'language', 'language');
      break;
    case 'ASSIGNMENT_RECAP': add('assigneeLabel', 'assignee'); break;
    case 'LINEN_STOCK_ORDER': add('quantity', 'orderQuantity', 'number'); break;
    case 'TAX_MARK_FILED': add('depositedOn', 'filingDate', 'date'); add('reference', 'reference'); break;
    case 'OVERBOOKING_RESOLVE':
      for (const [name, label] of [['keepReservationId', 'suggestedKeep'], ['cancelReservationId', 'suggestedCancel']]) {
        if (typeof params[name] === 'number' && Number.isSafeInteger(params[name]) && Number(params[name]) > 0) facts.push({ label, value: `#${params[name]}`, kind: 'text' });
      }
      break;
  }
  return facts;
}

/** Preserve every character and sentence, including unknown future card types.
 * Splitting is conservative: a quoted CTA, explicit newline or a sentence boundary.
 * Decimal values, email addresses and abbreviations are not split on every dot. */
export function descriptionParts(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/\n\s*\n|(?<=[.!?؟])\s+(?=[«A-ZÀÂÉÈÊÎÔÙÛÇ\u0600-\u06ff])/gu)) {
    const at = match.index!;
    // A message or review can contain several sentences. Keep the quotation
    // whole so the renderer can distinguish it from the agent's explanation.
    if (text.lastIndexOf('«', at) > text.lastIndexOf('»', at)) continue;
    parts.push(text.slice(start, at));
    start = at + match[0].length;
  }
  parts.push(text.slice(start));
  return parts.filter((part) => part.trim());
}

export function descriptionHighlights(text: string): Array<{ text: string; important: boolean }> {
  const pattern = /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|[+−-]?\d+(?:[.,\u00a0\u202f]\d+)*(?:\s*(?:%|€|EUR|MAD|USD|GBP|SAR|nuits?\b|jours?\b|mois\b|h\b|min\b|night[s]?\b|days?\b))|#\d+|\b\d{1,2}:\d{2}\b)/gu;
  const parts: Array<{ text: string; important: boolean }> = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > end) parts.push({ text: text.slice(end, match.index), important: false });
    parts.push({ text: match[0], important: true });
    end = match.index! + match[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end), important: false });
  return parts;
}
