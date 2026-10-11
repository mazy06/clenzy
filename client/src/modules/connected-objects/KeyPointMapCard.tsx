import { useNavigate } from 'react-router-dom';
import StatusChip from '../../components/StatusChip';
import {
  MapCard,
  MapCardAction,
  MapCardFacts,
  MapCardFooter,
  MapCardHeader,
  MapCardPerson,
} from '../../components/map/MapCard';
import { AccessTime, Home, LocationOn, Phone } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { KeyExchangePointDto } from '../../services/api/keyExchangeApi';

const PROVIDER_LABELS: Record<KeyExchangePointDto['provider'], string> = {
  KEYNEST: 'KeyNest',
  CLENZY_KEYVAULT: 'Baitly KeyVault',
};

/**
 * Fiche d'un point de remise des clés dans la bulle de carte : où il se trouve
 * (adresse + photos de l'emplacement exact), quand il est ouvert, quel logement
 * il dessert. Les données viennent du listing des points, déjà chargé : aucune
 * requête au clic.
 */
export default function KeyPointMapCard({ point }: { point: KeyExchangePointDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const guardian =
    point.guardianType === 'MERCHANT'
      ? t('baitlyMap.card.merchant', 'Commerçant')
      : point.guardianType === 'INDIVIDUAL'
        ? t('baitlyMap.card.individual', 'Particulier')
        : null;

  return (
    <MapCard photos={(point.photos ?? []).map((photo) => photo.url)} alt={point.storeName}>
      <MapCardHeader
        eyebrow={guardian ?? t('connectedObjects.keybox.handoverPoint')}
        title={point.storeName}
        status={
          point.activeCodesCount > 0 ? (
            <StatusChip pill tone="ok" label={t('baitlyMap.card.activeCodes', { count: point.activeCodesCount, defaultValue: 'Codes actifs : {{count}}' })} />
          ) : undefined
        }
      />
      <MapCardFacts
        facts={[
          { icon: <LocationOn size={14} />, label: t('connectedObjects.keybox.address'), value: point.storeAddress },
          { icon: <AccessTime size={14} />, label: t('connectedObjects.keybox.openingHours'), value: point.storeOpeningHours },
          !!point.storePhone && {
            icon: <Phone size={14} />,
            label: t('connectedObjects.keybox.phone'),
            value: (
              <a href={`tel:${point.storePhone}`} className="tabular-nums text-foreground underline-offset-2 hover:underline">
                {point.storePhone}
              </a>
            ),
          },
          { icon: <Home size={14} />, label: t('connectedObjects.keybox.property'), value: point.propertyName },
        ]}
      />
      {!point.photos?.length ? (
        <p className="m-0 text-2xs text-muted-foreground">{t('baitlyMap.card.noLocationPhoto', "Pas encore de photo de l'emplacement.")}</p>
      ) : null}
      <MapCardFooter>
        <MapCardPerson name={PROVIDER_LABELS[point.provider] ?? point.provider} role={t('connectedObjects.keybox.provider')} />
        <MapCardAction
          label={t('baitlyMap.card.openPoint', 'Voir le point')}
          onClick={() => navigate(`/connected-objects/device/keybox/${point.id}`)}
        />
      </MapCardFooter>
    </MapCard>
  );
}
