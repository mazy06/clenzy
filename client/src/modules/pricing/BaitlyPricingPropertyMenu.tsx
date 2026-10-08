import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useMediaQuery } from '../../hooks/use-media-query';
import { API_CONFIG } from '../../config/api';
import { getPropertyTypeBannerUrl } from '../../utils/propertyTypeBanner';
import type { Property } from '../../services/api/propertiesApi';

export function PropertyThumbnail({ property }: { property: Property }) {
  const [failed, setFailed] = useState(false);
  const photo = property.coverPhotoUrl || property.photoUrls?.[0];
  const fallback = getPropertyTypeBannerUrl(property.type || 'other');
  const src = !failed && photo ? (photo.startsWith('http') ? photo : `${API_CONFIG.BASE_URL}${photo}`) : fallback;
  return <img src={src} alt="" width={48} height={44} loading="lazy" decoding="async"
    className={photo && !failed ? 'bp-property-photo' : 'bp-property-illustration'}
    onError={() => { if (photo && !failed) setFailed(true); }} />;
}

interface Props {
  properties: Property[];
  selectedPropertyId: number | null;
  loading: boolean;
  ownerRequired: boolean;
  onSelect: (id: number) => void;
}

export default function BaitlyPricingPropertyMenu({ properties, selectedPropertyId, loading, ownerRequired, onSelect }: Props) {
  const { t } = useTranslation();
  const compact = useMediaQuery('(max-width: 767.98px)');
  const [expanded, setExpanded] = useState(false);
  const selected = properties.find((property) => property.id === selectedPropertyId);
  const label = t('navigation.properties', 'Propriétés');
  return <aside className="bp-property-menu">
    <div className="bp-property-menu-heading">
      {compact ? <Button variant="ghost" aria-expanded={expanded} aria-controls="baitly-pricing-properties"
        onClick={() => setExpanded(!expanded)} className="w-full justify-between">
        <span dir="auto">{selected?.name ?? label}</span><ChevronDown size={16} />
      </Button> : <h2>{label}</h2>}
      {!compact && <span className="text-xs text-muted-foreground tabular-nums">{properties.length}</span>}
    </div>
    {(!compact || expanded) && <nav id="baitly-pricing-properties" aria-label={label} className="bp-property-list">
      {loading ? Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />) : ownerRequired ?
        <p className="bp-property-menu-empty">{t('baitlyPricing.ownerRequired', 'Sélectionnez un propriétaire dans le header pour afficher ses logements.')}</p> : properties.length === 0 ?
        <p className="bp-property-menu-empty">{t('dynamicPricing.calendar.noProperty', 'Aucun logement disponible')}</p> : properties.map((property) =>
          <button type="button" key={property.id} aria-pressed={property.id === selectedPropertyId}
            className="bp-property-option" onClick={() => { onSelect(property.id); if (compact) setExpanded(false); }}>
            <PropertyThumbnail key={property.coverPhotoUrl || property.id} property={property} />
            <span className="bp-property-name"><span dir="auto">{property.name}</span>{property.city && <small dir="auto">{property.city}</small>}</span>
          </button>)}
    </nav>}
  </aside>;
}
