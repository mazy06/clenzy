import { useMemo } from 'react';
import { usePropertiesList } from '../../hooks/usePropertiesList';

/** Both widgets share the existing portfolio cache, never one request per thumbnail. */
export function useDashboardPropertyPhotos() {
  const { properties } = usePropertiesList();
  return useMemo(() => new Map(properties.map((property) => [
    Number(property.id), property.imageUrl || property.photoUrls?.[0],
  ])), [properties]);
}
