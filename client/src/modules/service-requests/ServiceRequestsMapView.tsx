import React from 'react';
import StatusChip from '../../components/StatusChip';
import { Card } from '../../components/ui';
import { Paper, Tooltip, IconButton } from '@mui/material';
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
import { LIST_PAPER_SX, srStatusTokens, srPriorityTokens } from './serviceRequestsListConstants';

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
      <Paper sx={{ ...LIST_PAPER_SX, p: 0, overflow: 'hidden', flexShrink: 0 }}>
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
          <div className="h-[400px] flex flex-col items-center justify-center gap-1.5">
            <span className="inline-flex text-[var(--faint)]"><BuildIcon size={36} strokeWidth={1.5} /></span>
            <p className="cn-text-body1 text-[13px] text-[var(--muted)]">
              Aucune demande avec coordonnées GPS
            </p>
          </div>
        )}
      </Paper>

      {mapMarkers.length > 0 && (
        <div className="mt-2 flex-1 min-h-0 flex flex-col">
          <p className="cn-text-body1 mb-1.5 shrink-0 text-[10.5px] font-bold tracking-[.05em] uppercase text-[var(--faint)] tabular-nums">
            {viewportRequests.length} {viewportRequests.length > 1 ? 'demandes' : 'demande'} dans la zone visible
          </p>

          {viewportRequests.length === 0 ? (
            <Paper sx={{ ...LIST_PAPER_SX, p: 2, textAlign: 'center' }}>
              <p className="cn-text-body1 text-[13px] text-[var(--muted)]">
                Aucune demande dans cette zone. Déplacez ou dézoomez la carte.
              </p>
            </Paper>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pe-0.5">
              {viewportRequests.map((request) => {
                return (
                  <Card className="gap-0 py-0 bg-[var(--card)] p-2 cursor-pointer transition-colors duration-200 shrink-0 hover:border-[var(--line-2)] hover:bg-[var(--hover)]" key={request.id} onClick={() => navigate(`/service-requests/${request.id}`)}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)] overflow-hidden text-ellipsis whitespace-nowrap">
                          {stripPropertySuffix(request.title, request.propertyName)}
                        </p>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <span className="inline-flex text-[var(--accent)] shrink-0"><LocationOn size={13} strokeWidth={1.75} /></span>
                          <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                            {request.propertyName} — {request.propertyAddress}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <StatusChip pill tokens={srStatusTokens(request.status)} label={getServiceRequestStatusLabel(request.status, t)} />
                        <StatusChip pill tokens={srPriorityTokens(request.priority)} label={getServiceRequestPriorityLabel(request.priority, t)} />
                        {request.assignedToName && (
                          <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] ms-0.5">
                            {request.assignedToName}
                          </p>
                        )}
                        <Tooltip title="Voir">
                          <IconButton size="small" sx={{ ml: 0.5 }}>
                            <Visibility size={16} strokeWidth={1.75} />
                          </IconButton>
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
