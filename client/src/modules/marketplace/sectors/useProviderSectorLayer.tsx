import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers } from '../../../icons/glyphs';
import type { SectorMode, SectorOverlay } from '../../../components/map/sectorLayer';
import { ToggleGroup, ToggleGroupItem } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { sectorMapApi } from '../../../services/api/sectorMapApi';

export interface ProviderSectorLayer {
  /** Calque à passer à la carte ; null tant qu'il est éteint ou en chargement. */
  overlay: SectorOverlay | null;
  /** Bouton d'activation + choix fusionné / par prestataire, à poser sur la carte. */
  controls: ReactNode;
  /** Logement → prestataires qui le couvrent ; null si le calque est éteint. */
  coverage: Map<number, number[]> | null;
}

/**
 * Calque « Secteurs des prestataires » de la carte des logements : éteint par défaut (la
 * carte reste celle du planning), il montre à la demande les secteurs des prestataires
 * qui couvrent au moins un logement, et l'anneau des épingles passe en couvert / non couvert.
 */
export function useProviderSectorLayer(): ProviderSectorLayer {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<SectorMode>('merged');
  const query = useQuery({
    queryKey: ['sector-map', 'relevant'],
    queryFn: () => sectorMapApi.relevant(),
    enabled,
    staleTime: 5 * 60_000,
  });
  const data = enabled ? query.data : undefined;

  const overlay = useMemo<SectorOverlay | null>(() => data ? {
    providers: data.providers.map((p) => ({ id: p.providerId, geometry: p.geometry })),
    merged: data.merged,
    mode,
  } : null, [data, mode]);

  const coverage = useMemo(() => data
    ? new Map(data.properties.map((p) => [p.id, p.coveredBy]))
    : null, [data]);

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={enabled} onClick={() => setEnabled((on) => !on)}
        className="baitly-map-fit-button" data-active={enabled || undefined}>
        <Layers size={16} aria-hidden="true" />
        <span>{t('sectorMap.layer', 'Secteurs des prestataires')}</span>
      </button>
      {enabled && query.isLoading && <span role="status" className="rounded-lg bg-card px-3 py-2 text-xs text-muted-foreground">
        {t('sectorMap.loading', 'Chargement des secteurs…')}
      </span>}
      {enabled && query.isError && <span role="alert" className="rounded-lg bg-card px-3 py-2 text-xs text-[var(--bui-destructive-ink)]">
        {t('sectorMap.loadError', 'Les secteurs n’ont pas pu être chargés.')}
      </span>}
      {data && data.providers.length === 0 && <span role="status" className="max-w-64 rounded-lg bg-card px-3 py-2 text-xs text-muted-foreground">
        {t('sectorMap.noneRelevant', 'Aucun prestataire du catalogue ne couvre encore vos logements.')}
      </span>}
      {data && data.providers.length > 1 && (
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={mode}
          onValueChange={(value) => value && setMode(value as SectorMode)}
          className="rounded-md bg-card shadow-sm"
          aria-label={t('sectorMap.modeLabel', 'Affichage des secteurs')}>
          <ToggleGroupItem value="merged">{t('sectorMap.merged', 'Fusionnés')}</ToggleGroupItem>
          <ToggleGroupItem value="byProvider">{t('sectorMap.byProvider', 'Par prestataire')}</ToggleGroupItem>
        </ToggleGroup>
      )}
    </div>
  );

  return { overlay, controls, coverage };
}
