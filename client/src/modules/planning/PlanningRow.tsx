import React, { useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PlanningBar from './PlanningBar';
import PlanningBlockedBand from './PlanningBlockedBand';
import type { BarLayout, PlanningEvent, PlanningProperty, DensityMode, ZoomLevel, QuickCreateData, RowDragState } from './types';
import { ROW_CONFIG, BAR_BORDER_RADIUS } from './constants';
import PlanningRowBackdrop from './PlanningRowBackdrop';
import { toDateStr } from './utils/dateUtils';
import { resolveAttachedReservationId, type AttachmentCandidate } from './utils/interventionAttachment';
import type { PricingMap } from './hooks/usePlanningPricing';
import type { MinNightsMap } from './hooks/usePlanningMinNights';
import { cn } from '../../utils/cn';
import { isRtlLanguage } from '../../utils/localeDate';
import { useBaitlyRangeSelection } from './hooks/useBaitlyRangeSelection';
import { Money } from '../../components/Money';
import { NightsStay } from '../../icons';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlanningRowProps {
  property: PlanningProperty;
  barLayouts: BarLayout[];
  days: Date[];
  dayWidth: number;
  density: DensityMode;
  zoom: ZoomLevel;
  totalGridWidth: number;
  rowIndex: number;
  selectedEventId: string | null;
  conflictEventIds: Set<string>;
  isDragging: boolean;
  /** Drag concernant CETTE ligne uniquement (resize en cours sur un de ses
   *  events), `null` sinon — cf. découpage dans PlanningTimeline. Passer le
   *  dragState global cassait le memo de TOUTES les lignes à chaque mousemove. */
  rowDrag: RowDragState | null;
  onEventClick: (event: PlanningEvent) => void;
  onHideEvent?: (event: PlanningEvent) => void;
  /** Débloque une plage — `to` est EXCLUSIVE. Absent = action non proposée. */
  onUnblock?: (propertyId: number, from: string, to: string) => Promise<void>;
  onEmptyClick: (data: QuickCreateData) => void;
  quickCreateOpen: boolean;
  showPrices: boolean;
  /** Conservé pour le contrat avec PlanningTimeline — le filtre des events
   *  est fait en amont (usePlanningFilters), la hauteur de ligne est fixe. */
  showInterventions?: boolean;
  pricingMap: PricingMap;
  minNightsMap?: MinNightsMap;
  effectiveRowHeight: number;
  /** All events (unfiltered) for conflict detection on range selection */
  allEvents: PlanningEvent[];
  /** TOUTES les réservations chargées (avant filtres/légende/plage).
   *  Sert au rattachement intervention → réservation (lien explicite OU
   *  heuristique date/propriété) : une intervention rattachée à une
   *  réservation connue n'est JAMAIS rendue en pastille isolée — même si la
   *  brique hôte est masquée ou hors plage. */
  loadedReservations: AttachmentCandidate[];
}

// ─── Component ──────────────────────────────────────────────────────────────

const PlanningRow: React.FC<PlanningRowProps> = React.memo(({
  property,
  barLayouts,
  days,
  dayWidth,
  density,
  zoom,
  totalGridWidth,
  rowIndex,
  selectedEventId,
  conflictEventIds,
  isDragging,
  rowDrag,
  onEventClick,
  onHideEvent,
  onUnblock,
  onEmptyClick,
  quickCreateOpen,
  showPrices,
  pricingMap,
  minNightsMap,
  effectiveRowHeight,
  allEvents,
  loadedReservations,
}) => {
  const config = ROW_CONFIG[density];
  // Sens de lecture de la frise. La selection de dates convertit une abscisse
  // de souris en index de colonne : en arabe, la colonne 0 est a DROITE.
  const { i18n, t } = useTranslation();
  const isRtl = isRtlLanguage(i18n.language);

  // ── Interventions rattachées à une réservation (maquette) ────────────────
  // RÈGLE UNIQUE : une intervention RATTACHÉE (lien explicite
  // linkedReservationId, heuristique même propriété + date planifiée dans
  // [checkIn, checkOut] inclusif, OU fenêtre de vacance post-checkout
  // (ménage à checkout+N avant le check-in suivant) — cf.
  // resolveAttachedReservationId) est
  // UNIQUEMENT rendue comme pastille DANS la brique de sa réservation
  // (pastille blanche 20px — sur brique étroite elle compte dans le « +N »).
  // Si la brique hôte est masquée ou hors plage, la prestation reste visible
  // à sa propre date. Chaque layout suit un seul chemin : lié, autonome ou
  // plage bloquée, sans double rendu de la même intervention.
  const { visibleLayouts, linkedInterventionsByBarId, blockedLayouts } = useMemo(() => {
    const reservationLayoutsById = new Map<number, BarLayout>();
    for (const l of barLayouts) {
      if (l.event.type === 'reservation' && l.event.reservation) {
        reservationLayoutsById.set(l.event.reservation.id, l);
      }
    }
    const linked = new Map<string, PlanningEvent[]>();
    const visible: BarLayout[] = [];
    const blocked: BarLayout[] = [];
    for (const l of barLayouts) {
      const event = l.event;
      // Plage bloquée : rendue en bande de cellules grisées (PlanningBlockedBand),
      // jamais en brique d'événement — un blocage n'est pas un séjour.
      if (event.type === 'blocked') {
        blocked.push(l);
        continue;
      }
      // Un ménage/maintenance rattachable provient soit d'une INTERVENTION
      // (linkedReservationId), soit d'une SERVICE REQUEST « A payer »
      // (reservationId) — les deux doivent s'afficher DANS la brique de leur
      // réservation.
      const isInterventionType = event.type === 'cleaning' || event.type === 'maintenance';
      const attachable = event.intervention || event.serviceRequest;
      if (isInterventionType && attachable) {
        const linkedReservationId = event.intervention?.linkedReservationId
          ?? event.serviceRequest?.reservationId;
        const attachedResId = resolveAttachedReservationId(
          {
            propertyId: event.propertyId,
            startDate: event.startDate,
            linkedReservationId,
          },
          loadedReservations,
        );
        if (attachedResId != null) {
          const host = reservationLayoutsById.get(attachedResId);
          if (host) {
            const arr = linked.get(host.event.id);
            if (arr) {
              arr.push(event);
            } else {
              linked.set(host.event.id, [event]);
            }
            continue;
          }
          // Hôte NON rendu — il est masqué par une puce de légende, ou son
          // séjour tombe hors de la fenêtre de dates affichée. L'intervention
          // redevient alors AUTONOME.
          //
          // Elle disparaissait purement et simplement : masquer un canal
          // effaçait aussi ses ménages, alors que la légende ne filtre QUE les
          // réservations (usePlanningFilters laisse passer tout ce qui n'en est
          // pas une) et que les interventions ont déjà leur propre interrupteur.
          // Un ménage planifié à checkout+N dont le séjour s'achève avant le
          // bord gauche de la fenêtre disparaissait de la même façon.
        }
      }
      visible.push(l);
    }
    return { visibleLayouts: visible, linkedInterventionsByBarId: linked, blockedLayouts: blocked };
  }, [barLayouts, loadedReservations]);
  const propertyPricing = showPrices ? pricingMap.get(property.id) : undefined;
  const propertyMinNights = showPrices ? minNightsMap?.get(property.id) : undefined;
  // Hauteur active = rangée entière : les interventions partagent la bande
  // verticale de la brique (plus de couloir dédié sous la brique).
  const activeRowHeight = config.rowHeight;

  const { selectionRange, selectionError, selectionBlocked, handlePointerDown, handleKeyDown, keyboardDay } = useBaitlyRangeSelection({
    days, dayWidth, property, pricingMap, allEvents, isDragging, isRtl,
    rowHeight: config.rowHeight, quickCreateOpen, onEmptyClick,
  });

  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (document.activeElement === rowRef.current) {
      rowRef.current?.querySelector('[data-keyboard-day]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [keyboardDay]);

  return (
    <div ref={rowRef} className="relative bg-[transparent] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--bui-primary)]" style={{ height: effectiveRowHeight, width: totalGridWidth, borderBottom: '1px solid var(--bui-border)' }}
      role="group" tabIndex={0}
      aria-label={t('planning.grid.keyboardSelection', { property: property.name, date: days[keyboardDay] ? toDateStr(days[keyboardDay]) : '', defaultValue: '{{property}}, {{date}}. Flèches : choisir une date. Maj + flèches : étendre. Entrée : créer une réservation.' })}
      onPointerDown={handlePointerDown} onKeyDown={handleKeyDown}>
      {/* Fond de la rangee (colonnes teintees + filets) : partage avec le
          squelette de chargement, pour qu'ils ne puissent pas diverger. */}
      <PlanningRowBackdrop days={days} dayWidth={dayWidth} totalGridWidth={totalGridWidth} />

      {/* Cursor zone for empty areas (pointer-events off — parent handles pointerDown) */}
      <div
        className="absolute start-0 top-0 cursor-cell z-[1] pointer-events-none"
        style={{ width: totalGridWidth, height: activeRowHeight }}
      />

      <span aria-hidden="true" data-keyboard-day className="absolute invisible pointer-events-none"
        style={{ insetInlineStart: keyboardDay * dayWidth, width: dayWidth, height: activeRowHeight }} />

      {/* Selection highlight overlay (drag-to-select) — styled like reservation bars */}
      {selectionRange && (() => {
        const isError = selectionError || selectionBlocked;
        const selColor = isError ? 'var(--err)' : 'var(--ok)'; // Rouge si bloqué, vert sinon
        const nightCount = selectionRange.end - selectionRange.start + 1;
        const offsetPx = selectionRange.startOffsetPx || 0;
        const leftPx = selectionRange.start * dayWidth + offsetPx;
        const widthPx = nightCount * dayWidth - offsetPx;
        return (
          // Le clignotement d'erreur passait par des @keyframes emises par MUI.
          // Ici l'utilitaire `animate-pulse` (meme courbe 1 -> .5 -> 1) recadre
          // sur la duree et le nombre de repetitions d'origine.
          <div
            className={cn(
              'absolute z-[4] flex items-center px-1.5 pointer-events-none',
              isError && [
                'transition-opacity duration-300 ease-out',
                'animate-pulse [animation-duration:0.4s] [animation-iteration-count:2]',
                'motion-reduce:animate-none motion-reduce:transition-none',
              ],
            )}
            style={{
              // Logique et non physique : la frise se lit a l'envers en arabe.
              insetInlineStart: leftPx,
              top: config.barPadding,
              width: Math.max(widthPx, 4), // Minimum 4px so the bar is always visible
              height: config.reservationBarHeight,
              backgroundColor: `color-mix(in srgb, ${selColor} 25%, transparent)`,
              border: `1.5px solid color-mix(in srgb, ${selColor} 60%, transparent)`,
              borderRadius: `${BAR_BORDER_RADIUS}px`,
              boxShadow: `0 2px 8px color-mix(in srgb, ${selColor} 25%, transparent)`,
            }}
          >
            {/* `selColor` est calcule au rendu : une classe Tailwind ne pouvant
                pas naitre d'une variable, la couleur passe en style inline. */}
            <p
              className="cn-text-body1 text-xs font-semibold truncate leading-[1.2]"
              style={{ color: isError ? 'var(--bui-destructive-ink)' : 'var(--bui-success-ink)' }}
            >
              {isError ? t('planning.noRoom') : t('planning.panel.nights', { count: nightCount })}
            </p>
          </div>
        );
      })()}

      {/* Plages bloquées : cellules grisées + tooltip au clic (pas de brique) */}
      {blockedLayouts.map((layout) => (
        <PlanningBlockedBand
          key={layout.event.id}
          left={layout.left}
          width={layout.width}
          height={activeRowHeight}
          notes={layout.event.label && layout.event.label !== 'Bloqué' ? layout.event.label : undefined}
          source={layout.event.sublabel}
          startDate={layout.event.startDate}
          endDate={layout.event.endDate}
          onUnblock={onUnblock && ((from, to) => onUnblock(layout.event.propertyId, from, to))}
        />
      ))}

      {/* Event bars */}
      {visibleLayouts.map((layout) => {
        // Check if this bar is being resized → pass live width.
        // rowDrag n'est non-null que si le resize concerne cette ligne
        // (activeType/ghostLayout déjà vérifiés côté PlanningTimeline).
        const isBeingResized = rowDrag !== null && rowDrag.activeId === `resize-${layout.event.id}`;
        const resizeWidth = isBeingResized ? rowDrag!.ghostWidth : null;
        const resizeConflict = isBeingResized ? rowDrag!.conflict : false;

        return (
          <PlanningBar
            key={layout.event.id}
            layout={layout}
            zoom={zoom}
            isSelected={layout.event.id === selectedEventId}
            isConflict={conflictEventIds.has(layout.event.id)}
            isDragActive={isDragging}
            resizeWidth={resizeWidth}
            resizeConflict={resizeConflict}
            onClick={onEventClick}
            onHide={onHideEvent}
            linkedInterventions={linkedInterventionsByBarId.get(layout.event.id)}
            currency={property.currency ?? 'EUR'}
          />
        );
      })}

      {/* Prix + min-nights par cellule — centres dans chaque case de jour.
          Toujours rendus, masques visuellement par les bars (z-index inferieur).
          Sur cellule libre : prix au centre, badge min-nights en bas-droite. */}
      {showPrices && days.map((day, idx) => {
        const dateStr = toDateStr(day);
        const pricing = propertyPricing?.get(dateStr);
        const price = pricing?.nightlyPrice;
        const minNights = propertyMinNights?.get(dateStr);
        if (price == null && minNights == null) return null;
        if (allEvents.some((event) => event.propertyId === property.id
          && (event.type === 'blocked' || (event.type === 'reservation' && event.status !== 'cancelled'))
          && event.startDate <= dateStr && event.endDate > dateStr)) return null;
        if (dayWidth < 30) return null;

        return (
          <div className="absolute top-0 flex items-center justify-center pointer-events-none z-[0] px-[1.5px] overflow-hidden" style={{ insetInlineStart: idx * dayWidth, width: dayWidth, height: activeRowHeight }} key={`cell-info-${dateStr}`}>
            {price != null && (
              <span
                className={cn(
                  'font-[family-name:var(--font-display)] font-medium text-[var(--bui-muted-foreground)] leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full tabular-nums',
                  'text-xs',
                )}
              >
                <Money value={price} from={property.currency ?? 'EUR'} compact symbolSize={dayWidth < 60 ? 9 : 10} />
              </span>
            )}
            {minNights != null && dayWidth >= 38 && (
              <div className="absolute bottom-[2px] end-[3px] flex items-center gap-0 text-[var(--bui-muted-foreground)]">
                <NightsStay size={12} strokeWidth={1.75} />
                <span className="text-xs font-medium leading-none tabular-nums">
                  {minNights}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

PlanningRow.displayName = 'PlanningRow';
export default PlanningRow;
