import React, { useEffect, useRef } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import PlanningToolbar from './PlanningToolbar';
import PlanningTimeline from './PlanningTimeline';
import PlanningActionPanel from './PlanningActionPanel';
import PlanningQuickCreateDialog from './PlanningQuickCreateDialog';
import PlanningPaginationBar from './PlanningPaginationBar';
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

  // Reservation update (dates & times from panel, with validation)
  const { updateReservation, changeProperty, cancelReservation, updateNotes, duplicateReservation } = useReservationUpdate(filteredEvents, interventions);

  // Intervention actions (create, assign, priority, notes)
  const {
    createAutoCleaning,
    createIntervention,
    assignIntervention,
    setPriority,
    updateInterventionNotes,
  } = useInterventionActions(filteredEvents, interventions);

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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: nav.isFullscreen ? '100vh' : 'calc(100vh - 64px)',
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
      />

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
            transition: 'margin-right 0.3s ease',
            mr: selection.panelOpen ? `${ACTION_PANEL_WIDTH}px` : 0,
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
            onEmptyClick={openQuickCreate}
            scrollRef={timeline.scrollRef}
            onScroll={timeline.handleScroll}
            propertyColWidth={propertyColWidth}
            showPrices={filters.showPrices}
            pricingMap={pricingMap}
          />

          {/* Pagination */}
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
        onCreateAutoCleaning={createAutoCleaning}
        onCreateIntervention={createIntervention}
        onAssignIntervention={assignIntervention}
        onSetPriority={setPriority}
        onUpdateInterventionNotes={updateInterventionNotes}
        onDuplicateReservation={duplicateReservation}
      />

      {/* Quick Create Dialog */}
      <PlanningQuickCreateDialog
        open={!!quickCreateData}
        data={quickCreateData}
        onClose={closeQuickCreate}
      />
    </Box>
  );
};

export default PlanningPage;
