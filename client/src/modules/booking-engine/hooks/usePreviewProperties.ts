import { useEffect, useRef, useState } from 'react';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { propertyPhotosApi } from '../../../services/api/propertyPhotosApi';
import apiClient from '../../../services/apiClient';
import type { PreviewProperty } from '../BookingEnginePreview';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReviewStatsMap {
  avg: number;
  count: number;
}

export interface UsePreviewPropertiesResult {
  previewProperties: PreviewProperty[];
  reviewStats: Map<number, ReviewStatsMap>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Fetches properties with photos and review stats for the booking engine preview.
 * Runs once on mount and loads all properties + their photos + review stats.
 */
export function usePreviewProperties(): UsePreviewPropertiesResult {
  const [previewProperties, setPreviewProperties] = useState<PreviewProperty[]>([]);
  const [reviewStats, setReviewStats] = useState<Map<number, ReviewStatsMap>>(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const params: Record<string, string | number> = { size: 500 };
    propertiesApi.getAll(params)
      .then(async (props) => {
        const propertiesWithPhotos = await Promise.all(
          props.map(async (p) => {
            // Common detail fields from PMS property
            const detail = {
              id: p.id,
              name: p.name,
              type: p.type,
              nightlyPrice: p.nightlyPrice,
              cleaningFee: p.cleaningBasePrice,
              description: p.description || null,
              amenities: p.amenities || null,
              maxGuests: p.maxGuests ?? null,
              squareMeters: p.squareMeters ?? null,
              bedroomCount: p.bedroomCount ?? null,
              bathroomCount: p.bathroomCount ?? null,
              city: p.city || null,
              country: p.country || null,
              checkInTime: p.defaultCheckInTime || null,
              checkOutTime: p.defaultCheckOutTime || null,
            };
            try {
              const photos = await propertyPhotosApi.list(p.id);
              const sorted = photos.sort((a, b) => a.sortOrder - b.sortOrder);
              return {
                ...detail,
                photoIds: sorted.map((ph) => ph.id),
                photoUrls: sorted.map((ph) => propertyPhotosApi.getPhotoUrl(p.id, ph.id)),
              };
            } catch {
              return {
                ...detail,
                photoIds: [] as number[],
                photoUrls: [] as string[],
              };
            }
          }),
        );
        if (!isMountedRef.current) return;
        setPreviewProperties(propertiesWithPhotos);

        // Load review stats for each property
        const statsMap = new Map<number, ReviewStatsMap>();
        await Promise.all(
          propertiesWithPhotos.map(async (p) => {
            try {
              const stats = await apiClient.get<{ averageRating: number; totalCount: number }>(
                `/reviews/stats/${p.id}`,
              );
              if (stats.totalCount > 0) {
                statsMap.set(p.id, { avg: stats.averageRating, count: stats.totalCount });
              }
            } catch {
              /* ignore — reviews not available */
            }
          }),
        );
        if (!isMountedRef.current) return;
        setReviewStats(statsMap);
      })
      .catch(() => {});

    return () => { isMountedRef.current = false; };
  }, []);

  return { previewProperties, reviewStats };
}
