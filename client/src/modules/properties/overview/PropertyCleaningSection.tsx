import { AppWindow, SprayCan } from '../../../icons/glyphs';
import IllustratedHeading from '../../../components/IllustratedHeading';
import { Money } from '../../../components/Money';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PropertyDetailsData } from '../../../hooks/usePropertyDetails';
import { formatDate } from '../../../utils/formatUtils';
import { getCleaningFrequencyLabel } from '../../../utils/statusUtils';
import { resolveAmenityIcon } from '../../settings/amenity-mapping/amenityIcons';
import { useAmenityIconOverrides } from '../../settings/amenity-mapping/useAmenityIconOverrides';
import { AMENITY_TONES, amenityTone } from '../amenityCategories';
import { estimateCleaningPrice, formatCleaningDuration } from '../cleaningEstimate';
import { PROPERTY_ART } from '../propertyArtwork';
import { Facts, LongText, type Fact } from './PropertyOverviewParts';
import ToneTileList, { type ToneTile } from './ToneTileList';

/**
 * Prestations à la carte, dans les couleurs des familles d'équipements.
 * Quand une prestation a son équipement (terrasse, linge, repassage, cuisine),
 * elle reprend son icône de la bibliothèque, choix de l'organisation compris.
 */
function useCleaningServices(p: PropertyDetailsData): ToneTile[] {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { overrides } = useAmenityIconOverrides(user?.organizationId ?? null);
  const fromAmenity = (key: string, label: string, amenity: string): ToneTile => (
    { key, label, icon: resolveAmenityIcon(amenity, overrides), tone: amenityTone(amenity) }
  );
  const windows = [
    p.windowCount ? `${p.windowCount} ${t('properties.addOnServices.windowCountShort')}` : '',
    p.frenchDoorCount ? `${p.frenchDoorCount} ${t('properties.addOnServices.frenchDoorCountShort')}` : '',
    p.slidingDoorCount ? `${p.slidingDoorCount} ${t('properties.addOnServices.slidingDoorCountShort')}` : '',
  ].filter(Boolean).join(', ');

  return [
    p.hasExterior && fromAmenity('exterior', t('properties.hasExterior'), 'GARDEN_TERRACE'),
    p.hasLaundry && fromAmenity('laundry', t('properties.hasLaundry'), 'WASHING_MACHINE'),
    windows && { key: 'windows', label: t('properties.addOnServices.windows'), detail: windows, icon: AppWindow, tone: AMENITY_TONES.comfort },
    p.hasIroning && fromAmenity('ironing', t('properties.addOnServices.hasIroning'), 'IRON'),
    p.hasDeepKitchen && fromAmenity('deepKitchen', t('properties.addOnServices.hasDeepKitchen'), 'EQUIPPED_KITCHEN'),
    p.hasDisinfection && { key: 'disinfection', label: t('properties.addOnServices.hasDisinfection'), icon: SprayCan, tone: AMENITY_TONES.safetyFamily },
  ].filter((service): service is ToneTile => !!service);
}

/** Le ménage tel que les équipes le préparent : prix estimé, rythme, durée, prestations, consignes. */
export default function PropertyCleaningSection({ property: p }: { property: PropertyDetailsData }) {
  const { t } = useTranslation();
  const estimate = estimateCleaningPrice(p);
  const services = useCleaningServices(p);
  const facts: Fact[] = [
    { label: t('properties.cleaningFrequency'), value: getCleaningFrequencyLabel(p.cleaningFrequency, t) },
    ...(p.cleaningBasePrice ? [{ label: t('properties.cleaningBasePrice'), value: <Money value={p.cleaningBasePrice} from="EUR" decimals={0} /> }] : []),
    ...(p.cleaningDurationMinutes ? [{ label: t('properties.cleaningDuration'), value: formatCleaningDuration(p.cleaningDurationMinutes) }] : []),
    ...(p.numberOfFloors ? [{ label: t('properties.numberOfFloors'), value: p.numberOfFloors }] : []),
    ...(p.lastCleaning ? [{ label: t('properties.lastCleaning'), value: formatDate(p.lastCleaning) }] : []),
  ];

  return (
    <section className="pdo-section">
      <IllustratedHeading
        art={PROPERTY_ART.cleaning}
        title={t('propertyWorkspace.overview.cleaning.title')}
        hint={t('propertyWorkspace.overview.cleaning.hint')}
      />
      <div className="pdo-amount">
        <span className="pdo-amount__label">{t('properties.cleaningEstimate')}</span>
        <strong className="pdo-amount__value">
          {estimate != null ? <Money value={estimate} from="EUR" decimals={0} symbolSize={20} /> : '—'}
        </strong>
        <span className="pdo-amount__hint">{t('properties.cleaningEstimateTooltip')}</span>
      </div>
      <Facts items={facts} />
      {services.length > 0 && (
        <div>
          <span className="pdo-sublabel">{t('properties.addOnServices.title')}</span>
          <ToneTileList items={services} />
        </div>
      )}
      {p.cleaningNotes && <LongText label={t('properties.cleaningNotes')} text={p.cleaningNotes} />}
    </section>
  );
}
