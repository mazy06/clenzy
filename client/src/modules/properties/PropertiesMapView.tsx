import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CircleCheck, Wrench } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Home } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useHomeMapCenter } from '../../hooks/useHomeMapCenter';
import EmptyState from '../../components/EmptyState';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import MapWithSheet from '../../components/baitly/MapWithSheet';
import PropertyMapRow from './PropertyMapRow';
import type { NavigateFunction } from 'react-router-dom';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';

/**
 * Taille du lot affiché. La zone visible peut contenir des centaines de logements ;
 * les peindre tous d'un coup construit autant de lignes, chacune avec ses pastilles
 * et ses infobulles, pour un écran qui n'en montre qu'une dizaine. Les données sont
 * déjà côté client : ce qui coûte, c'est le DOM, et c'est lui qu'on étale.
 */
const BATCH_SIZE = 20;

interface PropertiesMapViewProps {
  mapMarkers: PropertyMarker[];
  viewportProperties: PropertyListItem[];
  channexMappings: Map<number, ChannexMappingDto>;
  onBoundsChange: (bounds: MapBounds) => void;
  onDiagnose: (propertyId: number, propertyName: string) => void;
  canManageContracts: boolean;
  missingContractIds: Set<number>;
  /** Clic sur le badge « Contrat manquant » : ouvre la modal de contrat préselectionnée. */
  onMissingContractClick: (propertyId: number) => void;
  navigate: NavigateFunction;
}

/**
 * Vue carte des logements — même surface que les deux autres cartes de
 * l'application (demandes de service, interventions) : sur desktop la carte
 * occupe la colonne principale et la liste vit dans un panneau à droite, à sa
 * hauteur ; sous 640 px la liste devient la feuille tirable de `MapWithSheet`.
 *
 * <p>L'empilement précédent — carte de 400 px en haut, liste dessous — pliait
 * deux surfaces qui réclament chacune l'attention entière : en lisant la liste
 * la carte était morte au-dessus, en manipulant la carte la liste sortait du
 * champ. Le panneau latéral les rend simultanées, ce qui est le propre d'une
 * vue carte : déplacer la carte MET À JOUR la liste, sous les yeux.</p>
 */
const PropertiesMapView: React.FC<PropertiesMapViewProps> = ({
  mapMarkers, viewportProperties, channexMappings, onBoundsChange, onDiagnose,
  canManageContracts, missingContractIds, onMissingContractClick, navigate,
}) => {
  const { t } = useTranslation();
  const homeCenter = useHomeMapCenter();

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [viewportProperties]);
  const visibleProperties = viewportProperties.slice(0, visibleCount);
  const hasMore = visibleCount < viewportProperties.length;
  useEffect(() => {
    const sentinel = endRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => count + BATCH_SIZE); },
      { root: sentinel.closest('[data-map-list-scroll]'), threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  /** Compteurs de la ZONE VISIBLE — ils suivent la carte, là où les tuiles
      portefeuille du haut d'écran suivent, elles, les filtres. */
  const indicators = useMemo(() => {
    const counts = viewportProperties.reduce(
      (accumulator, property) => {
        const status = String(property.status).toUpperCase();
        if (status === 'ACTIVE') accumulator.active += 1;
        if (status === 'MAINTENANCE' || status === 'UNDER_MAINTENANCE') accumulator.maintenance += 1;
        if (missingContractIds.has(Number(property.id))) accumulator.missing += 1;
        return accumulator;
      },
      { active: 0, maintenance: 0, missing: 0 },
    );
    return [
      { key: 'active', label: t('properties.statuses.ACTIVE'), count: counts.active, Icon: CircleCheck, color: 'var(--bui-success-ink)' },
      { key: 'maintenance', label: t('properties.statuses.MAINTENANCE'), count: counts.maintenance, Icon: Wrench, color: 'var(--bui-warning-ink)' },
      ...(canManageContracts
        ? [{ key: 'missing', label: t('contracts.gate.badge', 'Contrat manquant'), count: counts.missing, Icon: AlertTriangle, color: 'var(--bui-destructive-ink)' }]
        : []),
    ];
  }, [viewportProperties, missingContractIds, canManageContracts, t]);

  const emptyState = mapMarkers.length === 0 ? (
    <EmptyState
      variant="plain"
      icon={<Home />}
      title={t('propertyMap.noCoordinatesTitle')}
      description={t('propertyMap.noCoordinates')}
    />
  ) : viewportProperties.length === 0 ? (
    <EmptyState
      variant="plain"
      icon={<Home />}
      title={t('propertyMap.emptyZoneTitle')}
      description={t('propertyMap.emptyZone')}
    />
  ) : undefined;

  // Plancher de securite sur la surface : `flex-1` se resout a zero si un
  // ancetre cesse d'etre contraint en hauteur, et la carte disparaitrait alors
  // en silence.
  return (
    <MapWithSheet
      desktopLayout="split"
      className="min-h-[480px]"
      listResetKey={`${viewportProperties.length}:${viewportProperties[0]?.id ?? ''}`}
      map={
        <MapboxPropertyMap
          properties={mapMarkers}
          center={homeCenter}
          height="100%"
          onMarkerClick={(marker) => {
            if (marker.id) navigate(`/properties/${marker.id}`);
          }}
          onBoundsChange={onBoundsChange}
        />
      }
      listTitle={t('propertyMap.visible', { count: viewportProperties.length })}
      listIndicators={
        <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
          {indicators.map(({ key, label, count, Icon, color }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={`${count} ${label}`}
                  className="inline-flex items-center gap-1 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon size={15} style={{ color }} aria-hidden />
                  <span className="font-semibold">{count}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      }
      emptyState={emptyState}
    >
      {visibleProperties.map((property) => (
        <PropertyMapRow
          key={property.id}
          property={property}
          channexMapping={channexMappings.get(Number(property.id))}
          onDiagnose={onDiagnose}
          showMissingContract={canManageContracts && missingContractIds.has(Number(property.id))}
          onMissingContractClick={onMissingContractClick}
        />
      ))}
      {hasMore && (
        <div ref={endRef} className="flex shrink-0 justify-center p-3">
          <Button variant="ghost" onClick={() => setVisibleCount((count) => count + BATCH_SIZE)}>
            {t('missionMap.loadMore')}
          </Button>
        </div>
      )}
    </MapWithSheet>
  );
};

export default PropertiesMapView;
