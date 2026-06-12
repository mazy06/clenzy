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
  getServiceRequestPriorityLabel,
} from '../../utils/statusUtils';
import { stripPropertySuffix } from './serviceRequestDisplayMapper';
import { LIST_PAPER_SX, srStatusChipSx, srPriorityChipSx } from './serviceRequestsListConstants';

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
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}><BuildIcon size={36} strokeWidth={1.5} /></Box>
            <Typography sx={{ fontSize: '13px', color: 'var(--muted)' }}>
              Aucune demande avec coordonnées GPS
            </Typography>
          </Box>
        )}
      </Paper>

      {mapMarkers.length > 0 && (
        <Box sx={{ mt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography
            sx={{
              mb: 1, flexShrink: 0,
              fontSize: '10.5px', fontWeight: 700, letterSpacing: '.05em',
              textTransform: 'uppercase', color: 'var(--faint)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {viewportRequests.length} {viewportRequests.length > 1 ? 'demandes' : 'demande'} dans la zone visible
          </Typography>

          {viewportRequests.length === 0 ? (
            <Paper sx={{ ...LIST_PAPER_SX, p: 2, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '13px', color: 'var(--muted)' }}>
                Aucune demande dans cette zone. Déplacez ou dézoomez la carte.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>
              {viewportRequests.map((request) => {
                return (
                  <Paper
                    key={request.id}
                    sx={{
                      border: '1px solid var(--line)',
                      bgcolor: 'var(--card)',
                      boxShadow: 'none',
                      borderRadius: '14px',
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'border-color .15s, background-color .15s',
                      flexShrink: 0,
                      '&:hover': { borderColor: 'var(--line-2)', bgcolor: 'var(--hover)' },
                    }}
                    onClick={() => navigate(`/service-requests/${request.id}`)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {stripPropertySuffix(request.title, request.propertyName)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', flexShrink: 0 }}><LocationOn size={13} strokeWidth={1.75} /></Box>
                          <Typography
                            sx={{ fontSize: '11.5px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {request.propertyName} — {request.propertyAddress}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Chip
                          label={getServiceRequestStatusLabel(request.status, t)}
                          size="small"
                          sx={srStatusChipSx(request.status)}
                        />
                        <Chip
                          label={getServiceRequestPriorityLabel(request.priority, t)}
                          size="small"
                          sx={srPriorityChipSx(request.priority)}
                        />
                        {request.assignedToName && (
                          <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', ml: 0.5 }}>
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
