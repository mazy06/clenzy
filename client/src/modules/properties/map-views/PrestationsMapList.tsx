import { useMemo } from 'react';
import { Button, Skeleton, ToggleGroup, ToggleGroupItem } from '../../../components/ui';
import type { MapBounds } from '../../../components/BaitlyPropertyMap';
import type { useMissionMapPages } from '../../../hooks/useMissionMap';
import { useTranslation } from '../../../hooks/useTranslation';
import { useInterventionsList } from '../../interventions/useInterventionsList';
import { useServiceRequestsList } from '../../service-requests/useServiceRequestsList';
import { PrestationActionsContext } from '../../prestations/PrestationActionsContext';
import PrestationDialogs from '../../prestations/PrestationDialogs';
import PrestationRows from '../../prestations/PrestationRows';
import type { PrestationCategory, PrestationRow } from '../../prestations/prestationFilters';

/**
 * Liste de la vue Prestations : interventions et demandes ouvertes des logements de la zone
 * visible, dans l'ordre chronologique (en retard d'abord), par lots de 20. Chaque ligne garde
 * les actions de son type (assigner, valider, annuler…).
 */
export default function PrestationsMapList({ pages, bounds, category, onCategoryChange }: {
  /** Lots de la zone visible : lus par l'écran, qui en affiche le total en titre. */
  pages: ReturnType<typeof useMissionMapPages<PrestationRow>>;
  bounds: MapBounds | null;
  category: PrestationCategory;
  onCategoryChange: (category: PrestationCategory) => void;
}) {
  const { t } = useTranslation();
  const intervention = useInterventionsList(false);
  const request = useServiceRequestsList(false);
  const actions = { intervention, request };
  const rows = useMemo(() => {
    const unique = new Map<string, PrestationRow>();
    pages.data?.pages.forEach((page) => page.content.forEach((row) => unique.set(row.id, row)));
    return [...unique.values()];
  }, [pages.data]);

  return (
    <PrestationActionsContext.Provider value={actions}>
      <div className="px-3 py-2.5">
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={category}
          onValueChange={(value) => value && onCategoryChange(value as PrestationCategory)}
          aria-label={t('prestations.filters.kind', 'Type')}>
          <ToggleGroupItem value="all" className="cursor-pointer">{t('prestations.filters.allKinds', 'Toutes')}</ToggleGroupItem>
          <ToggleGroupItem value="intervention" className="cursor-pointer">{t('prestations.filters.interventions', 'Interventions')}</ToggleGroupItem>
          <ToggleGroupItem value="request" className="cursor-pointer">{t('prestations.filters.requests', 'Demandes')}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {(pages.isLoading || !bounds) && (
        <div className="space-y-3 p-3" role="status" aria-label={t('missionMap.loading')}>
          <Skeleton className="h-32" /><Skeleton className="h-32" />
        </div>
      )}
      {pages.isError && (
        <div role="alert" className="p-3 text-sm">
          <p className="m-0 mb-2">{t('missionMap.loadError')}</p>
          <Button variant="outline" size="sm" onClick={() => void pages.refetch()}>{t('common.retry')}</Button>
        </div>
      )}
      {pages.data && rows.length === 0 && (
        <p className="m-0 p-3 text-sm text-muted-foreground">{t('propertyMap.prestationsEmpty', 'Aucune prestation dans cette zone.')}</p>
      )}
      <PrestationRows rows={rows} />
      {pages.hasNextPage && (
        <div className="flex justify-center p-3">
          <Button variant="ghost" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>
            {pages.isFetchingNextPage ? t('missionMap.loading') : t('missionMap.loadMore')}
          </Button>
        </div>
      )}
      <PrestationDialogs actions={actions} />
    </PrestationActionsContext.Provider>
  );
}
