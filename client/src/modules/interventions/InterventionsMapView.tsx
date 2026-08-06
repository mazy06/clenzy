import React from 'react';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
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
import MapWithSheet from '../../components/baitly/MapWithSheet';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { Intervention } from './useInterventionsList';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';
import { getStatusTokens, getPriorityTokens, getTypeTokens } from './interventionUtils';
import { stripPropertySuffix, getProgress } from './interventionsListConstants';

/** Report en classes de `LIST_PAPER_SX` (hairline, rayon xl, surface de carte). */
const LIST_SURFACE_CLS =
  'border border-solid border-border shadow-none rounded-xl bg-card';

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

  // Aucun marqueur : ni carte ni feuille, seulement l'explication.
  if (mapMarkers.length === 0) {
    return (
      <div className={cn(LIST_SURFACE_CLS, 'shrink-0 overflow-hidden p-0')}>
        <EmptyState
          variant="transparent"
          minHeight={400}
          icon={<Build />}
          title="Aucune intervention avec coordonnées GPS"
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
            if (marker.id) navigate(`/interventions/${marker.id}`);
          }}
          onBoundsChange={onBoundsChange}
        />
      }
      listTitle={`${viewportInterventions.length} ${viewportInterventions.length > 1 ? 'interventions' : 'intervention'} dans la zone visible`}
      emptyState={viewportInterventions.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={<LocationOn />}
          title="Aucune intervention dans cette zone"
          description="Déplacez ou dézoomez la carte."
        />
      ) : undefined}
    >
      {viewportInterventions.map((intervention) => {
                const statusTokens = getStatusTokens(intervention.status);
                const typeTokens = getTypeTokens(intervention.type);
                const priorityTokens = getPriorityTokens(intervention.priority);
                const progress = getProgress(intervention);
                return (
                  <Card
                    key={intervention.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'gap-0 py-0 p-[9px] cursor-pointer shrink-0',
                      'transition-colors duration-200 motion-reduce:transition-none',
                      'hover:bg-muted',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    onClick={() => navigate(`/interventions/${intervention.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/interventions/${intervention.id}`);
                      }
                    }}
                  >
                    {/* Le titre occupe sa PROPRE ligne, avant tout le reste.
                        Il partageait auparavant une rangee avec trois pastilles,
                        une barre de progression et le nom d'assigne, tous
                        incompressibles : des que les libelles s'allongeaient, le
                        titre — seule information qui identifie l'intervention —
                        etait ecrase jusqu'a disparaitre. */}
                    <div className="flex items-start gap-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-[13.5px] font-semibold text-foreground">
                          {stripPropertySuffix(intervention.title, intervention.propertyName)}
                        </p>
                        <div className="flex min-w-0 items-center gap-0.5">
                          <span className="inline-flex shrink-0 text-primary"><LocationOn size={13} strokeWidth={1.75} /></span>
                          <span className="truncate text-[11.5px] text-muted-foreground">
                            {intervention.propertyName} — {intervention.propertyAddress}
                          </span>
                        </div>

                        {/* Pastilles sous le titre, jamais en concurrence avec lui. */}
                        <div className="flex flex-wrap items-center gap-0.5">
                          <StatusChip tokens={{ color: typeTokens.color, bg: typeTokens.bg }} label={getInterventionTypeLabel(intervention.type, t)} className="text-[0.62rem]" />
                          <StatusChip tokens={{ color: statusTokens.color, bg: statusTokens.bg }} label={getInterventionStatusLabel(intervention.status, t)} className="text-[0.62rem]" />
                          <StatusChip tokens={{ color: priorityTokens.color, bg: priorityTokens.bg }} label={getInterventionPriorityLabel(intervention.priority, t)} className="text-[0.62rem]" />
                        </div>

                        {/* Progression + assigne : une ligne a part, la barre a
                            besoin d'une largeur reelle pour rester lisible. */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex min-w-[110px] flex-1 items-center gap-1">
                          {/* La teinte de la barre vit sur l'indicateur interne :
                              on la vise par son data-slot, en branches litterales
                              (une classe Tailwind ne naît pas d'une variable). */}
                          <Progress
                            value={progress}
                            className={cn(
                              'flex-1 h-[5px] rounded-full bg-muted',
                              '[&_[data-slot=progress-indicator]]:rounded-full',
                              progress === 100
                                ? '[&_[data-slot=progress-indicator]]:bg-success'
                                : progress >= 50
                                  ? '[&_[data-slot=progress-indicator]]:bg-info'
                                  : '[&_[data-slot=progress-indicator]]:bg-warning',
                            )}
                          />
                          <span className="text-[11px] font-semibold text-foreground min-w-[24px] tabular-nums">
                            {progress}%
                          </span>
                        </div>
                          {intervention.assignedToName && (
                            <span className="max-w-[45%] truncate text-[11.5px] text-muted-foreground">
                              {intervention.assignedToName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* L'action reste calee en haut a droite, hors du flux du
                          texte : elle ne doit jamais rogner le titre. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* Le span porte la ref que Radix pose : le kit n'en
                              transmet pas (React 18). */}
                          <span className="inline-flex shrink-0">
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
                  </Card>
                );
      })}
    </MapWithSheet>
  );
};

export default InterventionsMapView;
