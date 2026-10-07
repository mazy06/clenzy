import React, { useState } from 'react';
import { Bath, BedDouble, ExternalLink, Images, Map as MapIcon, MapPin, Ruler, Users } from 'lucide-react';
import { Button } from '../../../components/ui';
import { MapboxPropertyMap } from '../../../components/MapboxPropertyMap';
import StatusChip from '../../../components/StatusChip';
import IllustratedHeading from '../../../components/IllustratedHeading';
import { Money } from '../../../components/Money';
import { PropertyImageCarousel } from '../../../components/PropertyImageCarousel';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PropertyDetailsData } from '../../../hooks/usePropertyDetails';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '../../../utils/statusUtils';
import { propertyStatusTokens } from '../propertiesListConstants';
import { PROPERTY_ART } from '../propertyArtwork';
import { AccessSection, Facts, ManagementSection } from './PropertyOverviewParts';
import PropertyAmenities from './PropertyAmenities';
import PropertyCleaningSection from './PropertyCleaningSection';
import './propertyOverview.css';

interface PropertyOverviewProps {
  property: PropertyDetailsData;
  photoUrls: string[];
  /** Ouvre l'onglet des instructions d'arrivée ; absent sans droit d'édition. */
  onEditAccess?: () => void;
}

type HeroView = 'photos' | 'map';

/** Bascule du bandeau entre les photos et la carte ; l'état actif est marqué. */
function HeroViewSwitch({ view, onChange }: { view: HeroView; onChange: (view: HeroView) => void }) {
  const { t } = useTranslation();
  const options = [
    { value: 'photos' as const, label: t('propertyWorkspace.overview.view.photos'), icon: <Images size={16} /> },
    { value: 'map' as const, label: t('propertyWorkspace.overview.view.map'), icon: <MapIcon size={16} /> },
  ];
  return (
    <div className="pdo-hero__switch" role="group" aria-label={t('propertyWorkspace.overview.view.label')}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

/** Identité du logement, à côté des photos. */
function HeroIdentity({ property: p }: { property: PropertyDetailsData }) {
  const { t } = useTranslation();
  const figures = [
    { icon: <BedDouble size={16} />, label: t('properties.bedrooms'), value: p.bedrooms },
    { icon: <Bath size={16} />, label: t('properties.bathroomCount'), value: p.bathrooms },
    { icon: <Ruler size={16} />, label: t('properties.surface'), value: p.surfaceArea ? `${p.surfaceArea} m²` : '—' },
    { icon: <Users size={16} />, label: t('properties.maxCapacity'), value: p.maxGuests },
  ];
  const address = [p.address, [p.postalCode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ');
  return (
    <>
      <h2 dir="auto">{p.name}</h2>
      {address && (
        <p className="pdo-hero__address" dir="auto">
          <MapPin size={15} aria-hidden="true" />
          {address}
        </p>
      )}
      <dl className="pdo-figures">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.icon}{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
      {p.nightlyPrice > 0 && (
        <div className="pdo-hero__price">
          <span>{t('propertyWorkspace.overview.nightlyPrice')}</span>
          <strong><Money value={p.nightlyPrice} from="EUR" decimals={0} symbolSize={18} /></strong>
        </div>
      )}
    </>
  );
}

/** Où se trouve le logement, à côté de la carte : l'adresse telle qu'on la donne au voyageur. */
function HeroLocation({ property: p }: { property: PropertyDetailsData }) {
  const { t } = useTranslation();
  const coordinates = `${p.latitude!.toFixed(5)}, ${p.longitude!.toFixed(5)}`;
  return (
    <>
      <h2 dir="auto">{p.name}</h2>
      <Facts items={[
        { label: t('properties.address'), value: <span dir="auto">{p.address}</span> },
        { label: t('propertyWorkspace.overview.location.city'), value: <span dir="auto">{[p.postalCode, p.city].filter(Boolean).join(' ')}</span> },
        ...(p.country ? [{ label: t('properties.country'), value: p.country }] : []),
        { label: t('propertyWorkspace.overview.location.coordinates'), value: <span dir="ltr">{coordinates}</span> },
      ]} />
      <Button variant="outline" size="sm" asChild className="self-start">
        <a href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
          {t('propertyWorkspace.overview.location.openGoogleMaps')}
        </a>
      </Button>
    </>
  );
}

/**
 * Photos et identité : ce qu'est le logement, d'un coup d'œil. Quand il est
 * géolocalisé, une bascule remplace les photos par la carte et l'identité par
 * l'adresse ; l'autre icône ramène aux photos. La hauteur ne bouge pas d'un
 * mode à l'autre : carrousel et carte remplissent le même cadre sans peser sur
 * sa hauteur, et les deux panneaux d'informations sont superposés.
 */
function Hero({ property: p, photoUrls }: { property: PropertyDetailsData; photoUrls: string[] }) {
  const { t } = useTranslation();
  const [view, setView] = useState<HeroView>('photos');
  const hasCoordinates = p.latitude != null && p.longitude != null;
  const showMap = hasCoordinates && view === 'map';

  return (
    <section className="pdo-hero" data-view={showMap ? 'map' : 'photos'}>
      <div className="pdo-hero__media">
        {showMap ? (
          <MapboxPropertyMap
            properties={[{ lat: p.latitude!, lng: p.longitude!, name: p.name, id: Number(p.id), type: 'property' }]}
            center={[p.longitude!, p.latitude!]}
            zoom={15}
            height="100%"
          />
        ) : (
          <PropertyImageCarousel
            photoUrls={photoUrls}
            alt={p.name}
            width="100%"
            height="100%"
            alwaysShowNav
            enableFullscreen
            showCounter
            sx={{ width: '100%', borderRadius: 0 }}
          />
        )}
      </div>
      <div className="pdo-hero__body">
        <div className="pdo-hero__top">
          <div className="pdo-hero__eyebrow">
            {showMap ? (
              <span className="pdo-hero__eyebrow-label"><MapPin size={14} aria-hidden="true" />{t('propertyWorkspace.overview.location.title')}</span>
            ) : (
              <>
                <StatusChip tokens={propertyStatusTokens(p.status)} label={getPropertyStatusLabel(p.status, t)} />
                <span>{getPropertyTypeLabel(p.propertyType, t)}</span>
              </>
            )}
          </div>
          {hasCoordinates && <HeroViewSwitch view={view} onChange={setView} />}
        </div>
        {/* Les deux panneaux occupent la même cellule : l'inactif est masqué
            (ni lu ni atteignable au clavier) mais garde sa place, si bien que le
            bandeau a la même hauteur en mode photos et en mode carte. */}
        <div className="pdo-hero__panels">
          <div className="pdo-hero__panel" data-active={!showMap} aria-hidden={showMap || undefined}>
            <HeroIdentity property={p} />
          </div>
          {hasCoordinates && (
            <div className="pdo-hero__panel" data-active={showMap} aria-hidden={!showMap || undefined}>
              <HeroLocation property={p} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Vue d'ensemble d'un logement : identité en tête, puis l'exploitation (ménage, accueil, gestion). */
export default function PropertyOverview({ property: p, photoUrls, onEditAccess }: PropertyOverviewProps) {
  const { t } = useTranslation();
  return (
    <div className="pdo">
      <Hero property={p} photoUrls={photoUrls} />
      <div className="pdo-columns">
        <div className="pdo-column">
          <PropertyCleaningSection property={p} />
          {p.description && (
            <section className="pdo-section">
              <IllustratedHeading
                art={PROPERTY_ART.description}
                title={t('propertyWorkspace.overview.description.title')}
                hint={t('propertyWorkspace.overview.description.hint')}
              />
              <p className="pdo-prose" dir="auto">{p.description}</p>
            </section>
          )}
          <section className="pdo-section">
            <IllustratedHeading
              art={PROPERTY_ART.amenities}
              title={t('properties.amenities.title')}
              hint={t('propertyWorkspace.overview.amenities.hint')}
            />
            {p.amenities?.length ? (
              <PropertyAmenities codes={p.amenities} />
            ) : (
              <p className="pdo-empty">{t('propertyWorkspace.overview.amenities.empty')}</p>
            )}
          </section>
        </div>
        <div className="pdo-column">
          <AccessSection property={p} onEdit={onEditAccess} />
          <ManagementSection property={p} />
        </div>
      </div>
    </div>
  );
}
