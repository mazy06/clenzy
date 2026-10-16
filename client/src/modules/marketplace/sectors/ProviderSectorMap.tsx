import { useMemo, useState } from 'react';
import { BaitlyPropertyMap, type PropertyMarker } from '../../../components/BaitlyPropertyMap';
import type { SectorMode, SectorOverlay } from '../../../components/map/sectorLayer';
import { Skeleton, ToggleGroup, ToggleGroupItem } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import type { SectorMap } from '../../../services/api/sectorMapApi';
import ProviderSectorLegend from './ProviderSectorLegend';

interface ProviderSectorMapProps {
  map: SectorMap | undefined;
  isLoading: boolean;
  isError: boolean;
  height?: number | string;
  /** Légende des prestataires et logements couverts sous la carte. */
  showLegend?: boolean;
  /** Message quand aucun secteur n'a de contour (zone non déclarée…). */
  emptyMessage: string;
}

/**
 * Carte des secteurs d'intervention : contour + fond translucide par prestataire (ou réunis
 * sous une seule bordure), et les logements de l'organisation, couverts ou non.
 */
export default function ProviderSectorMap({
  map, isLoading, isError, height = 420, showLegend = true, emptyMessage,
}: ProviderSectorMapProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SectorMode>('merged');
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const providerCount = map?.providers.filter((p) => p.geometry).length ?? 0;
  const effectiveMode: SectorMode = providerCount > 1 ? mode : 'byProvider';

  const markers = useMemo<PropertyMarker[]>(() => (map?.properties ?? [])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      id: p.id,
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      name: p.name,
      type: 'property',
      state: p.coveredBy.length > 0 ? 'covered' : 'uncovered',
    })), [map]);

  const overlay = useMemo<SectorOverlay | null>(() => map ? {
    providers: map.providers.map((p) => ({ id: p.providerId, geometry: p.geometry })),
    merged: map.merged,
    mode: effectiveMode,
    highlightedProviderId: highlighted,
  } : null, [map, effectiveMode, highlighted]);

  if (isLoading) return <Skeleton className="w-full rounded-lg" style={{ height }} />;
  if (isError) {
    return <p role="alert" className="text-sm text-[var(--bui-destructive-ink)]">
      {t('sectorMap.loadError', 'Les secteurs n’ont pas pu être chargés.')}
    </p>;
  }

  const modeToggle = providerCount > 1 ? (
    <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={mode}
      onValueChange={(value) => value && setMode(value as SectorMode)}
      className="rounded-md bg-card shadow-sm"
      aria-label={t('sectorMap.modeLabel', 'Affichage des secteurs')}>
      <ToggleGroupItem value="merged">{t('sectorMap.merged', 'Fusionnés')}</ToggleGroupItem>
      <ToggleGroupItem value="byProvider">{t('sectorMap.byProvider', 'Par prestataire')}</ToggleGroupItem>
    </ToggleGroup>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <BaitlyPropertyMap properties={markers} sectors={overlay} overlayControls={modeToggle} height={height} />
      {providerCount === 0 && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
      {showLegend && map && (
        <ProviderSectorLegend map={map} mode={effectiveMode} onHighlight={setHighlighted} />
      )}
      {map?.attribution && <p className="text-[11px] text-muted-foreground">{map.attribution}</p>}
    </div>
  );
}
