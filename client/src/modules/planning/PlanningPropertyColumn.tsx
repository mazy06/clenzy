import React, { useCallback, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PropertyPopover from './PropertyPopover';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { PlanningProperty, DensityMode } from './types';

// Options de la requête performance — partagées entre le préchargement (survol)
// et la requête d'ouverture, source unique de la clé/queryFn.
const PERF_STALE_MS = 5 * 60 * 1000;
function perfQueryOptions(propertyId: number) {
  return {
    queryKey: ['property-performance', propertyId] as const,
    queryFn: () => propertiesApi.getPerformance(propertyId),
    staleTime: PERF_STALE_MS,
  };
}
import { Label as TagIcon, Wifi as ChannelIcon, ChevronDown } from '../../icons';
import type { ChannelSyncMap } from './hooks/usePlanningChannelSync';

// ─── Colonne logements (gauche, sticky) ──────────────────────────────────────
//
// Au clic sur le nom d'un logement → PropertyPopover (carte détaillée fusionnée :
// héro + type + adresse + propriétaire + stats + heures + fréquence ménage). Il
// n'y a plus de tooltip de survol séparé : tout est dans le popover au clic.
// Seul subsiste le petit tooltip de l'indicateur de sync canaux (wifi).

interface PlanningPropertyColumnProps {
  properties: PlanningProperty[];
  density: DensityMode;
  selectedPropertyId?: number | null;
  colWidth: number;
  /** Si fourni, affiche un drag handle sur le bord droit pour redimensionner. */
  onColWidthChange?: (width: number) => void;
  effectiveRowHeight: number;
  emptyRowCount?: number;
  reservationCountByProperty?: Map<number, number>;
  /** Nb de cartes HITL en attente par logement (pastille superviseur). */
  pendingCountByProperty?: Map<number, number>;
  channelSyncMap?: ChannelSyncMap;
  /** Superviseur d'agents : logement déployé (accordéon). */
  expandedPropertyId?: number | null;
  /** Si fourni, affiche un chevron d'accordéon par ligne. */
  onToggleExpanded?: (propertyId: number) => void;
  /** Hauteur du spacer inséré sous une ligne déployée (= hauteur accordéon). */
  accordionHeight?: number;
  /**
   * Repliée en rail (mobile) : les lignes gardent leur hauteur — l'alignement
   * avec la grille en dépend — mais perdent tout leur contenu et leurs gestes.
   */
  collapsed?: boolean;
}

const PlanningPropertyColumn: React.FC<PlanningPropertyColumnProps> = React.memo(({
  properties,
  density,
  selectedPropertyId,
  colWidth,
  onColWidthChange,
  effectiveRowHeight,
  emptyRowCount = 0,
  reservationCountByProperty,
  pendingCountByProperty,
  channelSyncMap,
  expandedPropertyId = null,
  onToggleExpanded,
  accordionHeight = 600,
  collapsed = false,
}) => {
  // ── Popover logement (maquette) : ouvert au clic sur le nom ──────────────
  const [popover, setPopover] = useState<{ anchorEl: HTMLElement; propertyId: number } | null>(null);
  const popoverProperty = popover
    ? properties.find((p) => p.id === popover.propertyId) ?? null
    : null;

  // Le parent orchestre la donnée du popover : il précharge au survol, récupère
  // la performance du logement ouvert, et ne monte le popover QUE lorsque tout
  // est prêt → PropertyPopover est présentationnel et rend tout en une fois.
  const queryClient = useQueryClient();
  const prefetchPerformance = useCallback((propertyId: number) => {
    queryClient.prefetchQuery(perfQueryOptions(propertyId));
  }, [queryClient]);

  const perfQuery = useQuery({
    ...perfQueryOptions(popover?.propertyId ?? 0),
    enabled: !!popover,
    retry: false,
  });
  // Prêt à afficher : logement trouvé ET (mode démo OU perf résolue). Avec le
  // préchargement au survol, la perf est déjà en cache → prêt instantanément.
  const perfReady = !!popover && perfQuery.isFetched;
  // ── Drag handle pour redimensionner la colonne ───────────────────────────
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onColWidthChange) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = { startX: e.clientX, startWidth: colWidth };
    setIsResizing(true);

    const handleMove = (ev: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = ev.clientX - start.startX;
      onColWidthChange(start.startWidth + delta);
    };

    const handleUp = () => {
      resizeStartRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidth, onColWidthChange]);


  return (
    <div className="sticky start-0 z-[10] shrink-0" style={{ width: colWidth, minWidth: colWidth }}>
      {/* Colonne visible (fond + bordure droite) bornée aux lignes de propriété :
          la séparation 2 colonnes s'arrête au dernier logement. position:relative
          → la poignée de resize (height:100%) est bornée à CETTE zone (les lignes)
          et NON à la hauteur totale — sinon sa ligne verte de hover/resig courait
          en pleine hauteur dans le vide (effet « 2 colonnes »). */}
      <div className="relative bg-[var(--card)] border-e border-[var(--line)]">
      {/* Drag handle pour redimensionner la colonne (bord droit).
          Hit-area de 6px, visuel discret sauf au hover/drag ; borné aux lignes. */}
      {onColWidthChange && (
        <div
          onMouseDown={handleResizeMouseDown}
          role="separator"
          aria-label="Redimensionner la colonne logements"
          aria-orientation="vertical"
          // right:-3px = chevauche legerement la grille pour faciliter la prise.
          // Ligne verticale (::after) visible uniquement au hover ou pendant le drag.
          className={cn(
            'absolute top-0 -right-[3px] w-[6px] h-full cursor-col-resize z-[11]',
            "after:content-[''] after:absolute after:top-0 after:left-[2px] after:w-[2px] after:h-full",
            'after:[transition:background-color_150ms_ease]',
            isResizing
              ? 'after:bg-[var(--accent)]'
              : 'after:bg-transparent hover:after:bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]',
          )}
        />
      )}
      {properties.map((property) => {
        const reservationCount = reservationCountByProperty?.get(property.id) ?? 0;
        const pendingCount = pendingCountByProperty?.get(property.id) ?? 0;
        const subtitle = property.city || property.address || '';
        const sync = channelSyncMap?.get(property.id);
        // Color du wifi : vert si tout sync, ambre si partiel, rouge si zero
        const syncColor = sync && sync.total > 0
          ? sync.synced === sync.total
            ? 'var(--ok)'
            : sync.synced > 0 ? 'var(--warn)' : 'var(--err)'
          : 'var(--faint)';
        // Repliée : une ligne nue, à la seule hauteur qu'exige l'alignement.
        if (collapsed) {
          return (
            <React.Fragment key={property.id}>
              <div
                className="bg-[var(--card)]"
                style={{ height: effectiveRowHeight, borderBottom: '1px solid var(--line)' }}
              />
              {expandedPropertyId === property.id && (
                <div
                  className="bg-[var(--bg)]"
                  style={{ height: accordionHeight, borderBottom: '1px solid var(--line)', width: 'calc(100% + 1px)' }}
                />
              )}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={property.id}>
          <div className={cn('relative flex flex-row items-center gap-0 px-0 cursor-pointer hover:bg-[var(--hover)]', selectedPropertyId === property.id || popover?.propertyId === property.id ? 'bg-[var(--accent-soft)]' : 'bg-[var(--card)]')} style={{ height: effectiveRowHeight, borderBottom: '1px solid var(--line)', transition: 'background-color 0.15s ease' }} onClick={(e) => setPopover({ anchorEl: e.currentTarget, propertyId: property.id })} onMouseEnter={() => prefetchPerformance(property.id)}>
            {/* Bloc texte (spec .pl-name : padding 0 16px, colonne centrée) :
                nom + ville dessous. Le count de reservations en cours reste
                visible en pastille discrete inline a cote du nom. */}
            <div className="flex-1 min-w-0 flex flex-col gap-[0.75px] px-4">
              <div className="flex items-center gap-1 min-w-0">
                {/* span nu (et non Typography) : evite l'heritage du variant
                    body1, dont les fontSize responsive du theme MUI peuvent
                    surcharger la taille en breakpoint large. */}
                {/* Spec .pl-name .nm : 12.5px fw600 var(--ink), 1 ligne ellipsis */}
                <span
                  className={cn(
                    'font-semibold text-[var(--ink)] leading-[1.25] tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis min-w-0',
                    density === 'compact' ? 'text-[11.5px]' : 'text-[12.5px]',
                  )}
                >
                  {property.name}
                </span>
                {/* Reservations en cours / a venir : pastille inline discrete */}
                {reservationCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 shrink-0 text-[var(--faint)]">
                    <TagIcon size={10} strokeWidth={1.75} />
                    <span className="text-[0.625rem] font-semibold leading-[1] tabular-nums">
                      {reservationCount}
                    </span>
                  </span>
                )}
                {/* Cartes HITL en attente : pastille ambre numérotée (attire l'œil) */}
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center shrink-0 min-w-[16px] h-[16px] px-1 rounded-[8px] bg-[var(--warn,_#A97C2E)] text-[#fff] text-[0.625rem] font-bold leading-[1] tabular-nums" aria-label={`${pendingCount} action(s) à valider`}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </div>
              {/* Spec .pl-name .ci : 10.5px var(--muted) */}
              {subtitle && (
                <span
                  className={cn(
                    'block font-normal text-[var(--muted)] leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap',
                    density === 'compact' ? 'text-[9.5px]' : 'text-[10.5px]',
                  )}
                >
                  {subtitle}
                </span>
              )}
            </div>
            {/* Chevron d'accordéon Superviseur (gated par le rôle côté parent) */}
            {onToggleExpanded && (
              <div className={cn('shrink-0 flex items-center justify-center w-[26px] h-[26px] me-2 rounded-[8px] cursor-pointer hover:bg-[var(--hover)] hover:text-[var(--accent)]', expandedPropertyId === property.id ? 'text-[var(--accent)]' : 'text-[var(--muted)]')} style={{ transform: expandedPropertyId === property.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease, color 0.15s, background-color 0.15s' }} role="button" aria-label="Superviseur d'agents" aria-expanded={expandedPropertyId === property.id} onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpanded(property.id);
                }}>
                <ChevronDown size={16} strokeWidth={2} />
              </div>
            )}
            {/* Indicateur en bas-droite : sync canaux (wifi) */}
            {sync && sync.total > 0 && (
              <div className="absolute end-[6px] bottom-[4px] flex items-center gap-1 pointer-events-none">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-[1.5px] pointer-events-auto" style={{ color: syncColor }}>
                      <ChannelIcon size={11} strokeWidth={1.75} />
                      <span className="text-[0.5625rem] font-semibold text-inherit leading-[1] tabular-nums">
                        {sync.synced}/{sync.total}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {`${sync.synced} sur ${sync.total} canaux synchronises (sync < 24h)`}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
          {/* Spacer d'alignement : compense la hauteur de l'accordéon côté grille.
              Fond = celui du tableau constellation À PLAT (fond de page) : le
              panneau (position:sticky, tiré à gauche par ml) met une frame à se
              caler, et ce spacer doit se fondre avec lui — l'ancienne base
              sombre du canvas deep-space laissait une bande nuit sous la
              colonne depuis le passage au registre produit. */}
          {expandedPropertyId === property.id && (
            // width +1px : le spacer RECOUVRE la bordure droite du conteneur
            // de colonne sur sa hauteur — le tableau constellation est une
            // surface continue, le filet « 2 colonnes » ne doit pas le couper.
            <div
              className="bg-[var(--bg)]"
              style={{ height: accordionHeight, borderBottom: '1px solid var(--line)', width: 'calc(100% + 1px)' }}
            />
          )}
          </React.Fragment>
        );
      })}
      </div>
      {/* Zone vide sous le dernier logement : transparente, SANS bordure droite
          → pas de « 2 colonnes », juste un espace vide (aligné sur la grille,
          dont les lignes de remplissage sont aussi transparentes). */}
      {Array.from({ length: emptyRowCount }, (_, i) => (
        <div className="bg-[transparent]" style={{ height: effectiveRowHeight }} key={`empty-${i}`} />
      ))}

      {/* Popover logement (clic sur le nom) — monté seulement quand la perf est
          prête → il s'affiche complet, en une fois (pas de rendu progressif). */}
      {popover && popoverProperty && perfReady && (
        <PropertyPopover
          anchorEl={popover.anchorEl}
          property={popoverProperty}
          performance={perfQuery.data ?? null}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
});

PlanningPropertyColumn.displayName = 'PlanningPropertyColumn';
export default PlanningPropertyColumn;
