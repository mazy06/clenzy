import { useMemo, useRef } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { managersApi } from '../../../services/api/portfoliosApi';
import { isCollectedByChannel } from '../../../services/api/reservationsApi';
import type { CalendarBlockedDay } from '../../../services/api/calendarPricingApi';
import { planningDataApi, type PlanningData } from '../../../services/api/planningDataApi';
import type { Property, Reservation, ReservationStatus, PlanningIntervention, PlanningServiceRequest } from '../../../services/api';
import type { PlanningEvent, PlanningProperty } from '../types';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';
import { getReservationColor, getInterventionColor, getEventTypeColor } from '../utils/colorUtils';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const planningKeys = {
  all: ['planning-page'] as const,
  properties: (userId: string | undefined) =>
    [...planningKeys.all, 'properties', userId] as const,
  /**
   * UNE cle par tranche de dates : sejours, interventions, demandes en attente
   * de paiement et jours bloques arrivent ensemble (cf. planningDataApi).
   * Quatre cles distinctes signifiaient quatre requetes par tranche.
   */
  data: (propertyIds: number[], from: string, to: string) =>
    [...planningKeys.all, 'data', { propertyIds, from, to }] as const,
};

// ─── Fetch helpers ───────────────────────────────────────────────────────────

function unwrapPropertyList(data: unknown): Property[] {
  if (Array.isArray(data)) return data as Property[];
  if (data && typeof data === 'object' && 'content' in data && Array.isArray((data as { content: unknown }).content)) {
    return (data as { content: Property[] }).content;
  }
  return [];
}

function mapToPlanning(list: Property[]): PlanningProperty[] {
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    city: p.city,
    ownerName: p.ownerName || '',
    maxGuests: p.maxGuests,
    type: p.type,
    nightlyPrice: p.nightlyPrice,
    minimumNights: p.minimumNights,
    defaultCheckInTime: p.defaultCheckInTime,
    defaultCheckOutTime: p.defaultCheckOutTime,
    cleaningFrequency: p.cleaningFrequency,
    cleaningBasePrice: p.cleaningBasePrice,
    currency: (p as unknown as { defaultCurrency?: string }).defaultCurrency || 'EUR',
    photoUrls: p.photoUrls ?? [],
    latitude: p.latitude,
    longitude: p.longitude,
  }));
}

async function fetchProperties(
  user: { id: string; roles?: string[] } | null,
  isAdmin: boolean,
  isManager: boolean,
  isHost: boolean,
  isOperational: boolean,
): Promise<PlanningProperty[]> {
  if (!user) return [];

  let propertyList: Property[] = [];

  if (isAdmin || isManager || isHost) {
    // Le backend détecte le rôle HOST via JWT et filtre automatiquement
    // par ownerId côté serveur. Pas besoin d'envoyer ownerId depuis le frontend.
    try {
      propertyList = unwrapPropertyList(await propertiesApi.getAll());
    } catch { /* empty */ }
  } else if (isOperational) {
    try {
      const associations = await managersApi.getAssociations(user.id);
      if (associations?.properties && Array.isArray(associations.properties)) {
        propertyList = associations.properties.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address || '',
          city: p.city || '',
          postalCode: '',
          country: '',
          // Ni le type de bien ni la capacite ne figurent dans le read-model des
          // associations : ces lectures valaient `undefined` et retombaient deja
          // sur leur valeur neutre.
          type: '',
          status: '',
          bedroomCount: 0,
          bathroomCount: 0,
          squareMeters: 0,
          nightlyPrice: 0,
          description: '',
          maxGuests: 0,
          cleaningFrequency: '',
          ownerId: p.ownerId || 0,
        }));
      }
    } catch { /* empty */ }
  }

  return mapToPlanning(propertyList);
}

// ─── Prefetch (perf boot) ─────────────────────────────────────────────────────

/**
 * Précharge la query « properties » du Planning dès que l'utilisateur est connu
 * (appelé au montage d'AuthenticatedApp). Le Planning est la route d'atterrissage :
 * sans prefetch, ce fetch ne part qu'au mount de PlanningPage (après téléchargement
 * du chunk + gates de rendu), et les réservations n'en dérivent qu'ensuite.
 * Même clé + même staleTime que la query du hook → aucun double fetch.
 */
export function prefetchPlanningProperties(
  queryClient: import('@tanstack/react-query').QueryClient,
  user: { id: string; roles?: string[] } | null,
): void {
  if (!user) return;
  const roles = user.roles ?? [];
  const isAdmin = roles.includes('SUPER_ADMIN');
  const isManager = roles.includes('SUPER_MANAGER');
  const isHost = roles.includes('HOST');
  const isOperational = ['TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH']
    .some((r) => roles.includes(r));
  void queryClient.prefetchQuery({
    queryKey: planningKeys.properties(user.id),
    queryFn: () => fetchProperties(user, isAdmin, isManager, isHost, isOperational),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Transform reservations + interventions → PlanningEvent[] ────────────────

/**
 * Compute the effective visual status of a reservation based on dates and payment.
 * Priority:
 *   1. Cancelled → cancelled (red)
 *   2. Checkout in the past → checked_out (grey)
 *   3. Currently staying (checkIn <= today < checkOut) → checked_in (blue-grey)
 *   4. Paid (paymentStatus === 'PAID') → confirmed (green)
 *   5. Otherwise → pending (orange)
 */
/*
 * Les transformations ci-dessous sont EXPORTEES pour etre testees telles
 * quelles. Elles ne l'etaient pas, et leur test les REIMPLEMENTAIT localement :
 * il validait donc une copie, libre de deriver de l'original sans que rien ne
 * le signale — un vert qui ne prouvait rien.
 */
export function computeEffectiveStatus(r: Reservation): ReservationStatus {
  if (r.status === 'cancelled') return 'cancelled';

  const today = toDateStr(new Date());

  if (r.checkOut < today) return 'checked_out';
  if (r.checkIn <= today && r.checkOut >= today) return 'checked_in';
  if (r.paymentStatus === 'PAID') return 'confirmed';

  return 'pending';
}

const PAYMENT_BADGE_STATUSES = new Set(['PENDING', 'PROCESSING', 'FAILED']);

export function reservationToEvent(
  r: Reservation,
  propertyDefaults?: { defaultCheckInTime?: string; defaultCheckOutTime?: string },
): PlanningEvent {
  const effectiveStatus = computeEffectiveStatus(r);
  // Show payment badge when:
  // 1. paymentStatus is explicitly PENDING/PROCESSING/FAILED, OR
  // 2. paymentStatus is null/undefined and totalPrice > 0 (not yet paid, no explicit status)
  // Never show on cancelled/checked_out reservations or when PAID/REFUNDED/NOT_REQUIRED
  const isTerminal = effectiveStatus === 'cancelled' || effectiveStatus === 'checked_out';
  const isPaid = r.paymentStatus === 'PAID' || r.paymentStatus === 'REFUNDED' || r.paymentStatus === 'NOT_REQUIRED';
  // Réservations OTA (Airbnb, Booking, autres canaux iCal) : déjà réglées sur le canal externe,
  // le PMS n'encaisse rien (cf. PanelFinancial isOTABooking → reste à payer 0). Pas de pastille
  // de paiement, sinon incohérence avec le panneau qui affiche « Payé OTA ».
  const isOtaPaid = isCollectedByChannel(r);
  const hasUnpaidAmount = (r.totalPrice ?? 0) > 0;
  const needsBadge = !isTerminal && !isPaid && !isOtaPaid && hasUnpaidAmount;
  const badgeStatus: 'PENDING' | 'PROCESSING' | 'FAILED' | undefined = needsBadge
    ? (PAYMENT_BADGE_STATUSES.has(r.paymentStatus ?? '') ? r.paymentStatus as 'PENDING' | 'PROCESSING' | 'FAILED' : 'PENDING')
    : undefined;

  return {
    id: `res-${r.id}`,
    type: 'reservation',
    propertyId: r.propertyId,
    startDate: r.checkIn,
    endDate: r.checkOut,
    startTime: r.checkInTime || propertyDefaults?.defaultCheckInTime || '15:00',
    endTime: r.checkOutTime || propertyDefaults?.defaultCheckOutTime || '11:00',
    label: r.guestName,
    sublabel: r.source !== 'other' ? r.sourceName || r.source : undefined,
    status: effectiveStatus,
    color: getReservationColor(effectiveStatus),
    reservation: r,
    needsPaymentBadge: needsBadge,
    paymentBadgeStatus: badgeStatus,
  };
}

export function interventionToEvent(i: PlanningIntervention): PlanningEvent {
  // Compute a reliable endTime:
  // 1) Use the API-provided endTime if available
  // 2) Otherwise compute from startTime + estimatedDurationHours
  // 3) Fallback: startTime + 3h (typical cleaning duration)
  let endTime = i.endTime;
  if (!endTime && i.startTime && i.estimatedDurationHours) {
    const [h, m] = i.startTime.split(':').map(Number);
    const endH = Math.min(h + i.estimatedDurationHours, 23);
    endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } else if (!endTime && i.startTime) {
    // No duration info — assume 3h for cleaning, 2h for maintenance
    const defaultHours = i.type === 'cleaning' ? 3 : 2;
    const [h, m] = i.startTime.split(':').map(Number);
    const endH = Math.min(h + defaultHours, 23);
    endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const cost = i.actualCost || i.estimatedCost || 0;
  const intIsPaid = i.paymentStatus === 'PAID' || i.paymentStatus === 'REFUNDED' || i.paymentStatus === 'NOT_REQUIRED';
  const intNeedsBadge = cost > 0 && !intIsPaid;
  const intBadgeStatus: 'PENDING' | 'PROCESSING' | 'FAILED' | undefined = intNeedsBadge
    ? (PAYMENT_BADGE_STATUSES.has(i.paymentStatus ?? '') ? i.paymentStatus as 'PENDING' | 'PROCESSING' | 'FAILED' : 'PENDING')
    : undefined;

  return {
    id: `int-${i.id}`,
    type: i.type === 'cleaning' ? 'cleaning' : 'maintenance',
    propertyId: i.propertyId,
    startDate: i.startDate,
    endDate: i.endDate,
    startTime: i.startTime,
    endTime,
    label: i.title,
    sublabel: i.assigneeName,
    status: i.status,
    color: getInterventionColor(i.type),
    intervention: i,
    needsPaymentBadge: intNeedsBadge,
    paymentBadgeStatus: intBadgeStatus,
  };
}

const CLEANING_SERVICE_TYPES = new Set([
  'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
  'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING', 'EXTERIOR_CLEANING', 'DISINFECTION',
]);

export function serviceRequestToEvent(sr: PlanningServiceRequest): PlanningEvent {
  const eventType = CLEANING_SERVICE_TYPES.has(sr.serviceType) ? 'cleaning' : 'maintenance';

  let endTime = sr.endTime;
  if (!endTime && sr.startTime && sr.estimatedDurationHours) {
    const [h, m] = sr.startTime.split(':').map(Number);
    const endH = Math.min(h + sr.estimatedDurationHours, 23);
    endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return {
    id: `sr-${sr.id}`,
    type: eventType,
    propertyId: sr.propertyId,
    startDate: sr.startDate,
    endDate: sr.startDate,
    startTime: sr.startTime,
    endTime,
    label: sr.title,
    sublabel: sr.assignedToName || 'Att. paiement',
    status: 'awaiting_payment',
    color: getInterventionColor(eventType),
    isAwaitingPayment: true,
    needsPaymentBadge: true,
    paymentBadgeStatus: 'PENDING',
    serviceRequest: sr,
  };
}

// ─── Blocked days → PlanningEvent (group consecutive days into ranges) ───────

interface BlockedRange {
  propertyId: number;
  startDate: string;
  endDate: string;
  status: 'BLOCKED' | 'MAINTENANCE';
  source: string;
  notes: string | null;
}

export function groupBlockedDays(days: CalendarBlockedDay[]): BlockedRange[] {
  if (days.length === 0) return [];

  // Sort by propertyId, then date
  const sorted = [...days].sort((a, b) =>
    a.propertyId !== b.propertyId
      ? a.propertyId - b.propertyId
      : a.date.localeCompare(b.date),
  );

  const ranges: BlockedRange[] = [];
  let current: BlockedRange | null = null;

  for (const day of sorted) {
    if (
      current &&
      current.propertyId === day.propertyId &&
      current.status === day.status &&
      isNextDay(current.endDate, day.date)
    ) {
      // Extend current range
      current.endDate = day.date;
    } else {
      // Start new range
      if (current) ranges.push(current);
      current = {
        propertyId: day.propertyId,
        startDate: day.date,
        endDate: day.date,
        status: day.status,
        source: day.source,
        notes: day.notes,
      };
    }
  }
  if (current) ranges.push(current);
  return ranges;
}

function isNextDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA);
  a.setDate(a.getDate() + 1);
  return a.toISOString().slice(0, 10) === dateB;
}

function blockedRangeToEvent(range: BlockedRange, index: number): PlanningEvent {
  const eventType = range.status === 'MAINTENANCE' ? 'maintenance' : 'blocked';
  // endDate +1 day because the range is inclusive but planning events use exclusive end
  const endDate = new Date(range.endDate);
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().slice(0, 10);

  return {
    id: `block-${range.propertyId}-${range.startDate}-${index}`,
    type: eventType === 'blocked' ? 'blocked' : 'maintenance',
    propertyId: range.propertyId,
    startDate: range.startDate,
    endDate: endDateStr,
    label: range.notes || (range.status === 'MAINTENANCE' ? 'Maintenance' : 'Bloqué'),
    sublabel: range.source !== 'MANUAL' ? range.source : undefined,
    status: range.status.toLowerCase(),
    color: getEventTypeColor(eventType),
  };
}

// ─── Dedup helper ────────────────────────────────────────────────────────────

export function dedup<T extends { id: number }>(arrays: T[][]): T[] {
  const seen = new Map<number, T>();
  for (const arr of arrays) {
    for (const item of arr) {
      if (!seen.has(item.id)) {
        seen.set(item.id, item);
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * La premiere vague de chargement est-elle retombee ?
 *
 * <p>Exporte pour etre teste : la regle a une arete. « Plus rien en vol » ne
 * suffit pas — quand les logements sont deja en cache (ils sont prechargees au
 * boot) et que la page n'en designe encore aucun, AUCUNE requete n'est en vol
 * au premier rendu, et la condition serait vraie avant que le moindre sejour
 * n'ait ete demande. D'ou la troisieme clause : soit des donnees sont la, soit
 * il n'y a personne a interroger.</p>
 */
/**
 * La vague PRIORITAIRE est-elle encore en vol ?
 *
 * <p>A ne pas confondre avec « une tranche quelconque charge ». Les tranches de
 * buffer sont volontairement desactivees tant que les prioritaires n'ont pas
 * resolu : elles ne comptent donc pas pendant la premiere vague, puis
 * s'activent TOUTES d'un coup. Mesurer « une tranche charge » faisait alors
 * repasser l'indicateur a vrai juste apres la fenetre visible, et tout ce qui
 * attend l'atterrissage — la rangee de filtres — restait en reserve jusqu'au
 * bout du buffer, bien apres que le planning soit lisible.</p>
 *
 * <p>Les resultats arrivent dans l'ordre des tranches : l'index fait foi.</p>
 */
export function isPriorityWaveLoading(
  results: readonly { isLoading: boolean }[],
  chunks: readonly { from: string }[],
  priorityFroms: ReadonlySet<string>,
): boolean {
  return results.some((query, index) => {
    const chunk = chunks[index];
    return query.isLoading && !!chunk && priorityFroms.has(chunk.from);
  });
}

export function isPlanningSettled({
  propertiesLoading,
  chunksLoading,
  propertyCount,
  hasAnyData,
}: {
  propertiesLoading: boolean;
  chunksLoading: boolean;
  propertyCount: number;
  hasAnyData: boolean;
}): boolean {
  if (propertiesLoading || chunksLoading) return false;
  return propertyCount === 0 || hasAnyData;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UsePlanningDataReturn {
  properties: PlanningProperty[];
  events: PlanningEvent[];
  reservations: Reservation[];
  interventions: PlanningIntervention[];
  loading: boolean;
  /**
   * La premiere vague est retombee : plus aucune tranche en vol, et soit des
   * donnees, soit aucun logement a interroger.
   *
   * <p>A distinguer de `loading`, qui tombe des la PREMIERE tranche pour que la
   * grille se peigne au plus tot — les suivantes arrivent ensuite en
   * arriere-plan. Ce qui se DEDUIT des sejours charges (les canaux presents,
   * par exemple) n'est complet qu'ici : le lire plus tot, c'est le voir
   * grandir tranche par tranche.</p>
   */
  settled: boolean;
  error: string | null;
}

export function usePlanningData(
  bufferStart: Date,
  bufferEnd: Date,
): UsePlanningDataReturn {
  const { user } = useAuth();

  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN') || false;
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER') || false;
  const isSupervisor = user?.roles?.includes('SUPERVISOR') || false;
  const isLaundry = user?.roles?.includes('LAUNDRY') || false;
  const isExteriorTech = user?.roles?.includes('EXTERIOR_TECH') || false;
  const isOperational = isTechnician || isHousekeeper || isSupervisor || isLaundry || isExteriorTech;

  // Compute 30-day aligned chunks covering the buffer range
  const chunks = useMemo(
    () => getOverlappingChunks(bufferStart, bufferEnd, DATA_CHUNK_SIZE_DAYS),
    // Stabilize on date string to avoid re-creating chunks on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toDateStr(bufferStart), toDateStr(bufferEnd)],
  );

  // Query 1: Properties (unchanged — single query)
  const propertiesQuery = useQuery({
    queryKey: planningKeys.properties(user?.id),
    queryFn: () => fetchProperties(user, isAdmin, isManager, isHost, isOperational),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const properties = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);
  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  // ── Priorisation des chunks (perf atterrissage) ────────────────────────────
  // Le Planning est la route d'atterrissage : sans priorisation, les 4 groupes
  // de queries fetchent TOUS les chunks du buffer d'emblée (burst 4×N requêtes).
  // On fetch d'abord les chunks proches d'aujourd'hui (fenêtre visible), puis
  // les chunks de buffer éloignés une fois les prioritaires résolus.
  const priorityFroms = useMemo(() => {
    const today = new Date();
    const lo = new Date(today);
    lo.setDate(lo.getDate() - DATA_CHUNK_SIZE_DAYS);
    const hi = new Date(today);
    hi.setDate(hi.getDate() + DATA_CHUNK_SIZE_DAYS);
    const loStr = toDateStr(lo);
    const hiStr = toDateStr(hi);
    const set = new Set(
      chunks.flatMap((c) => (c.from <= hiStr && c.to >= loStr ? [c.from] : [])),
    );
    // Navigation loin d'aujourd'hui : aucun chunk proche → tout est prioritaire.
    return set.size > 0 ? set : new Set(chunks.map((c) => c.from));
  }, [chunks]);

  // « Réglé » = chaque query prioritaire a au moins un résultat (data ou erreur).
  // Calculé à chaque render (pas de useMemo) : le state du queryClient change
  // sans changer de référence — les queries prioritaires étant souscrites via
  // useQueries ci-dessous, leur résolution re-render ce hook et rouvre la vanne.
  const queryClient = useQueryClient();
  const prioritySettled = propertyIds.length > 0 && chunks
    .filter((c) => priorityFroms.has(c.from))
    .every((c) => {
      const state = queryClient.getQueryState(planningKeys.data(propertyIds, c.from, c.to));
      return !!state && (state.dataUpdatedAt > 0 || state.errorUpdatedAt > 0);
    });

  const chunkEnabled = (chunk: { from: string }) =>
    propertyIds.length > 0 && (priorityFroms.has(chunk.from) || prioritySettled);

  // UNE requete par tranche, et `combine` pour en deriver les quatre listes.
  //
  // Sans `combine`, `useQueries` rend un tableau d'identite NEUVE a chaque
  // rendu : les `useMemo` qui en derivaient recalculaient `events` en boucle et
  // produisaient des objets d'evenement neufs, ce qui invalidait la memo de
  // PlanningRow et faisait repeindre la grille entiere au moindre changement
  // d'etat local.
  const planningResult = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: planningKeys.data(propertyIds, chunk.from, chunk.to),
      queryFn: () => planningDataApi.getPlanningData(propertyIds, chunk.from, chunk.to),
      enabled: chunkEnabled(chunk),
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000, // keep cached 5 min after last use
    })),
    combine: (results) => {
      const blockedSeen = new Set<string>();
      const blocked: CalendarBlockedDay[] = [];
      for (const q of results) {
        if (!q.data) continue;
        for (const item of q.data.blocked ?? []) {
          const key = `${item.propertyId}-${item.date}`;
          if (blockedSeen.has(key)) continue;
          blockedSeen.add(key);
          blocked.push(item);
        }
      }
      const chunkData = results.map((q) => q.data).filter((d): d is PlanningData => !!d);
      return {
        reservations: dedup(chunkData.map((d) => d.reservations ?? [])),
        interventions: dedup(chunkData.map((d) => d.interventions ?? [])),
        awaitingPayment: dedup(chunkData.map((d) => d.awaitingPayment ?? [])),
        blocked,
        hasAnyData: chunkData.length > 0,
        isLoading: results.some((q) => q.isLoading),
        priorityLoading: isPriorityWaveLoading(results, chunks, priorityFroms),
        error: results.find((q) => q.error)?.error?.message,
      };
    },
  });

  const reservations = planningResult.reservations;
  const interventions = planningResult.interventions;
  const awaitingPaymentSRs = planningResult.awaitingPayment;
  const blockedDays = planningResult.blocked;

  // Build a property defaults lookup for check-in/check-out time fallback
  const propertyDefaultsMap = useMemo(() => {
    const map = new Map<number, { defaultCheckInTime?: string; defaultCheckOutTime?: string }>();
    for (const p of properties) {
      map.set(p.id, {
        defaultCheckInTime: p.defaultCheckInTime,
        defaultCheckOutTime: p.defaultCheckOutTime,
      });
    }
    return map;
  }, [properties]);

  // Merge into PlanningEvent[]
  // Interventions appear when assigned. Unpaid ones show a payment badge.
  const events = useMemo(() => {
    const resEvents = reservations.map((r) =>
      reservationToEvent(r, propertyDefaultsMap.get(r.propertyId)),
    );
    const visibleInterventions = interventions.filter((i) => {
      // Show if assigned OR if has unpaid cost (so payment badge is visible)
      if (i.assigneeName) return true;
      const cost = i.actualCost || i.estimatedCost || 0;
      const isPaid = i.paymentStatus === 'PAID' || i.paymentStatus === 'REFUNDED' || i.paymentStatus === 'NOT_REQUIRED';
      return cost > 0 && !isPaid;
    });
    const intEvents = visibleInterventions.map(interventionToEvent);
    const srEvents = awaitingPaymentSRs.map(serviceRequestToEvent);
    const blockedRanges = groupBlockedDays(blockedDays);
    const blockEvents = blockedRanges.map((r, i) => blockedRangeToEvent(r, i));
    return [...resEvents, ...intEvents, ...srEvents, ...blockEvents];
  }, [reservations, interventions, awaitingPaymentSRs, blockedDays, propertyDefaultsMap]);

  // Loading: only on initial load (no data yet, priority chunks in flight).
  // After initial, remaining chunks load in background. Les chunks non
  // prioritaires sont disabled au 1er rendu (isLoading=false) — le critère
  // est donc « aucune data + au moins un fetch en cours », pas every(isLoading).
  const planningInitialLoading = propertyIds.length > 0
    && !planningResult.hasAnyData && planningResult.isLoading;

  // Verrou : « chargement » ne vaut QUE pour le tout premier affichage.
  //
  // La page remplace la grille par un sursis plein ecran tant que `loading` est
  // vrai. Or la fenetre de chargement saute d'un bloc quand on fait defiler
  // vite (cf. useSettledRange) : atterrir sur une fenetre qui ne partage aucune
  // tranche avec la precedente remettait `hasAnyData` a faux, donc `loading` a
  // vrai — et la grille etait DEMONTEE en plein geste. Mesure au navigateur :
  // 6 rafales = 6 sursis plein ecran et 5 pertes de la position de defilement,
  // le remontage repartant du bord du buffer. Une fois la grille peinte, les
  // fenetres suivantes se chargent en fond : les cellules sont deja dessinees,
  // les briques y apparaissent quand la reponse arrive.
  const aDejaAffiche = useRef(false);
  if (!propertiesQuery.isLoading && planningResult.hasAnyData) {
    aDejaAffiche.current = true;
  }

  const loading = !aDejaAffiche.current
    && (propertiesQuery.isLoading || planningInitialLoading);

  // Error: first error from any query
  const error = propertiesQuery.error?.message
    ?? planningResult.error
    ?? null;

  return {
    properties,
    events,
    reservations,
    interventions,
    loading,
    settled: isPlanningSettled({
      propertiesLoading: propertiesQuery.isLoading,
      // La vague PRIORITAIRE, pas l'ensemble des tranches — cf.
      // isPriorityWaveLoading.
      chunksLoading: planningResult.priorityLoading,
      propertyCount: propertyIds.length,
      hasAnyData: planningResult.hasAnyData,
    }),
    error,
  };
}
