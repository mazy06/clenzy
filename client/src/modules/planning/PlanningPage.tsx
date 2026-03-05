import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import PlanningToolbar from './PlanningToolbar';
import PlanningTimeline from './PlanningTimeline';
import PlanningActionPanel from './PlanningActionPanel';
import PlanningQuickCreateDialog from './PlanningQuickCreateDialog';
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
import { usePropertyColWidth } from './hooks/usePropertyColWidth';
import { ACTION_PANEL_WIDTH } from './constants';

const PlanningPage: React.FC = () => {
  // iCal import modal
  const [icalModalOpen, setIcalModalOpen] = useState(false);

  // Navigation (dates, zoom, density)
  const nav = usePlanningNavigation();

  // Responsive property column width
  const propertyColWidth = usePropertyColWidth();

  // Infinite horizontal timeline (buffer, days, scroll)
  const timeline = useInfiniteTimeline({
    anchorDate: nav.currentDate,
    zoom: nav.zoom,
    dayWidth: nav.dayWidth,
    propertyColWidth,
  });

  // Data fetching (chunked by 30-day aligned windows)
  const { properties, events, interventions, loading, error } = usePlanningData(
    timeline.bufferStart,
    timeline.bufferEnd,
  );

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

  // Layout (bar positions)
  const { getBarLayouts, totalGridWidth } = usePlanningLayout(
    filteredEvents,
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

  // Click on property name → open panel on "Logement" tab
  const handlePropertyClick = useCallback((propertyId: number) => {
    // Find first event for this property to open the panel
    const event = filteredEvents.find((e) => e.propertyId === propertyId);
    if (event) {
      selectEvent(event);
      // Switch to property tab after selection (selectEvent defaults to 'info')
      setTimeout(() => setPanelTab('property'), 0);
    }
  }, [filteredEvents, selectEvent, setPanelTab]);

  // Reservation update (dates & times from panel, with validation)
  const { updateReservation, changeProperty, cancelReservation, updateNotes, duplicateReservation, hideReservation, updateGuestInfo } = useReservationUpdate(filteredEvents, interventions);

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
  } = useInterventionActions(filteredEvents, interventions);

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

  // Drag & drop
  const drag = usePlanningDrag({
    events: filteredEvents,
    properties: filteredProperties,
    interventions,
    days: timeline.days,
    dayWidth: nav.dayWidth,
    density: nav.density,
  });

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
          zIndex: 1300,
          backgroundColor: 'background.default',
        }),
      }}
    >
      {/* Toolbar */}
      <Box sx={{ flexShrink: 0, mb: 1 }}>
        <PlanningToolbar
          currentDate={nav.currentDate}
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
          onSearchChange={setSearchQuery}
          onClearFilters={clearFilters}
          onImportICal={() => setIcalModalOpen(true)}
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
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Aucun logement trouve. Verifiez vos filtres ou ajoutez des proprietes.
          </Typography>
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
            events={filteredEvents}
            drag={drag}
            onEventClick={selectEvent}
            onHideEvent={handleHideEvent}
            onEmptyClick={openQuickCreate}
            quickCreateOpen={!!quickCreateData}
            scrollRef={timeline.scrollRef}
            onScroll={timeline.handleScroll}
            propertyColWidth={propertyColWidth}
            showPrices={filters.showPrices}
            showInterventions={filters.showInterventions}
            pricingMap={pricingMap}
            pageSize={pagination.pageSize}
            onPropertyClick={handlePropertyClick}
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
    </Box>
  );
};

export default PlanningPage;
