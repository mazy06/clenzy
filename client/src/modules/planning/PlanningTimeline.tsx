import React, { useMemo } from 'react';
import { useBaitlyPlanningViewport } from './hooks/useBaitlyPlanningViewport';
import { Card } from '../../components/ui';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import PlanningDateHeaders from './PlanningDateHeaders';
import PlanningPropertyColumn from './PlanningPropertyColumn';
import PlanningRow from './PlanningRow';
import PlanningTodayLine from './PlanningTodayLine';
import PlanningBarGhost from './PlanningBarGhost';
import PlanningOccupancyRow from './PlanningOccupancyRow';
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
import { ROW_CONFIG, DATE_HEADER_HEIGHT, OCCUPANCY_ROW_HEIGHT } from './constants';
import { detectBaitlyConflictEventIds } from './utils/conflictUtils';
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
  allEvents?: PlanningEvent[];
  /**
   * Toutes les réservations chargées (NON filtrées) — cf. PlanningRow : elles
   * servent à rattacher chaque intervention à son séjour, y compris quand ce
   * séjour est masqué par la légende. Une intervention dont l'hôte n'est pas
   * rendu redevient autonome plutôt que de disparaître.
   */
  loadedReservations: AttachmentCandidate[];
  drag: UsePlanningDragReturn;
  onEventClick: (event: PlanningEvent) => void;
  onHideEvent?: (event: PlanningEvent) => void;
  /** Débloque une plage — `to` est EXCLUSIVE. Absent = action non proposée. */
  onUnblock?: (propertyId: number, from: string, to: string) => Promise<void>;
  onEmptyClick: (data: QuickCreateData) => void;
  quickCreateOpen: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  propertyColWidth: number;
  onPropertyColWidthChange?: (width: number) => void;
  /** Colonne logements repliee en rail (mobile). */
  propertyColCollapsed?: boolean;
  /** Fourni en mobile seulement : l'en-tete de la colonne devient l'interrupteur. */
  onTogglePropertyCol?: () => void;
  showPrices: boolean;
  showInterventions: boolean;
  pricingMap: PricingMap;
  minNightsMap?: MinNightsMap;
  channelSyncMap?: ChannelSyncMap;
  /** Nb de cartes HITL en attente par logement → pastille sur la cellule. */
  pendingCountByProperty?: Map<number, number>;
  pageSize?: number;
  /** Occupation par jour (alignée sur `days`) — rangée pied de grille, absente = masquée. */
  dayOccupancy?: number[];
  dayOccupiedCounts?: number[];
  occupancyPropertyCount?: number;
  /** Superviseur d'agents : logement déployé en accordéon (null = aucun). */
  expandedPropertyId?: number | null;
  /** Toggle du chevron d'accordéon (gated par le rôle côté parent). */
  onToggleExpanded?: (propertyId: number) => void;
  /** Rendu du panneau de supervision pour un logement déployé. */
  renderExpanded?: (property: PlanningProperty) => React.ReactNode;
  /**
   * Hauteur mesurée de la boîte de la grille, publiée au parent : c'est elle
   * qui decide combien de logements tiennent dans une page (cf.
   * usePlanningPagination). La mesure existe deja ici pour l'accordeon — la
   * refaire dans la page donnerait deux observateurs et deux verites.
   */
  onViewportHeight?: (height: number) => void;
}

const EMPTY_EVENTS: PlanningEvent[] = [];
const EMPTY_RESERVATIONS: AttachmentCandidate[] = [];

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
  allEvents = events,
  loadedReservations,
  drag,
  onEventClick,
  onHideEvent,
  onUnblock,
  onEmptyClick,
  quickCreateOpen,
  scrollRef,
  onScroll,
  propertyColWidth,
  onPropertyColWidthChange,
  propertyColCollapsed = false,
  onTogglePropertyCol,
  showPrices,
  showInterventions,
  pricingMap,
  minNightsMap,
  channelSyncMap,
  pendingCountByProperty,
  pageSize,
  dayOccupancy,
  dayOccupiedCounts,
  occupancyPropertyCount,
  expandedPropertyId = null,
  onToggleExpanded,
  renderExpanded,
  onViewportHeight,
}) => {
  const config = ROW_CONFIG[density];

  // Dimensions du viewport (zone visible). La largeur cale le panneau
  // d'accordéon (sticky-left) ; la hauteur dimensionne ce panneau pour qu'il
  // remplisse EXACTEMENT l'espace restant → aucun débordement vertical, donc
  // pas de scroll vertical en conflit avec le scroll horizontal de la grille.
  const viewport = useBaitlyPlanningViewport(scrollRef, onViewportHeight);

  // Plus de price line dediee : les prix sont desormais affiches dans
  // chaque cellule de jour, centres et masques sous les bars.
  // Hauteur de ligne CONSTANTE (maquette) : les interventions partagent la
  // bande verticale de la brique (plus de couloir dedie en dessous), masquer
  // les interventions ne change donc plus la hauteur (le filtre des events
  // est fait dans usePlanningFilters).
  const effectiveRowHeight = config.rowHeight;
  // La synthèse suit les logements réels, sans lignes vides intercalées.
  const emptyRowCount = 0;
  // Hauteur de l'accordéon = espace vertical restant (viewport − header dates − 1
  // ligne logement). Ainsi le contenu tient pile dans la zone visible : pas de
  // débordement → pas de scroll vertical (seul le scroll horizontal subsiste).
  const accordionHeight =
    viewport.height > 0
      ? Math.max(0, viewport.height - DATE_HEADER_HEIGHT - effectiveRowHeight - (dayOccupancy ? OCCUPANCY_ROW_HEIGHT : 0) - 2)
      : SUPERVISION_ACCORDION_HEIGHT;
  const totalDisplayRows = properties.length + emptyRowCount;
  const totalRowsHeight = totalDisplayRows * effectiveRowHeight;
  // Hauteur du today line : limitee aux lignes "vraies" (sans les empty
  // fillers de pagination). Le trait rouge s'arrete au bas du dernier logement.
  const todayLineHeight = properties.length * effectiveRowHeight;

  // Detect conflicts
  const conflictEventIds = useMemo(() => detectBaitlyConflictEventIds(allEvents), [allEvents]);

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

  const eventsByProperty = useMemo(() => {
    const grouped = new Map<number, PlanningEvent[]>();
    for (const event of allEvents) {
      const list = grouped.get(event.propertyId) ?? [];
      list.push(event);
      grouped.set(event.propertyId, list);
    }
    return grouped;
  }, [allEvents]);
  const reservationsByProperty = useMemo(() => {
    const grouped = new Map<number, AttachmentCandidate[]>();
    for (const reservation of loadedReservations) {
      const list = grouped.get(reservation.propertyId) ?? [];
      list.push(reservation);
      grouped.set(reservation.propertyId, list);
    }
    return grouped;
  }, [loadedReservations]);

  // Count UPCOMING reservations per property (for the small tag indicator
  // in the property column). Filtre les reservations passees (endDate < aujourd'hui)
  // et les interventions — seules les reservations en cours ou a venir.
  const reservationCountByProperty = useMemo(() => {
    const todayStr = toDateStr(new Date());
    const map = new Map<number, number>();
    for (const evt of allEvents) {
      if (evt.type !== 'reservation' || evt.status === 'cancelled') continue;
      if (evt.endDate < todayStr) continue;
      map.set(evt.propertyId, (map.get(evt.propertyId) ?? 0) + 1);
    }
    return map;
  }, [allEvents]);

  return (
    // Sous 900px la carte est a fleur d'ecran : ni arrondi ni filet lateral —
    // sur 375px, 8px de marge de chaque cote + un rayon de 14px coutaient une
    // colonne de jour. Au-dela, la carte reprend l'aspect du kit.
    <Card className="gap-0 py-0 flex-1 min-h-[0px] flex flex-col bg-[var(--bui-card)] overflow-hidden rounded-none ring-0 min-[900px]:rounded-xl min-[900px]:ring-1">
      <DndContext
        sensors={drag.sensors}
        modifiers={drag.modifiers}
        onDragStart={drag.handleDragStart}
        onDragMove={drag.handleDragMove}
        onDragEnd={drag.handleDragEnd}
        onDragCancel={drag.handleDragCancel}
      >
        {/* Jamais de scroll vertical : la grille paginée et l'accordéon (dont la
            hauteur est calculée pour tenir dans le viewport) ne débordent pas.
            La barre de défilement est masquée sur les deux moteurs. */}
        <div
          // Box typait son `ref` souplement ; un element intrinseque exige un
          // `RefObject<HTMLDivElement>` strict, la ou le hook expose
          // `RefObject<HTMLDivElement | null>`. Meme objet, simple variance.
          ref={scrollRef as React.RefObject<HTMLDivElement>}
          onScroll={onScroll}
          className="flex-1 relative overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* Scrollable content: headers + rows.
              Colonne flex d'au moins la hauteur du scroller : c'est ce qui
              permet a la rangee « Occupation » de s'ancrer en pied (`mt-auto`)
              plutot que de flotter au bout de la pile des lignes. `shrink-0`
              sur les enfants — sans lui, une pile plus haute que le scroller
              se ferait comprimer au lieu de deborder (comportement actuel,
              masque par `overflow-y-hidden`). */}
          <div
            className="min-w-full flex flex-col min-h-full [&>*]:shrink-0"
            style={{ width: propertyColWidth + totalGridWidth }}
          >
            {/* Date headers (sticky top) */}
            <PlanningDateHeaders
              days={days}
              dayWidth={dayWidth}
              zoom={zoom}
              totalGridWidth={totalGridWidth}
              propertyColWidth={propertyColWidth}
              propertyCount={properties.length}
              collapsed={propertyColCollapsed}
              onToggleCollapse={onTogglePropertyCol}
            />

            {/* Body: property column + grid rows */}
            <div className="flex relative">
              {/* Property column (sticky left) */}
              <PlanningPropertyColumn
                properties={properties}
                density={density}
                selectedPropertyId={null}
                colWidth={propertyColWidth}
                onColWidthChange={propertyColCollapsed ? undefined : onPropertyColWidthChange}
                collapsed={propertyColCollapsed}
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
              <div className="relative shrink-0" style={{ width: totalGridWidth }}>
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
                      onUnblock={onUnblock}
                      onEmptyClick={onEmptyClick}
                      quickCreateOpen={quickCreateOpen}
                      showPrices={showPrices}
                      showInterventions={showInterventions}
                      pricingMap={pricingMap}
                      minNightsMap={minNightsMap}
                      effectiveRowHeight={effectiveRowHeight}
                      allEvents={eventsByProperty.get(property.id) ?? EMPTY_EVENTS}
                      loadedReservations={reservationsByProperty.get(property.id) ?? EMPTY_RESERVATIONS}
                    />
                    {expandedPropertyId === property.id && renderExpanded && (
                      <div className="relative bg-[var(--bui-background)]" style={{ width: totalGridWidth, height: accordionHeight, borderBottom: '1px solid var(--bui-border)' }}>
                        {/* Panneau calé sur le viewport (sticky-left) + tiré sous la
                            colonne sticky (ml négatif) → plein largeur, ne défile pas.
                            Pas de padding : le canvas sombre (flush) couvre TOUT
                            l'accordéon. Retrait gauche et largeur sont calculés → `style`. */}
                        <div
                          className="sticky start-0 h-full z-[11] p-0 box-border"
                          style={{ marginInlineStart: `-${propertyColWidth}px`, width: viewport.width || '100%' }}
                        >
                          {renderExpanded(property)}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}

                {/* Empty filler rows to fill remaining space — fond plat
                    (spec : pas de zebra) */}
                {Array.from({ length: emptyRowCount }, (_, i) => (
                  <div className="bg-[transparent]" style={{ height: effectiveRowHeight, width: totalGridWidth }} key={`empty-grid-${i}`} />
                ))}
              </div>
            </div>

            {/* La synthèse Baitly reste en bas, y compris sous l'accordéon. */}
            {dayOccupancy && (
              <PlanningOccupancyRow
                days={days}
                dayWidth={dayWidth}
                totalGridWidth={totalGridWidth}
                propertyColWidth={propertyColWidth}
                occupancy={dayOccupancy}
                occupiedCounts={dayOccupiedCounts}
                totalPropertyCount={occupancyPropertyCount}
                collapsed={propertyColCollapsed}
              />
            )}
          </div>
        </div>

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
    </Card>
  );
});

PlanningTimeline.displayName = 'PlanningTimeline';
export default PlanningTimeline;
