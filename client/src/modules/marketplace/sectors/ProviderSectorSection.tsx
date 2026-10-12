import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../hooks/useTranslation';
import { sectorMapApi } from '../../../services/api/sectorMapApi';
import ProviderSectorMap from './ProviderSectorMap';

/** Secteur d'un prestataire sur sa fiche, avec les logements de l'organisation couverts ou non. */
export default function ProviderSectorSection({ providerId }: { providerId: number }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['sector-map', 'provider', providerId],
    queryFn: () => sectorMapApi.provider(providerId),
  });
  return (
    <ProviderSectorMap
      map={query.data}
      isLoading={query.isLoading}
      isError={query.isError}
      height={360}
      emptyMessage={t('sectorMap.providerEmpty', 'Ce prestataire n’a déclaré aucun secteur dessinable.')}
    />
  );
}
