import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { sectorMapApi } from '../../services/api/sectorMapApi';
import ProviderSectorMap from '../marketplace/sectors/ProviderSectorMap';

export const mySectorMapKey = ['sector-map', 'mine'] as const;

/** Le secteur déclaré, dessiné : l'intervenant voit exactement où on le trouvera. */
export default function MySectorMap() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: mySectorMapKey, queryFn: () => sectorMapApi.mine() });
  return (
    <ProviderSectorMap
      map={query.data}
      isLoading={query.isLoading}
      isError={query.isError}
      height={320}
      emptyMessage={t('sectorMap.mineEmpty', 'Déclarez au moins un secteur pour le voir sur la carte.')}
    />
  );
}
