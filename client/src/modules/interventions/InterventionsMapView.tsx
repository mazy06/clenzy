import React from 'react';
import { Card } from '../../components/ui';
import { Paper, Chip, Tooltip, IconButton, LinearProgress } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Build, LocationOn, Visibility as VisibilityIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { Intervention } from './useInterventionsList';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';
import { getStatusTokens, getPriorityTokens, getTypeTokens } from './interventionUtils';
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
    <div className="flex flex-col flex-1 min-h-0">
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
          <div className="h-[400px] flex flex-col items-center justify-center gap-1.5">
            <span className="inline-flex text-muted-foreground opacity-50"><Build size={36} strokeWidth={1.5} /></span>
            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
              Aucune intervention avec coordonnées GPS
            </p>
          </div>
        )}
      </Paper>

      {/* Liste scrollable en dessous */}
      {mapMarkers.length > 0 && (
        <div className="mt-2 flex-1 min-h-0 flex flex-col">
          <h6 className="cn-text-subtitle2 mb-1.5 text-[0.8125rem] font-semibold text-muted-foreground shrink-0">
            {viewportInterventions.length} {viewportInterventions.length > 1 ? 'interventions' : 'intervention'} dans la zone visible
          </h6>

          {viewportInterventions.length === 0 ? (
            <Card className="gap-0 py-0 border-[var(--line)] p-3 text-center">
              <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
                Aucune intervention dans cette zone. Déplacez ou dézoomez la carte.
              </p>
            </Card>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pe-0.5">
              {viewportInterventions.map((intervention) => {
                const statusTokens = getStatusTokens(intervention.status);
                const typeTokens = getTypeTokens(intervention.type);
                const priorityTokens = getPriorityTokens(intervention.priority);
                return (
                  <Paper
                    key={intervention.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'var(--line)',
                      boxShadow: 'none',
                      borderRadius: '14px',
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'border-color .15s, box-shadow .15s',
                      flexShrink: 0,
                      '&:hover': {
                        borderColor: 'var(--line-2)',
                        boxShadow: 'var(--shadow-card)',
                      },
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    }}
                    onClick={() => navigate(`/interventions/${intervention.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Titre + adresse */}
                      <div className="flex-1 min-w-0">
                        <p className="cn-text-body2 font-semibold text-[0.84rem] overflow-hidden text-ellipsis whitespace-nowrap">
                          {stripPropertySuffix(intervention.title, intervention.propertyName)}
                        </p>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <span className="inline-flex text-muted-foreground shrink-0"><LocationOn size={13} strokeWidth={1.75} /></span>
                          <span className="cn-text-caption text-muted-foreground text-[0.72rem] overflow-hidden text-ellipsis whitespace-nowrap">
                            {intervention.propertyName} — {intervention.propertyAddress}
                          </span>
                        </div>
                      </div>

                      {/* Type + Statut + Priorité chips */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Chip
                          label={getInterventionTypeLabel(intervention.type, t)}
                          size="small"
                          sx={{
                            backgroundColor: typeTokens.bg,
                            color: typeTokens.color,
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
                            backgroundColor: statusTokens.bg,
                            color: statusTokens.color,
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
                            backgroundColor: priorityTokens.bg,
                            color: priorityTokens.color,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.62rem',
                            height: 22,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      </div>

                      {/* Progression + Assigné + Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 min-w-[70px]">
                          <LinearProgress
                            variant="determinate"
                            value={getProgress(intervention)}
                            sx={{
                              flex: 1,
                              height: 5,
                              borderRadius: 3,
                              bgcolor: 'var(--hover)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                bgcolor: getProgress(intervention) === 100 ? 'var(--ok)'
                                  : getProgress(intervention) >= 50 ? 'var(--info)' : 'var(--warn)',
                              },
                            }}
                          />
                          <span className="cn-text-caption font-semibold text-[0.68rem] min-w-[24px] tabular-nums">
                            {getProgress(intervention)}%
                          </span>
                        </div>
                        {intervention.assignedToName && (
                          <span className="cn-text-caption text-muted-foreground text-[0.72rem] max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap">
                            {intervention.assignedToName}
                          </span>
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
                      </div>
                    </div>
                  </Paper>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InterventionsMapView;
