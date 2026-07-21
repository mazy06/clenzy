import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, CircularProgress, Alert, Typography, Button, Tooltip, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { CalendarMonth, Add, CloudDownload, Fullscreen, FullscreenExit } from '../../icons';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import HeaderSearchField from '../../components/HeaderSearchField';
import PlanningToolbar from './PlanningToolbar';
import PlanningFilterButton from './PlanningFilterButton';
import PlanningTimeline from './PlanningTimeline';
import PlanningActionPanel from './PlanningActionPanel';
import ReservationDialog from '../../components/reservations/ReservationDialog';
import PlanningPaginationBar from './PlanningPaginationBar';
import ICalImportModal from '../dashboard/ICalImportModal';
import ImportSourceChooserDialog from './ImportSourceChooserDialog';
import ChannexMappingDialog from '../settings/components/ChannexMappingDialog';
import { usePlanningNavigation } from './hooks/usePlanningNavigation';
import { useInfiniteTimeline } from './hooks/useInfiniteTimeline';
import { usePlanningData } from './hooks/usePlanningData';
import { usePlanningFilters } from './hooks/usePlanningFilters';
import { usePlanningLayout } from './hooks/usePlanningLayout';
import { usePlanningSelection } from './hooks/usePlanningSelection';
import { usePlanningDrag } from './hooks/usePlanningDrag';
import { useReservationUpdate } from './hooks/useReservationUpdate';
import { useUserPreference } from '../../hooks/useUserPreference';
import { useInterventionActions } from './hooks/useInterventionActions';
import { usePlanningPagination } from './hooks/usePlanningPagination';
import { usePlanningPricing } from './hooks/usePlanningPricing';
import { usePlanningMinNights } from './hooks/usePlanningMinNights';
import { usePlanningChannelSync } from './hooks/usePlanningChannelSync';
import { useResizablePropertyColWidth } from './hooks/useResizablePropertyColWidth';
import { useUrgencyAnimation } from './hooks/useUrgencyAnimation';
import { ACTION_PANEL_WIDTH, PLANNING_CHANNEL_KEYS, PLANNING_STATUS_KEYS } from './constants';
import { formatMonthYear } from './utils/dateUtils';
import type { PlanningChannelKey } from './constants';
import type { PlanningEvent, PlanningProperty } from './types';
import type { ReservationStatus } from '../../services/api';
import {
  ScopeSwitch,
  PortfolioPanel,
  SupervisionPanel,
  MockPortfolioProvider,
  MockSupervisionProvider,
  AgUiSupervisionProvider,
  isSupervisionLiveEnabled,
  useCanSuperviseAgents,
  useSupervisionConfig,
  useSupervisionPendingCounts,
  type SupervisionScope,
} from '../supervision';
import { isMockEnabled } from '../../services/storageService';

const PlanningPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Import : choix du mécanisme (iCal ponctuel vs Channel Manager Channex),
  // puis modale du flux retenu.
  const [importChooserOpen, setImportChooserOpen] = useState(false);
  const [icalModalOpen, setIcalModalOpen] = useState(false);
  const [channelManagerOpen, setChannelManagerOpen] = useState(false);

  // Création « libre » (bouton +) : ouvre le ReservationDialog SANS logement verrouillé
  // → le sélecteur de logement s'affiche dans le corps (Réservation ET Blocage via le toggle).
  const [createOpen, setCreateOpen] = useState(false);

  // Navigation (dates, zoom, density)
  const nav = usePlanningNavigation();

  // Superviseur d'agents : portée (par logement / vue d'ensemble) + gate RBAC.
  const { canView: canViewSupervision } = useCanSuperviseAgents();
  // Gate feature : la constellation ne s'affiche que si l'org l'a activée
  // (Settings > IA). On ne fetch la config que pour les rôles habilités.
  const { data: supervisionConfig } = useSupervisionConfig({ enabled: canViewSupervision });
  const canSupervise = canViewSupervision && (supervisionConfig?.enabled ?? false);
  // Compteurs de cartes HITL en attente → pastilles sur les cellules logement.
  const { byProperty: pendingByProperty } = useSupervisionPendingCounts(canSupervise);
  const pendingCountByProperty = useMemo(() => {
    const map = new Map<number, number>();
    for (const [propertyId, count] of Object.entries(pendingByProperty)) {
      if (count > 0) map.set(Number(propertyId), count);
    }
    return map;
  }, [pendingByProperty]);
  // Fenêtre du bilan de la constellation, alignée sur le zoom du planning.
  const reportWindowDays = nav.zoom === 'week' ? 7 : nav.zoom === 'fortnight' ? 15 : 30;
  const [supervisionScope, setSupervisionScope] = useState<SupervisionScope>('property');
  // Logement dont la constellation est déployée : PERSISTÉ en préférence UI
  // (user_ui_preferences, cross-devices) → l'accordéon reste ouvert au reload
  // et à la reconnexion. Arbre Storage §2 (préférence ad-hoc par écran).
  // `null` = tous repliés. Un id périmé (logement filtré/supprimé) est inoffensif :
  // orderedProperties le laisse passer et renderExpanded ne matche jamais.
  const [expandedPropertyId, setExpandedPropertyId, { reset: resetExpandedProperty }] =
    useUserPreference<number | null>('planning.expandedPropertyId', null);
  // Ouverture pilotée du modal « Fiche client » depuis une carte de la constellation
  // (« email voyageur manquant ») : signal contrôlé transmis à PlanningActionPanel →
  // PanelFooterActions. Remis à null une fois consommé (permet une réouverture).
  const [autoOpenGuestCardReservationId, setAutoOpenGuestCardReservationId] = useState<string | null>(null);
  const createPortfolioProvider = useCallback(() => new MockPortfolioProvider(), []);
  const handleToggleExpanded = useCallback((propertyId: number) => {
    // Fermer = SUPPRIMER la préférence (retour au défaut null), et NON setPref(null) :
    // un PUT à corps null est envoyé sans body (apiClient : `if (body)`) → le backend
    // (@RequestBody requis) le rejette en 400, l'erreur est avalée et l'ancien id
    // survivait → la constellation se rouvrait au reload. deletePref envoie un DELETE
    // (sans corps, accepté) ET est immédiat (pas de debounce perdu au hard-reload du logout).
    if (expandedPropertyId === propertyId) {
      resetExpandedProperty();
    } else {
      setExpandedPropertyId(propertyId);
    }
  }, [expandedPropertyId, setExpandedPropertyId, resetExpandedProperty]);
  // Mode « Vue d'ensemble » : masque la grille + les contrôles propres au planning.
  const isOverview = canSupervise && supervisionScope === 'portfolio';

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

  // « Effacer tous les filtres » : réinitialise AUSSI les toggles légende
  // (canaux/statuts) qui sont session-scoped hors du hook usePlanningFilters.
  const handleClearFilters = useCallback(() => {
    clearFilters();
    setActiveChannels(new Set(PLANNING_CHANNEL_KEYS));
    setActiveStatuses(new Set(PLANNING_STATUS_KEYS));
  }, [clearFilters]);

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

  // Superviseur : à l'ouverture d'un accordéon, on remonte le logement déployé
  // en 1ʳᵉ position ; la pagination (firstItemAlone) l'isole alors sur sa propre
  // page (panneau plein écran) et fait glisser les autres logements en pages 2+.
  const supervisorExpanded = canSupervise && expandedPropertyId != null;

  // La rangée de chips légende (canaux/statuts/interventions) migre dans la
  // modale de filtres quand la toolbar ne peut pas l'afficher : viewport
  // compact OU constellation d'agents déployée. Source unique, jamais dupliquée.
  const theme = useTheme();
  const isCompactViewport = useMediaQuery(theme.breakpoints.down('lg'));
  const legendInModal = isCompactViewport || supervisorExpanded;
  const orderedProperties = useMemo(() => {
    if (!supervisorExpanded) return filteredProperties;
    const idx = filteredProperties.findIndex((p) => p.id === expandedPropertyId);
    if (idx <= 0) return filteredProperties; // introuvable ou déjà en tête
    return [
      filteredProperties[idx],
      ...filteredProperties.slice(0, idx),
      ...filteredProperties.slice(idx + 1),
    ];
  }, [filteredProperties, supervisorExpanded, expandedPropertyId]);

  // Pagination (dynamic page size based on viewport height)
  const pagination = usePlanningPagination({
    totalProperties: orderedProperties,
    density: nav.density,
    isFullscreen: nav.isFullscreen,
    showPrices: filters.showPrices,
    firstItemAlone: supervisorExpanded,
  });

  // Ids des logements de la PAGE affichée uniquement, mémoïsés (stabilise les
  // queryDescriptors des hooks pricing/min-nights). Fetcher toutes les
  // propriétés filtrées créait un burst de (N logements × chunks 30 j × 2 hooks)
  // requêtes au chargement ; le cache React Query par (propriété × chunk)
  // sert de cache au changement de page.
  const paginatedPropertyIds = useMemo(
    () => pagination.paginatedProperties.map((p) => p.id),
    [pagination.paginatedProperties],
  );

  // Pricing data (fetched only when toggle is ON)
  const { pricingMap } = usePlanningPricing(
    paginatedPropertyIds,
    timeline.bufferStart,
    timeline.bufferEnd,
    filters.showPrices,
  );

  // Min-nights overrides (toujours fetch quand showPrices est ON, meme
  // indicateur que pour les prix : info contextuelle a la cellule)
  const { minNightsMap } = usePlanningMinNights(
    paginatedPropertyIds,
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

  // « + Réservation » (header) : ouvre le ReservationDialog en création LIBRE — aucun
  // logement préselectionné, l'utilisateur choisit le logement (et les dates) dans le
  // modal, en mode Réservation ou Blocage. Les clics sur une cellule/résa continuent
  // d'ouvrir le dialog verrouillé sur le logement concerné (via openQuickCreate).
  const handleCreateReservation = useCallback(() => {
    setCreateOpen(true);
  }, []);

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

  // Ouvre la fiche client d'une réservation depuis la carte « email voyageur manquant » :
  // sélectionne la réservation (ouvre PlanningActionPanel) PUIS arme l'ouverture du modal
  // GuestCardDialog. Le handler exposé au provider DOIT rester stable (le provider ne se
  // recrée pas — cf. deps `[property.id]`), donc on passe par une ref « dernière valeur »
  // qui lit les données courantes sans changer d'identité.
  const openGuestCardRef = useRef<(reservationId: string) => void>(() => {});
  useEffect(() => {
    openGuestCardRef.current = (reservationId: string) => {
      const resEvent = filteredEvents.find(
        (e) => e.type === 'reservation' && e.reservation && String(e.reservation.id) === String(reservationId),
      );
      if (!resEvent) return;
      selectEvent(resEvent);
      setAutoOpenGuestCardReservationId(String(reservationId));
    };
  }, [filteredEvents, selectEvent, setAutoOpenGuestCardReservationId]);
  const handleOpenGuestCard = useCallback((reservationId: string) => {
    openGuestCardRef.current(reservationId);
  }, []);

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

  // « Aujourd'hui » : recale l'ancre ET force le scroll horizontal vers le jour
  // courant. Sans ce scroll explicite, si le jour d'ancre est inchangé (l'on a
  // seulement fait défiler le planning), le timeline ne se repositionne pas
  // (l'effet de recentrage ne se déclenche qu'au changement de jour d'ancre).
  const handleGoToday = useCallback(() => {
    nav.goToday();
    timeline.scrollToDate(new Date());
  }, [nav, timeline]);

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

  // Référence stable pour PlanningTimeline (React.memo) : la closure inline
  // recréée à chaque render du parent cassait la barrière de memo de toute la grille.
  const renderExpandedPanel = useCallback(
    (property: PlanningProperty) => {
      const mockMode = isMockEnabled('planning') || !isSupervisionLiveEnabled();
      const firstResa = visibleEvents.find(
        (e) => e.type === 'reservation' && e.propertyId === property.id && e.reservation,
      );
      const cometReservationId = firstResa?.reservation
        ? String(firstResa.reservation.id)
        : undefined;
      return (
        <SupervisionPanel
          createProvider={() =>
            // Mode démo planning OU live désactivé → provider MOCK
            // (constellation + « En direct » alimentés par des données
            // fictives variées par logement). Sinon → moteur réel.
            mockMode
              ? new MockSupervisionProvider(
                  String(property.id),
                  { cometReservationId, onOpenGuestCard: handleOpenGuestCard },
                  'demo',
                )
              : new AgUiSupervisionProvider(String(property.id), {
                  selectedPropertyId: Number(property.id),
                  currentPage: '/planning',
                  onOpenGuestCard: handleOpenGuestCard,
                })
          }
          // cometReservationId ne pilote QUE le mock : en live, l'inclure
          // dans les deps détruisait/recréait le provider (teardown SSE +
          // re-snapshot) quand les réservations finissaient de charger.
          deps={mockMode ? [property.id, cometReservationId] : [property.id]}
          propertyId={property.id}
          reportWindowDays={reportWindowDays}
          flush
        />
      );
    },
    [visibleEvents, handleOpenGuestCard, reportWindowDays],
  );

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
    // Deps fines volontaires : dependre de l'objet selectedEvent re-scrollerait
    // a chaque re-fetch du planning (nouvelle identite). id + startDate couvrent
    // tout ce que l'effet lit.
  }, [selectedEvent?.id, selectedEvent?.startDate, selection.panelOpen, timeline]);

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
              <>
                {canSupervise && (
                  <ScopeSwitch value={supervisionScope} onChange={setSupervisionScope} />
                )}
                {!isOverview && (
                  <HeaderSearchField
                    value={filters.searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Rechercher..."
                  />
                )}
              </>
            }
            actions={
              isOverview ? undefined : (
              <>
                <PlanningFilterButton
                  filters={filters}
                  density={nav.density}
                  hasActiveFilters={hasActiveFilters}
                  onDensityChange={nav.setDensity}
                  onShowInterventionsChange={setShowInterventions}
                  onShowPricesChange={setShowPrices}
                  onClearFilters={handleClearFilters}
                  urgencyAnimation={urgencyAnimation}
                  onUrgencyAnimationChange={setUrgencyAnimation}
                  showLegendChips={legendInModal}
                  activeChannels={activeChannels}
                  onToggleChannel={toggleChannel}
                  activeStatuses={activeStatuses}
                  onToggleStatus={toggleStatus}
                />
                <Tooltip title={nav.isFullscreen ? 'Quitter le plein écran' : 'Plein écran'} arrow>
                  <IconButton
                    aria-label={nav.isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                    onClick={nav.toggleFullscreen}
                  >
                    {nav.isFullscreen ? <FullscreenExit size={18} strokeWidth={1.75} /> : <Fullscreen size={18} strokeWidth={1.75} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Importer des réservations (iCal) ou connecter vos canaux (Channel Manager)" arrow>
                  <IconButton
                    aria-label="Importer des réservations ou connecter vos canaux"
                    onClick={() => setImportChooserOpen(true)}
                  >
                    <CloudDownload size={18} strokeWidth={1.85} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Nouvelle réservation" arrow>
                  <span>
                    <IconButton
                      aria-label="Nouvelle réservation"
                      onClick={handleCreateReservation}
                      disabled={properties.length === 0}
                      sx={{ color: 'var(--accent)' }}
                    >
                      <Add size={18} strokeWidth={1.85} />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
              )
            }
          />
        </Box>
      )}

      {/* Toolbar — navigation/zoom/légendes du planning : masqué en Vue d'ensemble */}
      {!isOverview && (
        <Box sx={{ flexShrink: 0, mb: 1 }}>
          <PlanningToolbar
            currentDate={visibleMonthDate}
            zoom={nav.zoom}
            isFullscreen={nav.isFullscreen}
            filters={filters}
            legendInModal={legendInModal}
            onGoPrev={nav.goPrev}
            onGoToday={handleGoToday}
            onGoNext={nav.goNext}
            onZoomChange={nav.setZoom}
            onToggleFullscreen={nav.toggleFullscreen}
            onShowInterventionsChange={setShowInterventions}
            activeChannels={activeChannels}
            onToggleChannel={toggleChannel}
            activeStatuses={activeStatuses}
            onToggleStatus={toggleStatus}
          />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mx: 1.5, mb: 1, flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {/* Vue d'ensemble (portefeuille) — plein largeur, masque la grille */}
      {isOverview ? (
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', px: 1.5 }}>
          <PortfolioPanel createProvider={createPortfolioProvider} deps={['portfolio']} />
        </Box>
      ) : loading ? (
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
            pendingCountByProperty={canSupervise ? pendingCountByProperty : undefined}
            pageSize={pagination.pageSize}
            expandedPropertyId={canSupervise ? expandedPropertyId : null}
            onToggleExpanded={canSupervise ? handleToggleExpanded : undefined}
            renderExpanded={canSupervise ? renderExpandedPanel : undefined}
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
        autoOpenGuestCardForReservationId={autoOpenGuestCardReservationId}
        onGuestCardAutoOpenHandled={() => setAutoOpenGuestCardReservationId(null)}
      />

      {/* Quick Create Dialog — création verrouillée (clic cellule/résa) OU création libre
          (bouton +, sélecteur de logement dans le corps). Sert aussi le mode « Blocage »
          via le toggle interne Réservation/Blocage (le blocage de période a fusionné ici). */}
      <ReservationDialog
        mode="create"
        open={!!quickCreateData || createOpen}
        onClose={() => {
          closeQuickCreate();
          setCreateOpen(false);
        }}
        lockedProperty={
          quickCreateData
            ? {
                id: quickCreateData.propertyId,
                name: quickCreateData.propertyName,
                nightlyPrice: quickCreateData.nightlyPrice,
                defaultCheckInTime: quickCreateData.defaultCheckInTime,
                defaultCheckOutTime: quickCreateData.defaultCheckOutTime,
                cleaningBasePrice: quickCreateData.cleaningBasePrice,
                cleaningFrequency: quickCreateData.cleaningFrequency,
              }
            : undefined
        }
        initialDates={
          quickCreateData
            ? { checkIn: quickCreateData.startDate, checkOut: quickCreateData.endDate }
            : undefined
        }
        events={filteredEvents}
      />

      {/* Choix du mécanisme d'import : iCal ponctuel OU Channel Manager (Channex) */}
      <ImportSourceChooserDialog
        open={importChooserOpen}
        onClose={() => setImportChooserOpen(false)}
        onChooseIcal={() => setIcalModalOpen(true)}
        onChooseChannelManager={() => setChannelManagerOpen(true)}
      />

      {/* iCal Import Modal */}
      <ICalImportModal
        open={icalModalOpen}
        onClose={() => setIcalModalOpen(false)}
      />

      {/* Channel Manager : même modale guidée Channex que le bouton du Dashboard */}
      <ChannexMappingDialog open={channelManagerOpen} guided onClose={() => setChannelManagerOpen(false)} />
    </Box>
  );
};

export default PlanningPage;
