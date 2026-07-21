import React, { useMemo, useState, useEffect } from 'react';
import { Box, Paper } from '@mui/material';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import PlanningDateHeaders from './PlanningDateHeaders';
import PlanningPropertyColumn from './PlanningPropertyColumn';
import PlanningRow from './PlanningRow';
import PlanningTodayLine from './PlanningTodayLine';
import PlanningBarGhost from './PlanningBarGhost';
// Tokens locaux de la grille (week-end clair/sombre) + animations d'urgence :
// importé ici pour garantir la présence des custom properties --pl-*-we dès
// le rendu des entêtes/cellules.
import './planningUrgency.css';
import type { PlanningProperty, PlanningEvent, BarLayout, DensityMode, ZoomLevel, QuickCreateData } from './types';
import type { AttachmentCandidate } from './utils/interventionAttachment';
import type { UsePlanningDragReturn } from './hooks/usePlanningDrag';
import type { PricingMap } from './hooks/usePlanningPricing';
import type { MinNightsMap } from './hooks/usePlanningMinNights';
import type { ChannelSyncMap } from './hooks/usePlanningChannelSync';
import { ROW_CONFIG, DATE_HEADER_HEIGHT } from './constants';
import { detectConflicts } from './utils/conflictUtils';
import { toDateStr } from './utils/dateUtils';

/** Hauteur de l'accordéon Superviseur (panneau constellation 560px + marge). */
const SUPERVISION_ACCORDION_HEIGHT = 600;

interface PlanningTimelineProps {
  properties: PlanningProperty[];
  days: Date[];
  dayWidth: number;
  density: DensityMode;
  zoom: ZoomLevel;
  getBarLayouts: (propertyId: number) => BarLayout[];
  totalGridWidth: number;
  selectedEventId: string | null;
  events: PlanningEvent[];
  /** Toutes les réservations chargées (non filtrées) — cf. PlanningRow. */
  loadedReservations: AttachmentCandidate[];
  drag: UsePlanningDragReturn;
  onEventClick: (event: PlanningEvent) => void;
  onHideEvent?: (event: PlanningEvent) => void;
  onEmptyClick: (data: QuickCreateData) => void;
  quickCreateOpen: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  propertyColWidth: number;
  onPropertyColWidthChange?: (width: number) => void;
  showPrices: boolean;
  showInterventions: boolean;
  pricingMap: PricingMap;
  minNightsMap?: MinNightsMap;
  channelSyncMap?: ChannelSyncMap;
  /** Nb de cartes HITL en attente par logement → pastille sur la cellule. */
  pendingCountByProperty?: Map<number, number>;
  pageSize?: number;
  /** Superviseur d'agents : logement déployé en accordéon (null = aucun). */
  expandedPropertyId?: number | null;
  /** Toggle du chevron d'accordéon (gated par le rôle côté parent). */
  onToggleExpanded?: (propertyId: number) => void;
  /** Rendu du panneau de supervision pour un logement déployé. */
  renderExpanded?: (property: PlanningProperty) => React.ReactNode;
}

const PlanningTimeline: React.FC<PlanningTimelineProps> = React.memo(({
  properties,
  days,
  dayWidth,
  density,
  zoom,
  getBarLayouts,
  totalGridWidth,
  selectedEventId,
  events,
  loadedReservations,
  drag,
  onEventClick,
  onHideEvent,
  onEmptyClick,
  quickCreateOpen,
  scrollRef,
  onScroll,
  propertyColWidth,
  onPropertyColWidthChange,
  showPrices,
  showInterventions,
  pricingMap,
  minNightsMap,
  channelSyncMap,
  pendingCountByProperty,
  pageSize,
  expandedPropertyId = null,
  onToggleExpanded,
  renderExpanded,
}) => {
  const config = ROW_CONFIG[density];

  // Dimensions du viewport (zone visible). La largeur cale le panneau
  // d'accordéon (sticky-left) ; la hauteur dimensionne ce panneau pour qu'il
  // remplisse EXACTEMENT l'espace restant → aucun débordement vertical, donc
  // pas de scroll vertical en conflit avec le scroll horizontal de la grille.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);
  // Plus de price line dediee : les prix sont desormais affiches dans
  // chaque cellule de jour, centres et masques sous les bars.
  // Hauteur de ligne CONSTANTE (maquette) : les interventions partagent la
  // bande verticale de la brique (plus de couloir dedie en dessous), masquer
  // les interventions ne change donc plus la hauteur (le filtre des events
  // est fait dans usePlanningFilters).
  const effectiveRowHeight = config.rowHeight;
  // Fill remaining space with empty rows. En mode accordéon déployé, le panneau
  // remplit la hauteur sous l'unique logement → pas de lignes vides parasites.
  const emptyRowCount =
    expandedPropertyId != null
      ? 0
      : pageSize
        ? Math.max(0, pageSize - properties.length)
        : 0;
  // Hauteur de l'accordéon = espace vertical restant (viewport − header dates − 1
  // ligne logement). Ainsi le contenu tient pile dans la zone visible : pas de
  // débordement → pas de scroll vertical (seul le scroll horizontal subsiste).
  const accordionHeight =
    viewport.height > 0
      ? Math.max(420, viewport.height - DATE_HEADER_HEIGHT - effectiveRowHeight - 2)
      : SUPERVISION_ACCORDION_HEIGHT;
  const totalDisplayRows = properties.length + emptyRowCount;
  const totalRowsHeight = totalDisplayRows * effectiveRowHeight;
  // Hauteur du today line : limitee aux lignes "vraies" (sans les empty
  // fillers de pagination). Le trait rouge s'arrete au bas du dernier logement.
  const todayLineHeight = properties.length * effectiveRowHeight;

  // Detect conflicts
  const conflictEventIds = useMemo(() => {
    const conflicts = detectConflicts(events);
    const ids = new Set<string>();
    for (const c of conflicts) {
      ids.add(c.eventA.id);
      ids.add(c.eventB.id);
    }
    return ids;
  }, [events]);

  // ── Découpage du dragState par ligne ──────────────────────────────────────
  // Seul un RESIZE affecte le rendu d'une ligne (largeur live de la brique) ;
  // le ghost du MOVE est rendu dans le DragOverlay global ci-dessous. On ne
  // passe donc à chaque PlanningRow qu'un objet minimal limité à SA ligne
  // (null sinon) : le memo des lignes non concernées tient pendant le drag.
  const resizingEventId =
    drag.state.activeType === 'resize' && drag.state.activeId
      ? drag.state.activeId.slice('resize-'.length)
      : null;
  const resizingPropertyId = useMemo(() => {
    if (resizingEventId == null) return null;
    return events.find((e) => e.id === resizingEventId)?.propertyId ?? null;
  }, [resizingEventId, events]);

  // Count UPCOMING reservations per property (for the small tag indicator
  // in the property column). Filtre les reservations passees (endDate < aujourd'hui)
  // et les interventions — seules les reservations en cours ou a venir.
  const reservationCountByProperty = useMemo(() => {
    const todayStr = toDateStr(new Date());
    const map = new Map<number, number>();
    for (const evt of events) {
      if (evt.type !== 'reservation') continue;
      if (evt.endDate < todayStr) continue;
      map.set(evt.propertyId, (map.get(evt.propertyId) ?? 0) + 1);
    }
    return map;
  }, [events]);

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        // Carte Signature : hairline + radius lg (maquette .pl-grid)
        backgroundColor: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <DndContext
        sensors={drag.sensors}
        modifiers={drag.modifiers}
        onDragStart={drag.handleDragStart}
        onDragMove={drag.handleDragMove}
        onDragEnd={drag.handleDragEnd}
        onDragCancel={drag.handleDragCancel}
      >
        <Box
          ref={scrollRef}
          onScroll={onScroll}
          sx={{
            flex: 1,
            overflowX: 'auto',
            // Jamais de scroll vertical : la grille paginée et l'accordéon (dont la
            // hauteur est calculée pour tenir dans le viewport) ne débordent pas.
            overflowY: 'hidden',
            position: 'relative',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',           // Firefox
            '&::-webkit-scrollbar': { display: 'none' },  // Chrome/Safari
          }}
        >
          {/* Scrollable content: headers + rows */}
          <Box sx={{ width: propertyColWidth + totalGridWidth, minWidth: '100%' }}>
            {/* Date headers (sticky top) */}
            <PlanningDateHeaders
              days={days}
              dayWidth={dayWidth}
              zoom={zoom}
              totalGridWidth={totalGridWidth}
              propertyColWidth={propertyColWidth}
              propertyCount={properties.length}
            />

            {/* Body: property column + grid rows */}
            <Box sx={{ display: 'flex', position: 'relative' }}>
              {/* Property column (sticky left) */}
              <PlanningPropertyColumn
                properties={properties}
                density={density}
                selectedPropertyId={null}
                colWidth={propertyColWidth}
                onColWidthChange={onPropertyColWidthChange}
                effectiveRowHeight={effectiveRowHeight}
                emptyRowCount={emptyRowCount}
                reservationCountByProperty={reservationCountByProperty}
                pendingCountByProperty={pendingCountByProperty}
                channelSyncMap={channelSyncMap}
                expandedPropertyId={expandedPropertyId}
                onToggleExpanded={onToggleExpanded}
                accordionHeight={accordionHeight}
              />

              {/* Grid rows */}
              <Box sx={{ position: 'relative', width: totalGridWidth, flexShrink: 0 }}>
                {/* Today line spanning all rows */}
                <PlanningTodayLine
                  days={days}
                  dayWidth={dayWidth}
                  totalHeight={todayLineHeight}
                />

                {/* Property rows (+ accordéon Superviseur déployé sous la ligne) */}
                {properties.map((property, idx) => (
                  <React.Fragment key={property.id}>
                    <PlanningRow
                      property={property}
                      barLayouts={getBarLayouts(property.id)}
                      days={days}
                      dayWidth={dayWidth}
                      density={density}
                      zoom={zoom}
                      totalGridWidth={totalGridWidth}
                      rowIndex={idx}
                      selectedEventId={selectedEventId}
                      conflictEventIds={conflictEventIds}
                      isDragging={drag.state.isDragging}
                      rowDrag={
                        resizingPropertyId === property.id && drag.state.activeId && drag.state.ghostLayout
                          ? {
                              activeId: drag.state.activeId,
                              ghostWidth: drag.state.ghostLayout.width,
                              conflict: drag.state.dragConflict,
                            }
                          : null
                      }
                      onEventClick={onEventClick}
                      onHideEvent={onHideEvent}
                      onEmptyClick={onEmptyClick}
                      quickCreateOpen={quickCreateOpen}
                      showPrices={showPrices}
                      showInterventions={showInterventions}
                      pricingMap={pricingMap}
                      minNightsMap={minNightsMap}
                      effectiveRowHeight={effectiveRowHeight}
                      allEvents={events}
                      loadedReservations={loadedReservations}
                    />
                    {expandedPropertyId === property.id && renderExpanded && (
                      <Box
                        sx={{
                          position: 'relative',
                          width: totalGridWidth,
                          height: accordionHeight,
                          borderBottom: '1px solid var(--line)',
                          backgroundColor: 'var(--bg)',
                          // PAS de fondu d'opacité ici : le panneau interne (sticky, tiré à
                          // gauche par ml) est OPAQUE dès la 1re frame → il couvre le spacer
                          // sombre côté colonne instantanément. Un fondu rendait la
                          // constellation semi-transparente 260ms et laissait voir le spacer
                          // (bloc sombre qui « s'affichait et se fermait »). Ni overflow:hidden
                          // ni transform ici (casseraient le sticky du panneau).
                        }}
                      >
                        {/* Panneau calé sur le viewport (sticky-left) + tiré sous la
                            colonne sticky (ml négatif) → plein largeur, ne défile pas. */}
                        <Box
                          sx={{
                            position: 'sticky',
                            left: 0,
                            ml: `-${propertyColWidth}px`,
                            width: viewport.width || '100%',
                            height: '100%',
                            zIndex: 11,
                            // Pas de padding : le canvas sombre (flush) couvre TOUT
                            // l'accordéon, sans espace vide autour.
                            p: 0,
                            boxSizing: 'border-box',
                          }}
                        >
                          {renderExpanded(property)}
                        </Box>
                      </Box>
                    )}
                  </React.Fragment>
                ))}

                {/* Empty filler rows to fill remaining space — fond plat
                    (spec : pas de zebra) */}
                {Array.from({ length: emptyRowCount }, (_, i) => (
                  <Box
                    key={`empty-grid-${i}`}
                    sx={{
                      height: effectiveRowHeight,
                      width: totalGridWidth,
                      backgroundColor: 'transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Drag ghost overlay — only for move, resize uses live width on the bar */}
        <DragOverlay dropAnimation={null}>
          {drag.state.activeType === 'move' && drag.state.ghostLayout && (
            <PlanningBarGhost
              layout={drag.state.ghostLayout}
              isConflict={drag.state.dragConflict}
            />
          )}
        </DragOverlay>
      </DndContext>
    </Paper>
  );
});

PlanningTimeline.displayName = 'PlanningTimeline';
export default PlanningTimeline;
