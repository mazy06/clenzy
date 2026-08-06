import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import {
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import type { NavigateFunction } from 'react-router-dom';
import { Home, LocationOn, Visibility } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import EmptyState from '../../components/EmptyState';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import MissingContractChip from './MissingContractChip';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import MapWithSheet from '../../components/baitly/MapWithSheet';
import { Money } from '../../components/Money';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';
import {
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getPropertyTypeHex,
} from '../../utils/statusUtils';
import { propertyStatusTokens } from './propertiesListConstants';

/** Surface « carte » de la liste (hairline + rayon xl + fond carte). */
const LIST_SURFACE_CLASS = 'border border-solid border-border rounded-xl bg-card';

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

/** Vue carte : carte fixe en haut + liste scrollable des propriétés du viewport. */
const PropertiesMapView: React.FC<PropertiesMapViewProps> = ({
  mapMarkers, viewportProperties, channexMappings, onBoundsChange, onDiagnose,
  canManageContracts, missingContractIds, onMissingContractClick, navigate,
}) => {
  const { t } = useTranslation();

  // Aucun marqueur : ni carte ni feuille, seulement l'explication.
  if (mapMarkers.length === 0) {
    return (
      <div className={cn(LIST_SURFACE_CLASS, 'shrink-0 overflow-hidden')}>
        <EmptyState
          variant="transparent"
          minHeight={400}
          icon={<Home />}
          title="Aucune propriété avec coordonnées GPS"
          description="Les coordonnées sont ajoutées automatiquement lors de la saisie de l'adresse"
        />
      </div>
    );
  }

  return (
    <MapWithSheet
      className="h-[calc(100vh_-_140px)] min-h-[500px]"
      map={
        <MapboxPropertyMap
          properties={mapMarkers}
          height="100%"
          onMarkerClick={(marker) => {
            if (marker.id) navigate(`/properties/${marker.id}`);
          }}
          onBoundsChange={onBoundsChange}
        />
      }
      listTitle={`${viewportProperties.length} ${viewportProperties.length > 1 ? 'propriétés' : 'propriété'} dans la zone visible`}
      emptyState={viewportProperties.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={<Home />}
          title="Aucune propriété dans cette zone"
          description="Déplacez ou dézoomez la carte."
        />
      ) : undefined}
    >
      {viewportProperties.map((property) => {
                const typeColor = getPropertyTypeHex(property.type);
                return (
                  <Item
                    key={property.id}
                    variant="outline"
                    size="xs"
                    className={cn(
                      'shrink-0 flex-nowrap rounded-xl bg-card cursor-pointer',
                      'transition-[border-color,box-shadow] duration-150 hover:border-input hover:shadow-sm motion-reduce:transition-none',
                    )}
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    {/* Nom + adresse */}
                    <ItemContent className="min-w-0 gap-0.5">
                      <ItemTitle className="min-w-0 max-w-full gap-1">
                        <span className="min-w-0 truncate text-sm font-semibold">
                          {property.name}
                        </span>
                        {/* Quick Win #4 : badge sante Channex */}
                        {channexMappings.get(Number(property.id)) && (
                          <ChannexHealthBadge
                            mapping={channexMappings.get(Number(property.id)) ?? null}
                            size={9}
                            variant="dot"
                            onClick={() => onDiagnose(Number(property.id), property.name)}
                          />
                        )}
                        {canManageContracts && missingContractIds.has(Number(property.id)) && (
                          <MissingContractChip
                            onClick={(e) => { e.stopPropagation(); onMissingContractClick(Number(property.id)); }}
                          />
                        )}
                      </ItemTitle>
                      <div className="flex min-w-0 items-center gap-0.5 text-2xs text-muted-foreground">
                        <span className="inline-flex shrink-0"><LocationOn size={13} strokeWidth={1.75} /></span>
                        <span className="truncate">
                          {property.address}, {property.city}
                        </span>
                      </div>
                    </ItemContent>

                    {/* Type + Statut chips */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <StatusChip color={typeColor} label={getPropertyTypeLabel(property.type, t)} />
                      <StatusChip tokens={propertyStatusTokens(property.status)} label={getPropertyStatusLabel(property.status, t)} />
                    </div>

                    {/* Prix + Action */}
                    <ItemActions className="shrink-0 gap-2">
                      {property.nightlyPrice > 0 && (
                        <p className="my-0 whitespace-nowrap font-[family-name:var(--font-display)] text-sm font-semibold text-foreground tabular-nums">
                          <Money value={property.nightlyPrice} from="EUR" decimals={0} />
                          <span className="text-2xs text-muted-foreground">
                            /nuit
                          </span>
                        </p>
                      )}
                      {/* span intermediaire : TooltipTrigger asChild pose une ref DOM,
                          que le Button du kit (fonction, React 18) ne transmet pas. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Détails"
                              onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}`); }}
                            >
                              <Visibility size={16} strokeWidth={1.75} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Détails</TooltipContent>
                      </Tooltip>
                    </ItemActions>
                  </Item>
                );
      })}
    </MapWithSheet>
  );
};

export default PropertiesMapView;
