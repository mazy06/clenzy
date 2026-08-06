import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { Button, Card, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, LocationOn, Build as BuildIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import MapWithSheet from '../../components/baitly/MapWithSheet';
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

  // Aucun marqueur : ni carte ni feuille, seulement l'explication.
  if (mapMarkers.length === 0) {
    return (
      <div className={cn(LIST_SURFACE_CLASS, 'shrink-0 overflow-hidden p-0')}>
        <EmptyState
          variant="transparent"
          minHeight={400}
          icon={<BuildIcon />}
          title="Aucune demande avec coordonnées GPS"
          description="Renseignez l'adresse des logements concernés pour les voir apparaître sur la carte."
        />
      </div>
    );
  }

  return (
    <MapWithSheet
      map={
        <MapboxPropertyMap
          properties={mapMarkers}
          height="100%"
          onMarkerClick={(marker) => {
            if (marker.id) navigate(`/service-requests/${marker.id}`);
          }}
          onBoundsChange={onBoundsChange}
        />
      }
      listTitle={`${viewportRequests.length} ${viewportRequests.length > 1 ? 'demandes' : 'demande'} dans la zone visible`}
      emptyState={viewportRequests.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={<LocationOn />}
          title="Aucune demande dans cette zone"
          description="Déplacez ou dézoomez la carte."
        />
      ) : undefined}
    >
      {viewportRequests.map((request) => {
                // Le titre passe AVANT tout le reste et occupe sa propre ligne.
                // Il partageait auparavant une rangee avec les pastilles : le
                // bloc de titre etait en `flex-1 min-w-0` face a un bloc de
                // pastilles qui, lui, ne se comprimait pas. Des que les libelles
                // s'allongeaient (« En attente de paiement », « Equipe Entretien
                // - Paris »), le titre tombait a « M… », voire disparaissait —
                // alors que c'est la seule information qui identifie la demande.
                return (
                  <Card className="gap-0 py-0 bg-card p-2 cursor-pointer transition-colors duration-200 shrink-0 hover:bg-muted" key={request.id} onClick={() => navigate(`/service-requests/${request.id}`)}>
                    <div className="flex items-start gap-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-[13.5px] font-semibold text-foreground">
                          {stripPropertySuffix(request.title, request.propertyName)}
                        </p>
                        <div className="flex min-w-0 items-center gap-0.5">
                          <span className="inline-flex shrink-0 text-primary"><LocationOn size={13} strokeWidth={1.75} /></span>
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            {request.propertyName} — {request.propertyAddress}
                          </p>
                        </div>
                        {/* Pastilles sous le titre, jamais en concurrence avec lui.
                            Le nom d'assigne se tronque au lieu de pousser. */}
                        <div className="flex flex-wrap items-center gap-0.5">
                          <StatusChip pill tokens={srStatusTokens(request.status)} label={getServiceRequestStatusLabel(request.status, t)} />
                          <StatusChip pill tokens={srPriorityTokens(request.priority)} label={getServiceRequestPriorityLabel(request.priority, t)} />
                          {request.assignedToName && (
                            <p className="ms-0.5 max-w-[45%] truncate text-[11.5px] text-muted-foreground">
                              {request.assignedToName}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* L'action reste calee en haut a droite, hors du flux du
                          texte : elle ne doit jamais rogner le titre. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex shrink-0">
                            {/* Sans onClick : le clic remonte a la carte, qui navigue. */}
                            <Button variant="ghost" size="icon-sm" aria-label="Voir">
                              <Visibility size={16} strokeWidth={1.75} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Voir</TooltipContent>
                      </Tooltip>
                    </div>
                  </Card>
                );
      })}
    </MapWithSheet>
  );
};

export default ServiceRequestsMapView;
