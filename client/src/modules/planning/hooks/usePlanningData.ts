import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { propertiesApi, managersApi, reservationsApi, serviceRequestsApi } from '../../../services/api';
import { calendarPricingApi } from '../../../services/api/calendarPricingApi';
import type { CalendarBlockedDay } from '../../../services/api/calendarPricingApi';
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
  reservations: (propertyIds: number[], from: string, to: string) =>
    [...planningKeys.all, 'reservations', { propertyIds, from, to }] as const,
  interventions: (propertyIds: number[], from: string, to: string) =>
    [...planningKeys.all, 'interventions', { propertyIds, from, to }] as const,
  awaitingPayment: (propertyIds: number[], from: string, to: string) =>
    [...planningKeys.all, 'awaitingPayment', { propertyIds, from, to }] as const,
  blockedDays: (propertyIds: number[], from: string, to: string) =>
    [...planningKeys.all, 'blockedDays', { propertyIds, from, to }] as const,
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

  // Mock mode: return mock properties regardless of role
  if (reservationsApi.isMockMode()) {
    return reservationsApi.getMockProperties().map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      ownerName: p.ownerName || '',
      maxGuests: p.maxGuests,
      type: p.type,
      nightlyPrice: 0,
      minimumNights: 1,
      defaultCheckInTime: '15:00',
      defaultCheckOutTime: '11:00',
    }));
  }

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
        propertyList = associations.properties.map((p: { id: number; name: string; address?: string; city?: string; type?: string; ownerId?: number; maxGuests?: number }) => ({
          id: p.id,
          name: p.name,
          address: p.address || '',
          city: p.city || '',
          postalCode: '',
          country: '',
          type: p.type || '',
          status: '',
          bedroomCount: 0,
          bathroomCount: 0,
          squareMeters: 0,
          nightlyPrice: 0,
          description: '',
          maxGuests: p.maxGuests || 0,
          cleaningFrequency: '',
          ownerId: p.ownerId || 0,
        }));
      }
    } catch { /* empty */ }
  }

  return mapToPlanning(propertyList);
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
function computeEffectiveStatus(r: Reservation): ReservationStatus {
  if (r.status === 'cancelled') return 'cancelled';

  const today = toDateStr(new Date());

  if (r.checkOut < today) return 'checked_out';
  if (r.checkIn <= today && r.checkOut >= today) return 'checked_in';
  if (r.paymentStatus === 'PAID') return 'confirmed';

  return 'pending';
}

const PAYMENT_BADGE_STATUSES = new Set(['PENDING', 'PROCESSING', 'FAILED']);

function reservationToEvent(
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
  const hasUnpaidAmount = (r.totalPrice ?? 0) > 0;
  const needsBadge = !isTerminal && !isPaid && hasUnpaidAmount;
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

function interventionToEvent(i: PlanningIntervention): PlanningEvent {
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

function serviceRequestToEvent(sr: PlanningServiceRequest): PlanningEvent {
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

function groupBlockedDays(days: CalendarBlockedDay[]): BlockedRange[] {
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

function dedup<T extends { id: number }>(arrays: T[][]): T[] {
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

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UsePlanningDataReturn {
  properties: PlanningProperty[];
  events: PlanningEvent[];
  reservations: Reservation[];
  interventions: PlanningIntervention[];
  loading: boolean;
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

  const properties = propertiesQuery.data ?? [];
  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  // Query 2: Reservations — one query per chunk
  const reservationQueries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: planningKeys.reservations(propertyIds, chunk.from, chunk.to),
      queryFn: () => reservationsApi.getAll({ propertyIds, from: chunk.from, to: chunk.to }),
      enabled: propertyIds.length > 0,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000, // keep cached 5 min after last use
    })),
  });

  // Query 3: Interventions — one query per chunk
  const interventionQueries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: planningKeys.interventions(propertyIds, chunk.from, chunk.to),
      queryFn: () => reservationsApi.getPlanningInterventions({ propertyIds, from: chunk.from, to: chunk.to }),
      enabled: propertyIds.length > 0,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  // Query 4: Service Requests AWAITING_PAYMENT — one query per chunk
  const awaitingPaymentQueries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: planningKeys.awaitingPayment(propertyIds, chunk.from, chunk.to),
      queryFn: () => serviceRequestsApi.getPlanningAwaitingPayment({ propertyIds, from: chunk.from, to: chunk.to }),
      enabled: propertyIds.length > 0,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  // Query 5: Blocked/Maintenance days — one query per chunk
  const blockedQueries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: planningKeys.blockedDays(propertyIds, chunk.from, chunk.to),
      queryFn: () => calendarPricingApi.getBlockedDays(propertyIds, chunk.from, chunk.to),
      enabled: propertyIds.length > 0,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  // Merge + dedup all chunk results
  const reservations = useMemo(() => {
    const allChunkData = reservationQueries
      .map((q) => q.data)
      .filter((d): d is Reservation[] => !!d);
    return dedup(allChunkData);
  }, [reservationQueries]);

  const interventions = useMemo(() => {
    const allChunkData = interventionQueries
      .map((q) => q.data)
      .filter((d): d is PlanningIntervention[] => !!d);
    return dedup(allChunkData);
  }, [interventionQueries]);

  const awaitingPaymentSRs = useMemo(() => {
    const allChunkData = awaitingPaymentQueries
      .map((q) => q.data)
      .filter((d): d is PlanningServiceRequest[] => !!d);
    return dedup(allChunkData);
  }, [awaitingPaymentQueries]);

  const blockedDays = useMemo(() => {
    const allChunkData = blockedQueries
      .map((q) => q.data)
      .filter((d): d is CalendarBlockedDay[] => !!d);
    // Flatten and deduplicate by propertyId+date
    const seen = new Set<string>();
    const result: CalendarBlockedDay[] = [];
    for (const arr of allChunkData) {
      for (const item of arr) {
        const key = `${item.propertyId}-${item.date}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
    }
    return result;
  }, [blockedQueries]);

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

  // Loading: only on initial load (all chunks loading). After initial, chunks load in background.
  const reservationsInitialLoading = propertyIds.length > 0 &&
    reservationQueries.every((q) => q.isLoading);
  const interventionsInitialLoading = propertyIds.length > 0 &&
    interventionQueries.every((q) => q.isLoading);

  const loading = propertiesQuery.isLoading
    || reservationsInitialLoading
    || interventionsInitialLoading;

  // Error: first error from any query
  const error = propertiesQuery.error?.message
    ?? reservationQueries.find((q) => q.error)?.error?.message
    ?? interventionQueries.find((q) => q.error)?.error?.message
    ?? null;

  return {
    properties,
    events,
    reservations,
    interventions,
    loading,
    error,
  };
}
