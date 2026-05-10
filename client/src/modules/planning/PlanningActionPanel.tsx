import React, { useEffect, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Close,
  Info,
  Build,
  AccountBalance,
  Home,
  TrendingUp,
  PhotoLibrary,
  Payment,
} from '../../icons';
import type { PlanningEvent, PanelTab, PlanningProperty, PlanningEventType, PanelView } from './types';
import type { PlanningIntervention } from '../../services/api';
import PanelReservationInfo from './PlanningActionPanel/PanelReservationInfo';
import PanelOperations from './PlanningActionPanel/PanelOperations';
import PanelFinancial from './PlanningActionPanel/PanelFinancial';
import PanelHistory from './PlanningActionPanel/PanelHistory';
import PanelActions from './PlanningActionPanel/PanelActions';
import PanelPropertyDetails from './PlanningActionPanel/PanelPropertyDetails';
import PanelInterventionProgress from './PlanningActionPanel/PanelInterventionProgress';
import PanelInterventionRecap from './PlanningActionPanel/PanelInterventionRecap';
import PanelPayment from './PlanningActionPanel/PanelPayment';
import PanelSubViewHeader from './PlanningActionPanel/PanelSubViewHeader';
import PanelInterventionDetail from './PlanningActionPanel/PanelInterventionDetail';
import { usePanelNavigation } from './PlanningActionPanel/usePanelNavigation';
import { ACTION_PANEL_WIDTH } from './constants';
import { hexToRgba } from './utils/colorUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error: string | null };

interface PlanningActionPanelProps {
  open: boolean;
  event: PlanningEvent | null;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
  allEvents: PlanningEvent[];
  properties?: PlanningProperty[];
  interventions?: PlanningIntervention[];
  // Reservation actions
  onUpdateReservation?: (reservationId: number, updates: {
    checkIn?: string; checkOut?: string; checkInTime?: string; checkOutTime?: string;
  }) => Promise<ActionResult>;
  onChangeProperty?: (reservationId: number, newPropertyId: number, newPropertyName: string) => Promise<ActionResult>;
  onCancelReservation?: (reservationId: number) => Promise<ActionResult>;
  onUpdateNotes?: (reservationId: number, notes: string) => Promise<ActionResult>;
  onUpdateGuestInfo?: (reservationId: number, updates: { guestName?: string; guestEmail?: string; guestPhone?: string }) => Promise<ActionResult>;
  // Intervention actions
  onAssignIntervention?: (interventionId: number, assigneeName: string, options?: { userId?: number; teamId?: number }) => Promise<ActionResult>;
  onSetPriority?: (interventionId: number, priority: 'normale' | 'haute' | 'urgente') => Promise<ActionResult>;
  onUpdateInterventionNotes?: (interventionId: number, notes: string) => Promise<ActionResult>;
  onUpdateInterventionDates?: (interventionId: number, updates: {
    startDate?: string; endDate?: string; startTime?: string; endTime?: string;
  }) => Promise<ActionResult>;
  // Lifecycle actions
  onStartIntervention?: (interventionId: number) => Promise<ActionResult>;
  onCompleteIntervention?: (interventionId: number) => Promise<ActionResult>;
  onValidateIntervention?: (interventionId: number, estimatedCost: number) => Promise<ActionResult>;
  onUploadPhotos?: (interventionId: number, photos: File[], type: 'before' | 'after') => Promise<ActionResult>;
  onUpdateInterventionProgress?: (interventionId: number, progress: number) => Promise<ActionResult>;
  onCreatePaymentSession?: (interventionIds: number[], total: number) => Promise<{ url: string; sessionId: string }>;
  onCreateEmbeddedSession?: (interventionId: number, amount: number) => Promise<{ clientSecret: string; sessionId: string }>;
  onSendPaymentLink?: (reservationId: number, email?: string) => Promise<void>;
  // Document generation
  onGenerateInvoice?: (data: {
    documentType: string;
    referenceId: number;
    referenceType: string;
    emailTo?: string;
    sendEmail: boolean;
  }) => Promise<{ id: number; fileName: string; status: string; legalNumber?: string | null }>;
  // Payment complete (refresh data)
  onPaymentComplete?: () => void;
  // Actions (PanelActions)
  onDuplicateReservation?: (reservationId: number, newCheckIn: string, newCheckOut: string) => Promise<ActionResult>;
}

// ─── Tab configs ──────────────────────────────────────────────────────────────

const ICON_PROPS = { size: 16, strokeWidth: 1.75 } as const;

const RESERVATION_TABS: { value: PanelTab; label: string; icon: React.ReactElement }[] = [
  { value: 'info', label: 'Infos', icon: <Info {...ICON_PROPS} /> },
  { value: 'property', label: 'Logement', icon: <Home {...ICON_PROPS} /> },
  { value: 'operations', label: 'Opérations', icon: <Build {...ICON_PROPS} /> },
  { value: 'financial', label: 'Paiement', icon: <AccountBalance {...ICON_PROPS} /> },
];

const INTERVENTION_TABS: { value: PanelTab; label: string; icon: React.ReactElement }[] = [
  { value: 'info', label: 'Infos', icon: <Info {...ICON_PROPS} /> },
  { value: 'progress', label: 'Avancement', icon: <TrendingUp {...ICON_PROPS} /> },
  { value: 'recap', label: 'Récap', icon: <PhotoLibrary {...ICON_PROPS} /> },
  { value: 'payment', label: 'Paiement', icon: <Payment {...ICON_PROPS} /> },
];

const getTabConfig = (eventType: PlanningEventType) =>
  eventType === 'reservation' ? RESERVATION_TABS : INTERVENTION_TABS;

const getValidTabs = (eventType: PlanningEventType): PanelTab[] =>
  getTabConfig(eventType).map((t) => t.value);

// ─── Sub-view title helper ────────────────────────────────────────────────────

const getSubViewTitle = (view: PanelView): string => {
  switch (view.type) {
    case 'property-details': return 'Détails du logement';
    case 'intervention-detail': return 'Détail intervention';
    default: return '';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const PlanningActionPanel: React.FC<PlanningActionPanelProps> = ({
  open,
  event,
  activeTab,
  onTabChange,
  onClose,
  allEvents,
  properties,
  interventions,
  onUpdateReservation,
  onChangeProperty,
  onCancelReservation,
  onUpdateNotes,
  onUpdateGuestInfo,
  onAssignIntervention,
  onSetPriority,
  onUpdateInterventionNotes,
  onUpdateInterventionDates,
  onStartIntervention,
  onCompleteIntervention,
  onValidateIntervention,
  onUploadPhotos,
  onUpdateInterventionProgress,
  onCreatePaymentSession,
  onCreateEmbeddedSession,
  onSendPaymentLink,
  onGenerateInvoice,
  onPaymentComplete,
  onDuplicateReservation,
}) => {
  const theme = useTheme();
  const { currentView, isSubView, pushView, popView } = usePanelNavigation(event?.id ?? null);

  // Auto-reset to valid tab when event type changes
  const validTabs = useMemo(
    () => (event ? getValidTabs(event.type) : []),
    [event?.type],
  );

  useEffect(() => {
    if (event && !validTabs.includes(activeTab)) {
      onTabChange('info');
    }
  }, [event?.id, event?.type]);

  if (!event) return null;

  const isReservation = event.type === 'reservation';
  const tabConfig = getTabConfig(event.type);

  // ── Sub-view content ──────────────────────────────────────────────────
  const renderSubView = () => {
    switch (currentView.type) {
      case 'property-details':
        return (
          <PanelPropertyDetails
            propertyId={currentView.propertyId}
            onDrillDown={(view) => pushView(view)}
          />
        );
      case 'intervention-detail':
        return (
          <PanelInterventionDetail
            interventionId={currentView.interventionId}
            event={event}
            allEvents={allEvents}
            interventions={interventions}
            onStartIntervention={onStartIntervention}
            onCompleteIntervention={onCompleteIntervention}
            onValidateIntervention={onValidateIntervention}
            onUploadPhotos={onUploadPhotos}
            onUpdateInterventionProgress={onUpdateInterventionProgress}
            onAssignIntervention={onAssignIntervention}
            onSetPriority={onSetPriority}
            onUpdateInterventionNotes={onUpdateInterventionNotes}
            onUpdateInterventionDates={onUpdateInterventionDates}
            onCreatePaymentSession={onCreatePaymentSession}
          />
        );
      default:
        return null;
    }
  };

  // ── Root tab content ──────────────────────────────────────────────────
  const renderTabContent = () => {
    // ── Reservation tabs ──
    if (isReservation) {
      switch (activeTab) {
        case 'info':
          return (
            <PanelReservationInfo
              event={event}
              allEvents={allEvents}
              properties={properties}
              onUpdateReservation={onUpdateReservation}
              onChangeProperty={onChangeProperty}
              onCancelReservation={onCancelReservation}
              onUpdateNotes={onUpdateNotes}
              onUpdateGuestInfo={onUpdateGuestInfo}
              onNavigate={pushView}
            />
          );
        case 'property':
          return (
            <PanelPropertyDetails
              propertyId={event.propertyId}
              onDrillDown={pushView}
            />
          );
        case 'operations':
          return (
            <PanelOperations
              event={event}
              allEvents={allEvents}
              interventions={interventions}
              onAssignIntervention={onAssignIntervention}
              onSetPriority={onSetPriority}
              onUpdateInterventionNotes={onUpdateInterventionNotes}
              onUpdateInterventionDates={onUpdateInterventionDates}
              onNavigate={pushView}
            />
          );
        case 'financial':
          return (
            <PanelFinancial
              event={event}
              interventions={interventions}
              onCreatePaymentSession={onCreatePaymentSession}
              onCreateEmbeddedSession={onCreateEmbeddedSession}
              onSendPaymentLink={onSendPaymentLink}
              onGenerateInvoice={onGenerateInvoice}
              onPaymentComplete={onPaymentComplete}
            />
          );
        default:
          return null;
      }
    }

    // ── Intervention tabs ──
    switch (activeTab) {
      case 'info':
        return (
          <PanelOperations
            event={event}
            allEvents={allEvents}
            interventions={interventions}
            onAssignIntervention={onAssignIntervention}
            onSetPriority={onSetPriority}
            onUpdateInterventionNotes={onUpdateInterventionNotes}
            onUpdateInterventionDates={onUpdateInterventionDates}
            onNavigate={pushView}
          />
        );
      case 'progress':
        return (
          <PanelInterventionProgress
            event={event}
            onStartIntervention={onStartIntervention}
            onCompleteIntervention={onCompleteIntervention}
            onUploadPhotos={onUploadPhotos}
            onUpdateInterventionProgress={onUpdateInterventionProgress}
          />
        );
      case 'recap':
        return <PanelInterventionRecap event={event} />;
      case 'payment':
        return (
          <PanelPayment
            event={event}
            interventions={interventions}
            onCreatePaymentSession={onCreatePaymentSession}
            onValidateIntervention={onValidateIntervention}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        // Keep drawer overlay (not push content) in all modes
        position: 'relative',
        zIndex: theme.zIndex.drawer + 1,
        '& .MuiDrawer-paper': {
          width: ACTION_PANEL_WIDTH,
          position: 'fixed',
          borderLeft: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          boxShadow: theme.palette.mode === 'dark'
            ? '-8px 0 24px rgba(0,0,0,0.3)'
            : '-8px 0 24px rgba(0,0,0,0.08)',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: hexToRgba(event.color, 0.06),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 4,
              height: 32,
              borderRadius: 2,
              backgroundColor: event.color,
              flexShrink: 0,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                fontSize: '0.875rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {event.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
              {isReservation ? 'Reservation' : event.type === 'cleaning' ? 'Ménage' : 'Maintenance'}
              {' · '}
              {event.startDate} → {event.endDate}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ flexShrink: 0 }}>
          <Close size={18} strokeWidth={1.75} />
        </IconButton>
      </Box>

      {/* Tabs or Sub-view Header */}
      {isSubView ? (
        <PanelSubViewHeader title={getSubViewTitle(currentView)} onBack={popView} />
      ) : (
        <Tabs
          value={activeTab}
          onChange={(_, value) => onTabChange(value)}
          variant="fullWidth"
          sx={{
            minHeight: 40,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 40,
              fontSize: '0.625rem',
              fontWeight: 600,
              textTransform: 'none',
              letterSpacing: '0.01em',
              py: 0.5,
            },
            '& .MuiTab-root .MuiTab-iconWrapper': {
              marginBottom: 0,
              marginRight: 0.5,
            },
          }}
        >
          {tabConfig.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {isSubView ? renderSubView() : renderTabContent()}
      </Box>
    </Drawer>
  );
};

export default PlanningActionPanel;
