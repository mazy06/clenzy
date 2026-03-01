import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { propertiesApi, managersApi, reservationsApi } from '../../../services/api';
import type { Property, Reservation, PlanningIntervention } from '../../../services/api';
import type { PlanningEvent, PlanningProperty } from '../types';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';
import { getReservationColor, getInterventionColor } from '../utils/colorUtils';
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
    }));
  }

  let propertyList: Property[] = [];

  if (isAdmin || isManager) {
    try {
      propertyList = unwrapPropertyList(await propertiesApi.getAll());
    } catch { /* empty */ }
  } else if (isHost) {
    try {
      propertyList = unwrapPropertyList(await propertiesApi.getAll({ ownerId: user.id }));
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

function reservationToEvent(r: Reservation): PlanningEvent {
  return {
    id: `res-${r.id}`,
    type: 'reservation',
    propertyId: r.propertyId,
    startDate: r.checkIn,
    endDate: r.checkOut,
    startTime: r.checkInTime,
    endTime: r.checkOutTime,
    label: r.guestName,
    sublabel: r.source !== 'other' ? r.sourceName || r.source : undefined,
    status: r.status,
    color: getReservationColor(r.status),
    reservation: r,
  };
}

function interventionToEvent(i: PlanningIntervention): PlanningEvent {
  return {
    id: `int-${i.id}`,
    type: i.type === 'cleaning' ? 'cleaning' : 'maintenance',
    propertyId: i.propertyId,
    startDate: i.startDate,
    endDate: i.endDate,
    startTime: i.startTime,
    endTime: i.endTime,
    label: i.title,
    sublabel: i.assigneeName,
    status: i.status,
    color: getInterventionColor(i.type),
    intervention: i,
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

  // Merge into PlanningEvent[]
  const events = useMemo(() => {
    const resEvents = reservations.map(reservationToEvent);
    const intEvents = interventions.map(interventionToEvent);
    return [...resEvents, ...intEvents];
  }, [reservations, interventions]);

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
