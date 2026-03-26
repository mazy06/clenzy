import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingEngineApi } from '../services/api/bookingEngineApi';
import type { AvailabilityDay, PropertyTypeInfo } from '../services/api/bookingEngineApi';

interface UseBookingEngineAvailabilityParams {
  /** Premier mois affiché (year, month 0-indexed) */
  baseMonth: { year: number; month: number };
  /** Types de logement sélectionnés (vide = tous) */
  selectedTypes?: string[];
  /** Nombre de voyageurs */
  guests?: number;
  /** Désactiver le fetch (ex: preview fermée) */
  enabled?: boolean;
}

interface UseBookingEngineAvailabilityResult {
  /** Map date (yyyy-MM-dd) → AvailabilityDay */
  dayMap: Map<string, AvailabilityDay>;
  /** Types de logement disponibles dans l'organisation */
  propertyTypes: PropertyTypeInfo[];
  /** Chargement en cours */
  isLoading: boolean;
  /** Erreur éventuelle */
  error: string | null;
  /** Rafraîchir manuellement */
  refresh: () => void;
}

/**
 * Hook pour récupérer la disponibilité et les prix du calendrier du Booking Engine.
 * Charge automatiquement 2 mois à partir du mois de base.
 */
export function useBookingEngineAvailability({
  baseMonth,
  selectedTypes = [],
  guests,
  enabled = true,
}: UseBookingEngineAvailabilityParams): UseBookingEngineAvailabilityResult {
  const [dayMap, setDayMap] = useState<Map<string, AvailabilityDay>>(new Map());
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typesKey = useMemo(() => selectedTypes.join(','), [selectedTypes]);

  const fetchAvailability = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Calculer la plage : 2 mois complets à partir du mois de base
      const from = new Date(baseMonth.year, baseMonth.month, 1);
      const toDate = new Date(baseMonth.year, baseMonth.month + 2, 0); // dernier jour du 2e mois

      const fromStr = formatDate(from);
      const toStr = formatDate(toDate);

      const response = await bookingEngineApi.getCalendarAvailability({
        from: fromStr,
        to: toStr,
        types: selectedTypes.length > 0 ? selectedTypes : undefined,
        guests: guests && guests > 0 ? guests : undefined,
      });

      const map = new Map<string, AvailabilityDay>();
      for (const day of response.days) {
        map.set(day.date, day);
      }
      setDayMap(map);
      setPropertyTypes(response.propertyTypes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- typesKey is a stable derived primitive
  }, [baseMonth.year, baseMonth.month, typesKey, guests, enabled]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return { dayMap, propertyTypes, isLoading, error, refresh: fetchAvailability };
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
