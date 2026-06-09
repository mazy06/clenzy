import React from 'react';
import { Box, Paper, Typography, Chip, Tooltip, IconButton, LinearProgress } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Build, LocationOn, Visibility as VisibilityIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { Intervention } from './useInterventionsList';
import {
  getInterventionStatusLabel,
  getInterventionStatusHex,
  getInterventionPriorityLabel,
  getInterventionPriorityHex,
  getInterventionTypeLabel,
  getInterventionTypeHex,
} from '../../utils/statusUtils';
import { LIST_PAPER_SX, stripPropertySuffix, getProgress } from './interventionsListConstants';

interface InterventionsMapViewProps {
  mapMarkers: PropertyMarker[];
  viewportInterventions: Intervention[];
  onBoundsChange: (bounds: MapBounds) => void;
  navigate: NavigateFunction;
}

/** Vue carte : carte fixe en haut + liste scrollable des interventions du viewport. */
const InterventionsMapView: React.FC<InterventionsMapViewProps> = ({
  mapMarkers, viewportInterventions, onBoundsChange, navigate,
}) => {
  const { t } = useTranslation();

  return (
    /* ─── Vue carte (sticky) + liste viewport (scrollable) ─── */
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Carte fixe en haut */}
      <Paper sx={{ ...LIST_PAPER_SX, p: 0, overflow: 'hidden', flexShrink: 0 }}>
        {mapMarkers.length > 0 ? (
          <MapboxPropertyMap
            properties={mapMarkers}
            height={400}
            onMarkerClick={(marker) => {
              if (marker.id) navigate(`/interventions/${marker.id}`);
            }}
            onBoundsChange={onBoundsChange}
          />
        ) : (
          <Box sx={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: "inline-flex", color: "text.secondary", opacity: 0.5 }}><Build size={36} strokeWidth={1.5} /></Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Aucune intervention avec coordonnées GPS
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Liste scrollable en dessous */}
      {mapMarkers.length > 0 && (
        <Box sx={{ mt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}
          >
            {viewportInterventions.length} {viewportInterventions.length > 1 ? 'interventions' : 'intervention'} dans la zone visible
          </Typography>

          {viewportInterventions.length === 0 ? (
            <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                Aucune intervention dans cette zone. Déplacez ou dézoomez la carte.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>
              {viewportInterventions.map((intervention) => {
                const statusColor = getInterventionStatusHex(intervention.status);
                const typeColor = getInterventionTypeHex(intervention.type);
                const priorityColor = getInterventionPriorityHex(intervention.priority);
                return (
                  <Paper
                    key={intervention.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: 'none',
                      borderRadius: 1.5,
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => navigate(`/interventions/${intervention.id}`)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {/* Titre + adresse */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {stripPropertySuffix(intervention.title, intervention.propertyName)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <Box component="span" sx={{ display: "inline-flex", color: "text.secondary", flexShrink: 0 }}><LocationOn size={13} strokeWidth={1.75} /></Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {intervention.propertyName} — {intervention.propertyAddress}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Type + Statut + Priorité chips */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Chip
                          label={getInterventionTypeLabel(intervention.type, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${typeColor}18`,
                            color: typeColor,
                            border: `1px solid ${typeColor}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.62rem',
                            height: 22,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        <Chip
                          label={getInterventionStatusLabel(intervention.status, t)}
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
                          label={getInterventionPriorityLabel(intervention.priority, t)}
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
                      </Box>

                      {/* Progression + Assigné + Action */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 70 }}>
                          <LinearProgress
                            variant="determinate"
                            value={getProgress(intervention)}
                            sx={{
                              flex: 1,
                              height: 5,
                              borderRadius: 3,
                              bgcolor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                bgcolor: getProgress(intervention) === 100 ? 'success.main'
                                  : getProgress(intervention) >= 50 ? 'info.main' : 'warning.main',
                              },
                            }}
                          />
                          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.68rem', minWidth: 24 }}>
                            {getProgress(intervention)}%
                          </Typography>
                        </Box>
                        {intervention.assignedToName && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {intervention.assignedToName}
                          </Typography>
                        )}
                        <Tooltip title="Détails">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                            sx={{ p: 0.5 }}
                          >
                            <VisibilityIcon size={16} strokeWidth={1.75} />
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

export default InterventionsMapView;
