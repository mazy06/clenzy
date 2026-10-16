import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronNext } from '../../../icons';
import { mergedSectorColor, sectorBounds, sectorColor, type SectorMode } from '../../../components/map/sectorLayer';
import type { MapBounds } from '../../../components/BaitlyPropertyMap';
import { Button, ToggleGroup, ToggleGroupItem } from '../../../components/ui';
import { useThemeMode } from '../../../hooks/useThemeMode';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ProviderSectors, SectorMap } from '../../../services/api/sectorMapApi';
import ProviderAvatar from '../ProviderAvatar';

interface ProviderSectorPanelProps {
  data: SectorMap | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Emprise visible de la carte ; null tant qu'elle n'a pas été mesurée. */
  bounds: MapBounds | null;
  mode: SectorMode;
  onModeChange: (mode: SectorMode) => void;
  selectedId: number | null;
  onSelect: (providerId: number | null) => void;
  onHover: (providerId: number | null) => void;
  areaProviderIds?: readonly number[] | null;
  onClearAreaFilter?: () => void;
}

interface VisibleProvider {
  provider: ProviderSectors;
  /** Rang dans la réponse : c'est lui qui fixe la teinte sur la carte. */
  index: number;
  covered: number;
}

const PROVIDERS_PER_BATCH = 10;

/**
 * Prestataires dont le secteur entre dans la partie visible de la carte : la liste suit
 * la carte comme celle des logements. Survoler une ligne fait ressortir son secteur ;
 * la sélectionner le garde en avant et réduit l'anneau des épingles à ce prestataire.
 */
export default function ProviderSectorPanel({
  data, isLoading, isError, bounds, mode, onModeChange, selectedId, onSelect, onHover,
  areaProviderIds, onClearAreaFilter,
}: ProviderSectorPanelProps) {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();
  const theme = isDark ? 'dark' : 'light';
  const areaIds = useMemo(() => areaProviderIds ? new Set(areaProviderIds) : null, [areaProviderIds]);

  // Emprise de chaque secteur : un parcours de tous ses sommets, fait une fois par jeu de
  // données et non à chaque déplacement de la carte.
  const extents = useMemo(() => new Map((data?.providers ?? [])
    .filter((provider) => provider.geometry)
    .map((provider) => [provider, sectorBounds(provider.geometry!)] as const)), [data]);

  const visible = useMemo<VisibleProvider[]>(() => {
    if (!data) return [];
    return data.providers
      .map((provider, index) => ({
        provider,
        index,
        covered: data.properties.filter((p) => provider.providerId != null && p.coveredBy.includes(provider.providerId)).length,
      }))
      .filter(({ provider }) => !areaIds || (provider.providerId != null && areaIds.has(provider.providerId)))
      // Une zone sélectionnée prime sur le cadrage ; sinon, garder le prestataire sélectionné visible.
      .filter(({ provider }) => areaIds != null || (provider.providerId != null && provider.providerId === selectedId)
        || (extents.has(provider) && (!bounds || intersects(extents.get(provider)!, bounds))))
      .sort((a, b) => Number(b.provider.providerId === selectedId) - Number(a.provider.providerId === selectedId)
        || b.covered - a.covered || (a.provider.name ?? '').localeCompare(b.provider.name ?? ''));
  }, [data, bounds, selectedId, extents, areaIds]);

  // La pagination suit les candidats visibles, jamais leur rang global dans le catalogue.
  const visibleKey = visible.map(({ provider }) => provider.providerId).join(',');
  const [batch, setBatch] = useState({ key: visibleKey, count: PROVIDERS_PER_BATCH });
  const displayedCount = Math.min(visible.length, batch.key === visibleKey ? batch.count : PROVIDERS_PER_BATCH);
  const hasMore = displayedCount < visible.length;
  const loadMore = useCallback(() => {
    setBatch(previous => ({
      key: visibleKey,
      count: Math.min(visible.length, (previous.key === visibleKey ? previous.count : PROVIDERS_PER_BATCH) + PROVIDERS_PER_BATCH),
    }));
  }, [visibleKey, visible.length]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setBatch(previous => previous.key === visibleKey ? previous : { key: visibleKey, count: PROVIDERS_PER_BATCH });
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [visibleKey]);
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = moreRef.current;
    if (!root || !sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    let requested = false;
    const observer = new IntersectionObserver(entries => {
      if (!requested && entries.some(entry => entry.isIntersecting)) {
        requested = true;
        loadMore();
      }
    }, { root, rootMargin: '0px 0px 100px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayedCount, hasMore, loadMore]);

  // Une sélection venue d'ailleurs (jour choisi dans une fiche logement) doit rester visible.
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId, visible]);

  const colorOf = (index: number, providerId: number | null) =>
    mode === 'merged' && providerId !== selectedId ? mergedSectorColor(theme) : sectorColor(index, theme);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card"
      aria-label={t('sectorMap.panelLabel', 'Prestataires de la zone visible')}>
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-3">
        <span className="text-sm font-medium tabular-nums">
          {data
            ? t('sectorMap.visibleCount', { count: visible.length, defaultValue: '{{count}} prestataire(s) dans cette zone' })
            : t('sectorMap.layer', 'Secteurs des prestataires')}
        </span>
        {areaIds && <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
          <span>{t('sectorMap.areaFilter', 'Secteur sélectionné')}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClearAreaFilter}>
            {t('sectorMap.clearAreaFilter', 'Effacer le filtre')}
          </Button>
        </div>}
        {data && data.providers.length > 1 && (
          <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={mode}
            onValueChange={(value) => value && onModeChange(value as SectorMode)}
            className="self-start" aria-label={t('sectorMap.modeLabel', 'Affichage des secteurs')}>
            <ToggleGroupItem value="merged">{t('sectorMap.merged', 'Fusionnés')}</ToggleGroupItem>
            <ToggleGroupItem value="byProvider">{t('sectorMap.byProvider', 'Par prestataire')}</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onMouseLeave={() => onHover(null)}>
        {isLoading && <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
          {t('sectorMap.loading', 'Chargement des secteurs…')}
        </p>}
        {isError && <p role="alert" className="px-3 py-4 text-sm text-[var(--bui-destructive-ink)]">
          {t('sectorMap.loadError', 'Les secteurs n’ont pas pu être chargés.')}
        </p>}
        {data && data.providers.length === 0 && <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
          {t('sectorMap.noneRelevant', 'Aucun prestataire du catalogue ne couvre encore vos logements.')}
        </p>}
        {data && data.providers.length > 0 && visible.length === 0 && <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
          {t('sectorMap.noneVisible', 'Aucun secteur dans la zone visible. Déplacez ou dézoomez la carte.')}
        </p>}
        <ul ref={listRef} className="m-0 list-none divide-y divide-border p-0">
          {visible.slice(0, displayedCount).map(({ provider, index, covered }) => {
            const id = provider.providerId;
            const selected = id != null && id === selectedId;
            const color = colorOf(index, id);
            const zones = provider.zones.filter((zone) => zone.drawn).map((zone) => zone.name).join(', ');
            return (
              <li key={id ?? index} className="flex items-stretch" data-selected={selected || undefined}
                onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)}>
                <button type="button" aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : id)}
                  onFocus={() => onHover(id)} onBlur={() => onHover(null)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-start transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-pressed:bg-muted">
                  {/* L'anneau porte la teinte du secteur sur la carte. */}
                  <ProviderAvatar url={provider.avatarUrl} name={provider.name ?? ''}
                    className="m-0.5 size-10 rounded-full" style={{ boxShadow: `0 0 0 2px var(--bui-card), 0 0 0 4px ${color}` }} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">{provider.name}</span>
                    {zones ? <span className="truncate text-xs text-muted-foreground" title={zones}>{zones}</span>
                      : <span className="text-xs text-muted-foreground">{t('sectorMap.noZone', 'Aucune zone déclarée')}</span>}
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t('sectorMap.coversProperties', { count: covered, defaultValue: '{{count}} logement(s) couvert(s)' })}
                    </span>
                  </span>
                </button>
                {id != null && (
                  <Link to={`/prestataires/${id}`}
                    aria-label={t('sectorMap.openProvider', { name: provider.name, defaultValue: 'Ouvrir la fiche de {{name}}' })}
                    className="flex w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <ChevronNext size={16} aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {visible.length > PROVIDERS_PER_BATCH && <div ref={moreRef} className="border-t border-border px-3 py-2">
          <p role="status" className="m-0 text-center text-xs tabular-nums text-muted-foreground">
            {t('sectorMap.displayedCount', { shown: displayedCount, total: visible.length, defaultValue: '{{shown}} sur {{total}} affichés' })}
          </p>
          {hasMore && <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" onClick={loadMore}>
            {t('sectorMap.loadMore', { count: Math.min(PROVIDERS_PER_BATCH, visible.length - displayedCount), defaultValue: 'Afficher les {{count}} suivants' })}
          </Button>}
        </div>}
      </div>
    </section>
  );
}

/** Emprise [ouest, sud, est, nord] du secteur et emprise visible se recouvrent-elles ? */
function intersects([west, south, east, north]: [number, number, number, number], bounds: MapBounds): boolean {
  return west <= bounds.east && east >= bounds.west && south <= bounds.north && north >= bounds.south;
}
