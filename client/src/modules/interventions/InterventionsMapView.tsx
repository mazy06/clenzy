import React from 'react';
import StatusChip from '../../components/StatusChip';
import {
  Card,
  Button,
  Progress,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../components/ui';
import { cn } from '../../utils/cn';
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
import { stripPropertySuffix, getProgress } from './interventionsListConstants';

/** Report en classes de `LIST_PAPER_SX` (hairline plate r14). */
const LIST_SURFACE_CLS =
  'border border-solid border-[var(--line)] shadow-none rounded-[14px] bg-[var(--card)]';

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
      <div className={cn(LIST_SURFACE_CLS, 'p-0 overflow-hidden shrink-0')}>
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
      </div>

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
                const progress = getProgress(intervention);
                return (
                  <div
                    key={intervention.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      LIST_SURFACE_CLS,
                      'p-[9px] cursor-pointer shrink-0',
                      'transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none',
                      'hover:border-[var(--line-2)] hover:shadow-[var(--shadow-card)]',
                    )}
                    onClick={() => navigate(`/interventions/${intervention.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/interventions/${intervention.id}`);
                      }
                    }}
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
                        <StatusChip tokens={{ color: typeTokens.color, bg: typeTokens.bg }} label={getInterventionTypeLabel(intervention.type, t)} className="text-[0.62rem]" />
                        <StatusChip tokens={{ color: statusTokens.color, bg: statusTokens.bg }} label={getInterventionStatusLabel(intervention.status, t)} className="text-[0.62rem]" />
                        <StatusChip tokens={{ color: priorityTokens.color, bg: priorityTokens.bg }} label={getInterventionPriorityLabel(intervention.priority, t)} className="text-[0.62rem]" />
                      </div>

                      {/* Progression + Assigné + Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 min-w-[70px]">
                          {/* La teinte de la barre vit sur l'indicateur interne :
                              on la vise par son data-slot, en branches litterales
                              (une classe Tailwind ne naît pas d'une variable). */}
                          <Progress
                            value={progress}
                            className={cn(
                              'flex-1 h-[5px] rounded-[24px] bg-[var(--hover)]',
                              '[&_[data-slot=progress-indicator]]:rounded-[24px]',
                              progress === 100
                                ? '[&_[data-slot=progress-indicator]]:bg-[var(--ok)]'
                                : progress >= 50
                                  ? '[&_[data-slot=progress-indicator]]:bg-[var(--info)]'
                                  : '[&_[data-slot=progress-indicator]]:bg-[var(--warn)]',
                            )}
                          />
                          <span className="cn-text-caption font-semibold text-[0.68rem] min-w-[24px] tabular-nums">
                            {progress}%
                          </span>
                        </div>
                        {intervention.assignedToName && (
                          <span className="cn-text-caption text-muted-foreground text-[0.72rem] max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap">
                            {intervention.assignedToName}
                          </span>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* Le span porte la ref que Radix pose : le kit n'en
                                transmet pas (React 18). */}
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Détails"
                                onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                              >
                                <VisibilityIcon size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Détails</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
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
