import { mergedSectorColor, sectorColor, type SectorMode } from '../../../components/map/sectorLayer';
import { useThemeMode } from '../../../hooks/useThemeMode';
import { useTranslation } from '../../../hooks/useTranslation';
import type { SectorMap } from '../../../services/api/sectorMapApi';

interface ProviderSectorLegendProps {
  map: SectorMap;
  mode: SectorMode;
  onHighlight: (providerId: number | null) => void;
}

/**
 * Qui couvre quoi : un prestataire par ligne (sa teinte sur la carte, ses zones, le nombre
 * de logements couverts) et les zones déclarées qu'on ne sait pas dessiner.
 */
export default function ProviderSectorLegend({ map, mode, onHighlight }: ProviderSectorLegendProps) {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();
  const theme = isDark ? 'dark' : 'light';
  const colorOf = (index: number) => (mode === 'merged' ? mergedSectorColor(theme) : sectorColor(index, theme));
  const coveredCount = (providerId: number | null) =>
    map.properties.filter((p) => providerId != null && p.coveredBy.includes(providerId)).length;
  const uncovered = map.properties.filter((p) => p.coveredBy.length === 0);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {map.providers.map((provider, index) => {
          const undrawn = provider.zones.filter((zone) => !zone.drawn).map((zone) => zone.name);
          const approx = provider.zones.some((zone) => zone.approx);
          return (
            <li key={provider.providerId ?? 'mine'}
              className="flex items-start gap-3 px-3 py-2 text-sm"
              onMouseEnter={() => onHighlight(provider.providerId)}
              onMouseLeave={() => onHighlight(null)}>
              <span aria-hidden className="mt-1 size-3 shrink-0 rounded-sm border-2"
                style={{
                  borderColor: colorOf(index),
                  backgroundColor: `color-mix(in srgb, ${colorOf(index)} 25%, transparent)`,
                }} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  {provider.name ?? t('sectorMap.mySector', 'Mon secteur')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {provider.zones.filter((zone) => zone.drawn).map((zone) => zone.name).join(', ')
                    || t('sectorMap.noZone', 'Aucune zone déclarée')}
                </span>
                {approx && <span className="text-xs text-muted-foreground">
                  {t('sectorMap.approx', 'Contour approché autour de la ville (limite administrative inconnue).')}
                </span>}
                {undrawn.length > 0 && <span className="text-xs text-[var(--bui-warning-ink)]">
                  {t('sectorMap.undrawn', { zones: undrawn.join(', '), defaultValue: 'Sans contour sur la carte : {{zones}}' })}
                </span>}
              </div>
              {map.properties.length > 0 && provider.providerId != null && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {t('sectorMap.coversCount', {
                    count: coveredCount(provider.providerId), total: map.properties.length,
                    defaultValue: '{{count}} / {{total}} logements',
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {map.providers.length > 0 && uncovered.length > 0 && (
        <p className="text-xs text-[var(--bui-warning-ink)]">
          {t('sectorMap.uncovered', {
            count: uncovered.length,
            names: uncovered.slice(0, 5).map((p) => p.name).join(', '),
            defaultValue: '{{count}} logement(s) hors de ces secteurs : {{names}}',
          })}
        </p>
      )}
    </div>
  );
}
