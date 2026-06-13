import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, CircularProgress, Alert, Typography, Button, Tooltip, IconButton } from '@mui/material';
import { CalendarMonth, Add, CloudDownload } from '../../icons';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import HeaderSearchField from '../../components/HeaderSearchField';
import PlanningToolbar from './PlanningToolbar';
import PlanningTimeline from './PlanningTimeline';
import PlanningActionPanel from './PlanningActionPanel';
import PlanningQuickCreateDialog from './PlanningQuickCreateDialog';
import BlockPeriodDialog from './BlockPeriodDialog';
import PlanningPaginationBar from './PlanningPaginationBar';
import ICalImportModal from '../dashboard/ICalImportModal';
import { usePlanningNavigation } from './hooks/usePlanningNavigation';
import { useInfiniteTimeline } from './hooks/useInfiniteTimeline';
import { usePlanningData } from './hooks/usePlanningData';
import { usePlanningFilters } from './hooks/usePlanningFilters';
import { usePlanningLayout } from './hooks/usePlanningLayout';
import { usePlanningSelection } from './hooks/usePlanningSelection';
import { usePlanningDrag } from './hooks/usePlanningDrag';
import { useReservationUpdate } from './hooks/useReservationUpdate';
import { useInterventionActions } from './hooks/useInterventionActions';
import { usePlanningPagination } from './hooks/usePlanningPagination';
import { usePlanningPricing } from './hooks/usePlanningPricing';
import { usePlanningMinNights } from './hooks/usePlanningMinNights';
import { usePlanningChannelSync } from './hooks/usePlanningChannelSync';
import { useResizablePropertyColWidth } from './hooks/useResizablePropertyColWidth';
import { useUrgencyAnimation } from './hooks/useUrgencyAnimation';
import { ACTION_PANEL_WIDTH, PLANNING_CHANNEL_KEYS, PLANNING_STATUS_KEYS } from './constants';
import { formatMonthYear, toDateStr, addDays } from './utils/dateUtils';
import type { PlanningChannelKey } from './constants';
import type { PlanningEvent } from './types';
import type { ReservationStatus } from '../../services/api';

const PlanningPage: React.FC = () => {
  const queryClient = useQueryClient();

  // iCal import modal
  const [icalModalOpen, setIcalModalOpen] = useState(false);

  // Block period dialog
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  // Navigation (dates, zoom, density)
  const nav = usePlanningNavigation();

  // Largeur de la colonne logements : breakpoint-based + redimensionnable
  // par l'utilisateur (persiste dans localStorage).
  const { width: propertyColWidth, setWidth: setPropertyColWidth } = useResizablePropertyColWidth();

  // Variante d'animation d'urgence des briques (per-device, localStorage)
  const [urgencyAnimation, setUrgencyAnimation] = useUrgencyAnimation();

  // Infinite horizontal timeline (buffer, days, scroll)
  const timeline = useInfiniteTimeline({
    anchorDate: nav.currentDate,
    zoom: nav.zoom,
    dayWidth: nav.dayWidth,
    propertyColWidth,
  });

  // Data fetching (chunked by 30-day aligned windows)
  const { properties, events, reservations, interventions, loading, error } = usePlanningData(
    timeline.bufferStart,
    timeline.bufferEnd,
  );

  // TOUTES les réservations chargées (avant filtres/légende) : servent à
  // PlanningRow pour rattacher chaque intervention à sa réservation (lien
  // explicite OU heuristique date/propriété) et ne JAMAIS la rendre en
  // pastille isolée quand la brique hôte est masquée ou hors plage.

  // Filters
  const {
    filters,
    setStatusFilter,
    setShowInterventions,
    setShowPrices,
    setSearchQuery,
    clearFilters,
    hasActiveFilters,
    filteredEvents,
    filteredProperties,
  } = usePlanningFilters(events, properties);

  // ── Filtres légende (rangées Canaux / Statuts de la toolbar) ──────────────
  // État session-scoped, non persisté : tout est sélectionné par défaut, un
  // clic sur une chip masque les briques du canal / statut correspondant.
  const [activeChannels, setActiveChannels] = useState<Set<PlanningChannelKey>>(
    () => new Set(PLANNING_CHANNEL_KEYS),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<ReservationStatus>>(
    () => new Set(PLANNING_STATUS_KEYS),
  );

  const toggleChannel = useCallback((key: PlanningChannelKey) => {
    setActiveChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleStatus = useCallback((status: ReservationStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  // Masquage client-side des briques réservation selon les toggles légende.
  // S'applique APRÈS usePlanningFilters (hooks de données inchangés) et AVANT
  // le layout/rendu de la grille. Seul l'affichage est filtré : sélection,
  // drag et validations de conflit continuent de voir l'ensemble complet.
  // Les sources hors légende (ex: 'other') restent toujours visibles.
  const visibleEvents = useMemo(() => {
    const allSelected =
      activeChannels.size === PLANNING_CHANNEL_KEYS.length
      && activeStatuses.size === PLANNING_STATUS_KEYS.length;
    if (allSelected) return filteredEvents;
    return filteredEvents.filter((e) => {
      if (e.type !== 'reservation') return true;
      const source = e.reservation?.source;
      if (source && source !== 'other' && !activeChannels.has(source)) return false;
      return activeStatuses.has(e.status as ReservationStatus);
    });
  }, [filteredEvents, activeChannels, activeStatuses]);

  // Pagination (dynamic page size based on viewport height)
  const pagination = usePlanningPagination({
    totalProperties: filteredProperties,
    density: nav.density,
    isFullscreen: nav.isFullscreen,
    showPrices: filters.showPrices,
  });

  // Pricing data (fetched only when toggle is ON)
  const { pricingMap } = usePlanningPricing(
    filteredProperties.map((p) => p.id),
    timeline.bufferStart,
    timeline.bufferEnd,
    filters.showPrices,
  );

  // Min-nights overrides (toujours fetch quand showPrices est ON, meme
  // indicateur que pour les prix : info contextuelle a la cellule)
  const { minNightsMap } = usePlanningMinNights(
    filteredProperties.map((p) => p.id),
    timeline.bufferStart,
    timeline.bufferEnd,
    filters.showPrices,
  );

  // Channel sync health : "X/Y canaux OK" agrege par propriete (current state,
  // pas per-date). Affiche dans la colonne logements a cote du tag count.
  const { channelSyncMap } = usePlanningChannelSync(
    filteredProperties.map((p) => p.id),
    true,
  );

  // Layout (bar positions) — sur les events visibles (toggles Canaux/Statuts)
  const { getBarLayouts, totalGridWidth } = usePlanningLayout(
    visibleEvents,
    timeline.days,
    nav.dayWidth,
    nav.density,
  );

  // Selection & panels
  const {
    selection,
    selectedEvent,
    selectEvent,
    closePanel,
    setPanelTab,
    quickCreateData,
    openQuickCreate,
    closeQuickCreate,
  } = usePlanningSelection(filteredEvents);

  // « + Réservation » (header) : réutilise le flux quick-create existant
  // (PlanningQuickCreateDialog). Le dialog est lié à UNE propriété (pas de
  // sélecteur interne) : on préselectionne le premier logement visible avec
  // un séjour aujourd'hui → demain ; les dates restent modifiables dans le dialog.
  const handleCreateReservation = useCallback(() => {
    const prop = filteredProperties[0] ?? properties[0];
    if (!prop) return;
    const today = new Date();
    openQuickCreate({
      propertyId: prop.id,
      propertyName: prop.name,
      startDate: toDateStr(today),
      endDate: toDateStr(addDays(today, 1)),
      nightlyPrice: prop.nightlyPrice ?? 0,
      defaultCheckInTime: prop.defaultCheckInTime,
      defaultCheckOutTime: prop.defaultCheckOutTime,
      cleaningFrequency: prop.cleaningFrequency,
      cleaningBasePrice: prop.cleaningBasePrice,
    });
  }, [filteredProperties, properties, openQuickCreate]);

  // Handle event click: SR blocks redirect to linked reservation's Paiement tab
  const handleEventClick = useCallback((event: PlanningEvent) => {
    if (event.isAwaitingPayment && event.serviceRequest?.reservationId) {
      const resEvent = filteredEvents.find(
        (e) => e.type === 'reservation' && e.reservation?.id === event.serviceRequest!.reservationId,
      );
      if (resEvent) {
        selectEvent(resEvent);
        setTimeout(() => setPanelTab('financial'), 0);
        return;
      }
    }
    selectEvent(event);
  }, [filteredEvents, selectEvent, setPanelTab]);

  // Reservation update (dates & times from panel, with validation)
  // Conflict validation must run against the FULL event set, not the UI-filtered one,
  // otherwise a real overlap with a reservation hidden by a filter goes undetected.
  const { updateReservation, changeProperty, cancelReservation, updateNotes, duplicateReservation, hideReservation, updateGuestInfo } = useReservationUpdate(events, interventions);

  const handleHideEvent = useCallback((event: { reservation?: { id: number } }) => {
    if (event.reservation) hideReservation(event.reservation.id);
  }, [hideReservation]);

  // Intervention actions (create, assign, priority, notes)
  const {
    createAutoCleaning,
    createIntervention,
    assignIntervention,
    setPriority,
    updateInterventionDates,
    updateInterventionNotes,
  } = useInterventionActions(events, interventions);

  // Intervention lifecycle actions (start, complete, validate, photos, progress, payment)
  const startIntervention = useCallback(async (interventionId: number) => {
    try {
      const { interventionsApi } = await import('../../services/api');
      if (interventionsApi.isMockMode()) {
        // Mock: update status in cache
        const { useQueryClient } = await import('@tanstack/react-query');
        return { success: true, error: null };
      }
      await interventionsApi.start(interventionId);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erreur' };
    }
  }, []);

  const completeIntervention = useCallback(async (interventionId: number) => {
    try {
      const { interventionsApi } = await import('../../services/api');
      // Complete = set progress to 100%
      await interventionsApi.updateProgress(interventionId, 100);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erreur' };
    }
  }, []);

  const validateIntervention = useCallback(async (interventionId: number, estimatedCost: number) => {
    try {
      const { interventionsApi } = await import('../../services/api');
      // Validate = update with estimated cost and mark complete
      await interventionsApi.update(interventionId, { estimatedCost, status: 'COMPLETED' });
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erreur' };
    }
  }, []);

  const uploadPhotos = useCallback(async (interventionId: number, photos: File[], type: 'before' | 'after') => {
    try {
      const { interventionsApi } = await import('../../services/api');
      if (interventionsApi.isMockMode()) {
        return { success: true, error: null };
      }
      await interventionsApi.uploadPhotos(interventionId, photos, type);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erreur' };
    }
  }, []);

  const updateInterventionProgress = useCallback(async (interventionId: number, progress: number) => {
    try {
      const { interventionsApi } = await import('../../services/api');
      if (interventionsApi.isMockMode()) {
        return { success: true, error: null };
      }
      await interventionsApi.updateProgress(interventionId, progress);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erreur' };
    }
  }, []);

  const createPaymentSession = useCallback(async (interventionIds: number[], total: number) => {
    const { paymentsApi } = await import('../../services/api/paymentsApi');
    const session = await paymentsApi.createSession({ interventionIds, totalAmount: total });
    return { url: session.url, sessionId: session.sessionId };
  }, []);

  const createEmbeddedSession = useCallback(async (interventionId: number, amount: number) => {
    const { paymentsApi } = await import('../../services/api/paymentsApi');
    const session = await paymentsApi.createEmbeddedSession({ interventionId, amount });
    return { clientSecret: session.clientSecret || '', sessionId: session.sessionId };
  }, []);

  const handlePaymentComplete = useCallback(() => {
    // Invalidate interventions + reservations queries so the UI refreshes with updated payment statuses
    queryClient.invalidateQueries({ queryKey: ['planning-page'] });
  }, [queryClient]);

  const sendPaymentLink = useCallback(async (reservationId: number, email?: string) => {
    const { reservationsApi } = await import('../../services/api');
    await reservationsApi.sendPaymentLink(reservationId, email);
  }, []);

  const generateInvoice = useCallback(async (data: {
    documentType: string;
    referenceId: number;
    referenceType: string;
    emailTo?: string;
    sendEmail: boolean;
  }) => {
    const { documentsApi } = await import('../../services/api/documentsApi');
    const result = await documentsApi.generateDocument(data);
    return {
      id: result.id,
      fileName: result.fileName,
      status: result.status,
      legalNumber: result.legalNumber ?? null,
    };
  }, []);

  // Drag & drop — conflict check (wouldConflict) needs the full event set, not the
  // filtered view, to catch overlaps with reservations hidden by the UI filters.
  const drag = usePlanningDrag({
    events,
    properties: filteredProperties,
    interventions,
    days: timeline.days,
    dayWidth: nav.dayWidth,
    density: nav.density,
  });

  // ── Libellé mois de la toolbar synchronisé sur le scroll horizontal ──────
  // Le libellé « ‹ Mois Année › » suit le jour situé au tiers gauche du
  // viewport de la grille (plus stable visuellement que le premier jour
  // visible). State séparé de nav.currentDate : on ne touche ni à l'ancre,
  // ni au buffer, ni au chargement de données.
  const [visibleMonthDate, setVisibleMonthDate] = useState<Date>(() => nav.currentDate);
  const monthSyncRaf = useRef<number | null>(null);
  // Anti-boucle : quand ‹ › / « Aujourd'hui » changent l'ancre, le buffer se
  // recentre et le scrollLeft est repositionné programmatiquement — on ignore
  // les événements scroll pendant cette fenêtre pour ne pas réécrire un mois
  // transitoire par-dessus celui de l'ancre.
  const programmaticScrollUntil = useRef(0);

  useEffect(() => {
    programmaticScrollUntil.current = Date.now() + 300;
    setVisibleMonthDate(nav.currentDate);
  }, [nav.currentDate]);

  // Throttle rAF : un seul calcul par frame, depuis scrollLeft / dayWidth.
  const handleTimelineScroll = useCallback(() => {
    timeline.handleScroll();
    if (Date.now() < programmaticScrollUntil.current) return;
    if (monthSyncRaf.current !== null) return;
    monthSyncRaf.current = requestAnimationFrame(() => {
      monthSyncRaf.current = null;
      const el = timeline.scrollRef.current;
      if (!el || timeline.days.length === 0) return;
      // Jour 0 de la grille à x = scrollLeft (la colonne logements est sticky) ;
      // sonde au tiers gauche de la zone de jours visible.
      const gridViewportWidth = Math.max(0, el.clientWidth - propertyColWidth);
      const probeIndex = Math.floor((el.scrollLeft + gridViewportWidth / 3) / nav.dayWidth);
      const day = timeline.days[Math.min(timeline.days.length - 1, Math.max(0, probeIndex))];
      setVisibleMonthDate((prev) =>
        prev.getMonth() === day.getMonth() && prev.getFullYear() === day.getFullYear()
          ? prev
          : day,
      );
    });
  }, [timeline.handleScroll, timeline.scrollRef, timeline.days, propertyColWidth, nav.dayWidth]);

  useEffect(() => () => {
    if (monthSyncRaf.current !== null) cancelAnimationFrame(monthSyncRaf.current);
  }, []);

  // ── Initial scroll to today when timeline first becomes visible ──────────
  const hasInitialScrolled = useRef(false);
  useEffect(() => {
    if (!loading && filteredProperties.length > 0 && !hasInitialScrolled.current) {
      hasInitialScrolled.current = true;
      // Double rAF ensures the DOM is fully laid out before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          timeline.scrollToAnchor();
        });
      });
    }
  }, [loading, filteredProperties.length, timeline]);

  // ── Auto-scroll: always position selected reservation at 3rd column ─────────
  useEffect(() => {
    if (!selectedEvent || !selection.panelOpen) return;

    requestAnimationFrame(() => {
      timeline.scrollToDate(new Date(selectedEvent.startDate));
    });
  }, [selectedEvent?.id, selection.panelOpen, timeline]);

  // Sous-titre du header : mois visible (synchronisé au scroll), capitalisé.
  const visibleMonthLabel = formatMonthYear(visibleMonthDate);
  const headerSubtitle = `Réservations & interventions · ${visibleMonthLabel.charAt(0).toUpperCase()}${visibleMonthLabel.slice(1)}`;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Compenser le padding du MainLayoutFull <main> pour coller aux bords
        m: { xs: -1.5, md: -2 },
        height: nav.isFullscreen ? '100vh' : { xs: 'calc(100vh - 48px)', md: '100vh' },
        ...(nav.isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          m: 0,
          zIndex: 1300,
          backgroundColor: 'var(--bg)',
        }),
      }}
    >
      {/* Page header — masqué en plein écran (le fullscreen masque déjà le
          chrome ; la toolbar garde les actions critiques) */}
      {!nav.isFullscreen && (
        <Box sx={{ flexShrink: 0, px: { xs: 1.5, md: 2 }, pt: { xs: 1.5, md: 2 } }}>
          <PageHeader
            title="Planning"
            subtitle={headerSubtitle}
            showBackButton={false}
            filters={
              <HeaderSearchField
                value={filters.searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher..."
              />
            }
            actions={
              <>
                <Tooltip title="Importer les réservations via un lien iCal (.ics)" arrow>
                  <IconButton
                    aria-label="Importer iCal"
                    onClick={() => setIcalModalOpen(true)}
                  >
                    <CloudDownload size={18} strokeWidth={1.85} />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add size={14} strokeWidth={1.75} />}
                  onClick={handleCreateReservation}
                  disabled={properties.length === 0}
                  sx={{
                    height: 28,
                    borderRadius: '9px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    px: 1.25,
                    color: 'var(--accent)',
                    borderColor: 'var(--accent)',
                    '&:hover': {
                      backgroundColor: 'var(--accent-soft)',
                      borderColor: 'var(--accent)',
                    },
                  }}
                >
                  Réservation
                </Button>
              </>
            }
          />
        </Box>
      )}

      {/* Toolbar */}
      <Box sx={{ flexShrink: 0, mb: 1 }}>
        <PlanningToolbar
          currentDate={visibleMonthDate}
          zoom={nav.zoom}
          density={nav.density}
          isFullscreen={nav.isFullscreen}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          onGoPrev={nav.goPrev}
          onGoToday={nav.goToday}
          onGoNext={nav.goNext}
          onZoomChange={nav.setZoom}
          onDensityChange={nav.setDensity}
          onToggleFullscreen={nav.toggleFullscreen}
          onShowInterventionsChange={setShowInterventions}
          onShowPricesChange={setShowPrices}
          onStatusFilter={setStatusFilter}
          onClearFilters={clearFilters}
          activeChannels={activeChannels}
          onToggleChannel={toggleChannel}
          activeStatuses={activeStatuses}
          onToggleStatus={toggleStatus}
          onBlockPeriod={() => setBlockDialogOpen(true)}
          leftOffset={propertyColWidth}
          urgencyAnimation={urgencyAnimation}
          onUrgencyAnimationChange={setUrgencyAnimation}
        />
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mx: 1.5, mb: 1, flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, gap: 1.5 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            Chargement du planning...
          </Typography>
        </Box>
      ) : filteredProperties.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, px: 2 }}>
          <EmptyState
            icon={<CalendarMonth />}
            title="Aucun logement trouvé"
            description="Vérifiez vos filtres ou ajoutez des propriétés pour les voir apparaître dans le planning."
            variant="transparent"
          />
        </Box>
      ) : (
        /* Main content area */
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
            px: 1.5,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PlanningTimeline
            properties={pagination.paginatedProperties}
            days={timeline.days}
            dayWidth={nav.dayWidth}
            density={nav.density}
            zoom={nav.zoom}
            getBarLayouts={getBarLayouts}
            totalGridWidth={totalGridWidth}
            selectedEventId={selection.selectedEventId}
            events={visibleEvents}
            loadedReservations={reservations}
            drag={drag}
            onEventClick={handleEventClick}
            onHideEvent={handleHideEvent}
            onEmptyClick={openQuickCreate}
            quickCreateOpen={!!quickCreateData}
            scrollRef={timeline.scrollRef}
            onScroll={handleTimelineScroll}
            propertyColWidth={propertyColWidth}
            onPropertyColWidthChange={setPropertyColWidth}
            showPrices={filters.showPrices}
            showInterventions={filters.showInterventions}
            pricingMap={pricingMap}
            minNightsMap={minNightsMap}
            channelSyncMap={channelSyncMap}
            pageSize={pagination.pageSize}
          />

          {/* Pagination — pinned to bottom, full width (compensate parent px) */}
          <Box sx={{ flexShrink: 0, mt: 1, mx: -1.5 }}>
            <PlanningPaginationBar
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              totalProperties={filteredProperties.length}
              onPrevPage={pagination.goPrevPage}
              onNextPage={pagination.goNextPage}
            />
          </Box>
        </Box>
      )}

      {/* Action Panel */}
      <PlanningActionPanel
        open={selection.panelOpen}
        event={selectedEvent}
        activeTab={selection.panelTab}
        onTabChange={setPanelTab}
        onClose={closePanel}
        allEvents={filteredEvents}
        properties={properties}
        interventions={interventions}
        onUpdateReservation={updateReservation}
        onChangeProperty={changeProperty}
        onCancelReservation={cancelReservation}
        onUpdateNotes={updateNotes}
        onUpdateGuestInfo={updateGuestInfo}
        onAssignIntervention={assignIntervention}
        onSetPriority={setPriority}
        onUpdateInterventionNotes={updateInterventionNotes}
        onUpdateInterventionDates={updateInterventionDates}
        onStartIntervention={startIntervention}
        onCompleteIntervention={completeIntervention}
        onValidateIntervention={validateIntervention}
        onUploadPhotos={uploadPhotos}
        onUpdateInterventionProgress={updateInterventionProgress}
        onCreatePaymentSession={createPaymentSession}
        onCreateEmbeddedSession={createEmbeddedSession}
        onSendPaymentLink={sendPaymentLink}
        onGenerateInvoice={generateInvoice}
        onPaymentComplete={handlePaymentComplete}
        onDuplicateReservation={duplicateReservation}
      />

      {/* Quick Create Dialog */}
      <PlanningQuickCreateDialog
        open={!!quickCreateData}
        data={quickCreateData}
        onClose={closeQuickCreate}
        events={filteredEvents}
      />

      {/* iCal Import Modal */}
      <ICalImportModal
        open={icalModalOpen}
        onClose={() => setIcalModalOpen(false)}
      />

      {/* Block Period Dialog */}
      <BlockPeriodDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        propertyId={null}
        startDate={null}
        endDate={null}
        properties={properties}
      />
    </Box>
  );
};

export default PlanningPage;
