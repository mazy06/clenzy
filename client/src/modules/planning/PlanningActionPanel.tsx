import React, { useEffect, useMemo } from 'react';
import {
  Drawer,
  Box,
  IconButton,
  useTheme,
} from '@mui/material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import PageTabs from '../../components/PageTabs';
import PanelReservationInfo from './PlanningActionPanel/PanelReservationInfo';
import PanelOperations from './PlanningActionPanel/PanelOperations';
import PanelFinancial from './PlanningActionPanel/PanelFinancial';
import PanelPropertyDetails from './PlanningActionPanel/PanelPropertyDetails';
import PanelInterventionProgress from './PlanningActionPanel/PanelInterventionProgress';
import PanelInterventionRecap from './PlanningActionPanel/PanelInterventionRecap';
import PanelPayment from './PlanningActionPanel/PanelPayment';
import PanelSubViewHeader from './PlanningActionPanel/PanelSubViewHeader';
import PanelInterventionDetail from './PlanningActionPanel/PanelInterventionDetail';
import PanelFooterActions from './PlanningActionPanel/PanelFooterActions';
import { usePanelNavigation } from './PlanningActionPanel/usePanelNavigation';
import { toDate, daysBetween } from './utils/dateUtils';

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

const ICON_PROPS = { size: 13, strokeWidth: 1.75 } as const;

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

// ─── Header helpers (maquette Signature) ─────────────────────────────────────

/** « Jean D. » — prénom + initiale du nom (entête du drawer). */
const formatGuestShort = (fullName: string): string => {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return fullName.trim();
  return `${words[0]} ${words[1][0].toUpperCase()}.`;
};

/** « 10 → 13 févr. 2026 · 3 nuits » (mois/année portés par le départ). */
const formatStayRange = (startStr: string, endStr: string): string => {
  const start = toDate(startStr);
  const end = toDate(endStr);
  const nights = Math.max(1, daysBetween(start, end));
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth ? format(start, 'd') : format(start, 'd MMM', { locale: fr });
  const endLabel = format(end, 'd MMM yyyy', { locale: fr });
  return `${startLabel} → ${endLabel} · ${nights} nuit${nights > 1 ? 's' : ''}`;
};

const EVENT_TYPE_LABELS: Record<PlanningEventType, string> = {
  reservation: 'Réservation',
  cleaning: 'Ménage',
  maintenance: 'Maintenance',
  blocked: 'Blocage',
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
              onUpdateReservation={onUpdateReservation}
              onUpdateNotes={onUpdateNotes}
              onUpdateGuestInfo={onUpdateGuestInfo}
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

  // Entête maquette : « Réservation · Jean D. » / « Ménage · {label} »
  const headerTitle = isReservation
    ? `Réservation · ${formatGuestShort(event.label)}`
    : `${EVENT_TYPE_LABELS[event.type]} · ${event.label}`;

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
          // Maquette Signature : drawer droite ~480px, full-screen sur mobile.
          width: { xs: '100vw', sm: 480 },
          maxWidth: '100vw',
          position: 'fixed',
          borderLeft: '1px solid var(--line)',
          // Filet accent en haut du drawer (2px).
          borderTop: '2px solid var(--accent)',
          backgroundColor: 'var(--card)',
          backgroundImage: 'none',
          boxShadow: 'var(--shadow-drawer)',
        },
      }}
    >
      {/* ─── Entête : titre display + sous-titre séjour + ✕ pastille ──── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box
            component="span"
            sx={{
              display: 'block',
              fontFamily: 'var(--font-display)',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--ink)',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {headerTitle}
          </Box>
          <Box
            component="span"
            sx={{
              display: 'block',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              mt: '2px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatStayRange(event.startDate, event.endDate)}
          </Box>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Fermer"
          sx={{
            flexShrink: 0,
            width: 30,
            height: 30,
            border: '1px solid var(--line-2)',
            borderRadius: '50%',
            color: 'var(--muted)',
            transition: 'color var(--duration-fast) var(--ease-out), background-color var(--duration-fast) var(--ease-out)',
            '&:hover': { color: 'var(--ink)', backgroundColor: 'var(--hover)' },
          }}
        >
          <Close size={14} strokeWidth={1.75} />
        </IconButton>
      </Box>

      {/* ─── Onglets niveau 1 (soulignés accent, style PageTabs) ──────── */}
      {isSubView ? (
        <PanelSubViewHeader title={getSubViewTitle(currentView)} onBack={popView} />
      ) : (
        <Box sx={{ px: 1 }}>
          <PageTabs<PanelTab>
            options={tabConfig.map((tab) => ({ value: tab.value, label: tab.label, icon: tab.icon }))}
            value={activeTab}
            onChange={onTabChange}
            size="compact"
            paper={false}
            mb={0}
            ariaLabel="Onglets du détail"
          />
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {isSubView ? renderSubView() : renderTabContent()}
      </Box>

      {/* ─── Pied sticky : actions réservation (grille 2×2) ───────────── */}
      {isReservation && !isSubView && (
        <PanelFooterActions
          event={event}
          allEvents={allEvents}
          properties={properties}
          onChangeProperty={onChangeProperty}
          onCancelReservation={onCancelReservation}
          onUpdateGuestInfo={onUpdateGuestInfo}
        />
      )}
    </Drawer>
  );
};

export default PlanningActionPanel;
