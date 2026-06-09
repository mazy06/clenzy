import React from 'react';
import { Box, Paper, Typography, Chip, Tooltip, IconButton } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, LocationOn, Build as BuildIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { ServiceRequest } from './serviceRequestsUtils';
import {
  getServiceRequestStatusLabel,
  getServiceRequestStatusHex,
  getServiceRequestPriorityLabel,
  getServiceRequestPriorityHex,
} from '../../utils/statusUtils';
import { stripPropertySuffix } from './serviceRequestDisplayMapper';
import { LIST_PAPER_SX } from './serviceRequestsListConstants';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
          <Box sx={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: "inline-flex", color: "text.secondary", opacity: 0.5 }}><BuildIcon size={36} strokeWidth={1.5} /></Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Aucune demande avec coordonnées GPS
            </Typography>
          </Box>
        )}
      </Paper>

      {mapMarkers.length > 0 && (
        <Box sx={{ mt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}
          >
            {viewportRequests.length} {viewportRequests.length > 1 ? 'demandes' : 'demande'} dans la zone visible
          </Typography>

          {viewportRequests.length === 0 ? (
            <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                Aucune demande dans cette zone. Déplacez ou dézoomez la carte.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>
              {viewportRequests.map((request) => {
                const statusColor = getServiceRequestStatusHex(request.status);
                const priorityColor = getServiceRequestPriorityHex(request.priority);
                return (
                  <Paper
                    key={request.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: 'none',
                      borderRadius: 1.5,
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                    }}
                    onClick={() => navigate(`/service-requests/${request.id}`)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {stripPropertySuffix(request.title, request.propertyName)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <Box component="span" sx={{ display: "inline-flex", color: "text.secondary", flexShrink: 0 }}><LocationOn size={13} strokeWidth={1.75} /></Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {request.propertyName} — {request.propertyAddress}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Chip
                          label={getServiceRequestStatusLabel(request.status, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${statusColor}18`,
                            color: statusColor,
                            border: `1px solid ${statusColor}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.62rem',
                            height: 22,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        <Chip
                          label={getServiceRequestPriorityLabel(request.priority, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${priorityColor}18`,
                            color: priorityColor,
                            border: `1px solid ${priorityColor}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.62rem',
                            height: 22,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        {request.assignedToName && (
                          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', ml: 0.5 }}>
                            {request.assignedToName}
                          </Typography>
                        )}
                        <Tooltip title="Voir">
                          <IconButton size="small" sx={{ ml: 0.5 }}>
                            <Visibility size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ServiceRequestsMapView;
