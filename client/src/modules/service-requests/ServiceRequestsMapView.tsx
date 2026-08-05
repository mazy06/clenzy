import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { Button, Card, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, LocationOn, Build as BuildIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { ServiceRequest } from './serviceRequestsUtils';
import {
  getServiceRequestStatusLabel,
  getServiceRequestPriorityLabel,
} from '../../utils/statusUtils';
import { stripPropertySuffix } from './serviceRequestDisplayMapper';
import { srStatusTokens, srPriorityTokens } from './serviceRequestsListConstants';

/** Report en classes de `LIST_PAPER_SX` (hairline, rayon xl, surface de carte). */
const LIST_SURFACE_CLASS = 'border border-solid border-border shadow-none rounded-xl bg-card';

interface ServiceRequestsMapViewProps {
  mapMarkers: PropertyMarker[];
  viewportRequests: ServiceRequest[];
  onBoundsChange: (bounds: MapBounds) => void;
  navigate: NavigateFunction;
}

/** Vue carte : carte fixe en haut + liste scrollable des demandes du viewport. */
const ServiceRequestsMapView: React.FC<ServiceRequestsMapViewProps> = ({
  mapMarkers, viewportRequests, onBoundsChange, navigate,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={cn(LIST_SURFACE_CLASS, 'p-0 overflow-hidden shrink-0')}>
        {mapMarkers.length > 0 ? (
          <MapboxPropertyMap
            properties={mapMarkers}
            height={400}
            onMarkerClick={(marker) => {
              if (marker.id) navigate(`/service-requests/${marker.id}`);
            }}
            onBoundsChange={onBoundsChange}
          />
        ) : (
          <EmptyState
            variant="transparent"
            minHeight={400}
            icon={<BuildIcon />}
            title="Aucune demande avec coordonnées GPS"
            description="Renseignez l'adresse des logements concernés pour les voir apparaître sur la carte."
          />
        )}
      </div>

      {mapMarkers.length > 0 && (
        <div className="mt-2 flex-1 min-h-0 flex flex-col">
          <p className="mb-1.5 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
            {viewportRequests.length} {viewportRequests.length > 1 ? 'demandes' : 'demande'} dans la zone visible
          </p>

          {viewportRequests.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={<LocationOn />}
              title="Aucune demande dans cette zone"
              description="Déplacez ou dézoomez la carte."
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pe-0.5">
              {viewportRequests.map((request) => {
                return (
                  <Card className="gap-0 py-0 bg-card p-2 cursor-pointer transition-colors duration-200 shrink-0 hover:bg-muted" key={request.id} onClick={() => navigate(`/service-requests/${request.id}`)}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                          {stripPropertySuffix(request.title, request.propertyName)}
                        </p>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <span className="inline-flex text-primary shrink-0"><LocationOn size={13} strokeWidth={1.75} /></span>
                          <p className="text-[11.5px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                            {request.propertyName} — {request.propertyAddress}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <StatusChip pill tokens={srStatusTokens(request.status)} label={getServiceRequestStatusLabel(request.status, t)} />
                        <StatusChip pill tokens={srPriorityTokens(request.priority)} label={getServiceRequestPriorityLabel(request.priority, t)} />
                        {request.assignedToName && (
                          <p className="text-[11.5px] text-muted-foreground ms-0.5">
                            {request.assignedToName}
                          </p>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex ms-0.5">
                              {/* Sans onClick : le clic remonte a la carte, qui navigue. */}
                              <Button variant="ghost" size="icon-sm" aria-label="Voir">
                                <Visibility size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Voir</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceRequestsMapView;
