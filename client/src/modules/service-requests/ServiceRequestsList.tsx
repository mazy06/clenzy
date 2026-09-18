import { useAuth } from '../../hooks/useAuth';
import { MANAGER_ROLES, OPERATIONAL_ROLES } from '../../constants/roles';
import ProviderServiceRequests from './ProviderServiceRequests';
import { convertServiceRequest } from '../../hooks/useServiceRequestsList';
import type { ServiceRequestApiResponse } from './serviceRequestsUtils';
import { fetchMissionMapExport, useMissionMapFilters, useMissionMapOverview } from '../../hooks/useMissionMap';
import ServiceReferenceIssues from './ServiceReferenceIssues';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Alert, AlertDescription, Skeleton,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Cancel,
  Description,
  Assignment,
  Warning as WarningIcon,
  Schedule as ClockIcon,
  CheckCircle as CheckIcon,
} from '../../icons';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';
import { useServiceRequestsList } from './useServiceRequestsList';
import { isServiceRequestOverdue, overdueServiceRequestsFirst, statusColors, priorityColors, typeIcons } from './serviceRequestsUtils';
import {
  DeleteConfirmDialog,
  StatusChangeDialog,
  AssignDialog,
  ErrorDialog,
  SuccessDialog,
} from './ServiceRequestsDialogs';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import { ITEMS_PER_PAGE } from './serviceRequestsListConstants';
import ServiceRequestsMapView from './ServiceRequestsMapView';
import ServiceRequestsGridView from './ServiceRequestsGridView';
import ServiceRequestsTableView from './ServiceRequestsTableView';
import compactHeaderActions from '../../components/compactHeaderActions';

interface ServiceRequestsListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

// Icon-button d'action principale : contour de marque + fond `primary-soft` au
// survol (pattern boutons Baitly UI — jamais d'aplat plein).
const CREATE_BUTTON_CLASS =
  'rounded-[9px] border border-solid border-primary bg-transparent text-primary '
  + 'transition-[background-color,border-color,color] duration-[140ms] '
  + 'hover:bg-primary-soft hover:border-primary-deep hover:text-primary-deep';

export default function ServiceRequestsList(props: ServiceRequestsListProps) {
  const { hasAnyRole } = useAuth();
  const providerView = hasAnyRole([...OPERATIONAL_ROLES]) && !hasAnyRole([...MANAGER_ROLES]);
  const requests = <ManagedServiceRequestsList {...props} />;
  return providerView
    ? <ProviderServiceRequests embedded={props.embedded}>{requests}</ProviderServiceRequests>
    : requests;
}

function ManagedServiceRequestsList({ embedded = false, actionsContainer, filtersContainer }: ServiceRequestsListProps) {
  const [viewMode, setViewMode] = usePersistedViewMode<'grid' | 'list' | 'map'>(
    'service-requests', 'map', ['grid', 'list', 'map'] as const,
  );
  const {
    // Filter state
    searchTerm,
    setSearchTerm,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    selectedPriority,
    setSelectedPriority,

    // Menu state
    anchorEl,
    selectedServiceRequest,

    // Data
    serviceRequests,
    loading,
    loadFailed,
    refetch,
    filteredServiceRequests,

    // Delete dialog
    deleteDialogOpen,
    setDeleteDialogOpen,
    selectedRequestForDeletion,

    // Status change dialog
    statusChangeDialogOpen,
    setStatusChangeDialogOpen,
    selectedRequestForStatusChange,
    setSelectedRequestForStatusChange,
    newStatus,
    changingStatus,
    setNewStatus,

    // Assign dialog
    assignDialogOpen,
    selectedRequestForAssignment,
    assignAssignmentType,
    setAssignAssignmentType,
    assignSelectedTeamId,
    setAssignSelectedTeamId,
    assignSelectedUserId,
    setAssignSelectedUserId,
    assignTeams,
    assignUsers,
    loadingAssignData,
    assigning,

    // Validate dialog
    validateDialogOpen,
    setValidateDialogOpen,
    selectedRequestForValidation,
    setSelectedRequestForValidation,
    validating,

    // Error/success dialogs
    errorDialogOpen,
    setErrorDialogOpen,
    errorMessage,
    successDialogOpen,
    setSuccessDialogOpen,
    successMessage,

    // Handlers
    handleMenuOpen,
    handleMenuClose,
    handleEdit,
    handleViewDetails,
    handleDelete,
    confirmDelete,
    confirmStatusChange,
    handleAssignServiceRequest,
    confirmAssignment,
    closeAssignDialog,
    handleValidateAndCreateIntervention,
    confirmValidation,

    // Permission checks
    canModifyServiceRequest,
    canDeleteServiceRequest,
    canCancelServiceRequest,
    getRemainingCancellationTime,

    // Filter options
    serviceTypes,
    statuses,
    priorities,

    // Auth
    isAdmin,
    isManager,
    isHost,
    navigate,
    t,
  } = useServiceRequestsList(viewMode !== 'map');

  const mapFilters = useMissionMapFilters(searchTerm, selectedType, selectedStatus, selectedPriority);
  const mapOverview = useMissionMapOverview('service-requests', mapFilters, viewMode === 'map');
  const visibleRequests = useMemo(() => overdueServiceRequestsFirst(filteredServiceRequests), [filteredServiceRequests]);

  // Les indicateurs conservent leur périmètre global, indépendamment des filtres.
  const kpis = useMemo(() => {
    const maintenant = Date.now();
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    const finJour = debutJour.getTime() + 86_400_000;
    const ilYA7j = maintenant - 7 * 86_400_000;

    const enRetard = serviceRequests
      .filter((r) => isServiceRequestOverdue(r, maintenant))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const plusAncienne = enRetard[0];
    const joursRetard = plusAncienne
      ? Math.max(1, Math.floor((maintenant - new Date(plusAncienne.dueDate).getTime()) / 86_400_000))
      : 0;

    const aujourdHui = serviceRequests.filter((r) => {
      if (['CANCELLED', 'REJECTED'].includes(r.status) || !r.dueDate) return false;
      const due = new Date(r.dueDate).getTime();
      return due >= debutJour.getTime() && due < finJour;
    });

    // Pas de champ « terminee le » dans la liste : l'echeance sert de repere,
    // une demande soldee l'est autour de sa date prevue.
    const terminees7j = serviceRequests.filter(
      (r) => r.status === 'COMPLETED' && r.dueDate && new Date(r.dueDate).getTime() >= ilYA7j,
    );
    return { enRetard: enRetard.length, plusAncienne, joursRetard, aujourdHui: aujourdHui.length, terminees7j: terminees7j.length };
  }, [serviceRequests]);

  const indicators = (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs tabular-nums">
      {[
        { label: t("serviceRequests.kpi.late", "En retard"), value: kpis.enRetard, icon: WarningIcon, color: "text-[var(--bui-destructive-ink)]", detail: kpis.plusAncienne ? kpis.plusAncienne.title + " · " + t("serviceRequests.kpi.sinceDays", { count: kpis.joursRetard, defaultValue: "depuis {{count}} j" }) : undefined },
        { label: t("serviceRequests.kpi.today", "Aujourd’hui"), value: kpis.aujourdHui, icon: ClockIcon, color: "text-[var(--bui-info-ink)]" },
        { label: t("serviceRequests.kpi.done7d", "Terminées (7 j)"), value: kpis.terminees7j, icon: CheckIcon, color: "text-[var(--bui-success-ink)]" },
      ].map(({ label, value, icon: Icon, color, detail }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <span tabIndex={0} aria-label={value + " " + label} className="inline-flex items-center gap-1 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Icon aria-hidden size={15} className={color} />
              <span className="font-semibold">{value}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <span>{label}</span>
            {detail && <span className="mt-1 block max-w-64">{detail}</span>}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );

  // ─── Ancre du menu contextuel ───────────────────────────────────────────
  // Le declencheur du menu vit dans les vues enfant (grille / tableau / carte),
  // hors de cet arbre : on cale donc un declencheur invisible sur le rectangle
  // de l'element ancre, seule facon d'ancrer un DropdownMenu Radix sans que le
  // bouton d'origine soit un descendant du menu.
  const anchorRect = useMemo(() => anchorEl?.getBoundingClientRect() ?? null, [anchorEl]);
  // Memorise la derniere ancre pour lui rendre le focus a la fermeture (le
  // declencheur invisible ne doit jamais recevoir le focus).
  const lastAnchorRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (anchorEl) lastAnchorRef.current = anchorEl;
  }, [anchorEl]);

  const [page, setPage] = useState(0);
  // Dynamic page size based on available viewport height
  const { containerRef: listContainerRef, pageSize: rowsPerPage } = useDynamicPageSize({
    rowHeight: 49,
    headerHeight: 42,
    bottomChrome: 72,
    min: 5,
    max: 50,
  });

  // Reset page when dynamic page size changes
  useEffect(() => { setPage(0); }, [rowsPerPage]);

  const effectivePageSize = viewMode === 'grid' ? ITEMS_PER_PAGE : rowsPerPage;

  const paginatedServiceRequests = useMemo(
    () => visibleRequests.slice(page * effectivePageSize, (page + 1) * effectivePageSize),
    [visibleRequests, page, effectivePageSize]
  );

  // Reset page quand les filtres changent
  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedType, selectedStatus, selectedPriority, viewMode]);

  // Deep-link notification : surligne la demande ciblee (?highlight=<srId>).
  // Force la vue liste (les cartes/lignes portent data-highlight-id, pas la carte) et
  // ouvre la page qui contient la demande pour qu'elle soit visible avant le flash.
  const highlightId = useHighlightParam();
  const highlightApplied = useRef(false);
  useEffect(() => {
    if (!highlightId || loading || highlightApplied.current) return;
    const idx = visibleRequests.findIndex((r) => String(r.id) === highlightId);
    if (idx < 0) return;
    highlightApplied.current = true;
    if (viewMode === 'map') setViewMode('list');
    const size = viewMode === 'grid' ? ITEMS_PER_PAGE : rowsPerPage;
    setPage(Math.floor(idx / size));
  }, [highlightId, loading, visibleRequests, viewMode, rowsPerPage, setViewMode]);

  useHighlightTarget(highlightId, !loading && visibleRequests.length > 0);

  const exportColumns: ExportColumn[] = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Titre' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Statut' },
    { key: 'priority', label: 'Priorité' },
    { key: 'propertyName', label: 'Propriété' },
    { key: 'requestorName', label: 'Demandeur' },
    { key: 'assignedToName', label: 'Assigné à' },
    { key: 'dueDate', label: "Date d'échéance", formatter: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
    { key: 'createdAt', label: 'Date de création', formatter: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
  ], []);

  const actionButtons = (
    <div className="flex gap-1 items-center">
      <ExportButton
        data={visibleRequests}
        loadData={viewMode === 'map' ? async () => (await fetchMissionMapExport<ServiceRequestApiResponse>('service-requests', mapFilters)).map(convertServiceRequest) : undefined}
        columns={exportColumns}
        fileName="demandes-service"
        variant="icon"
      />
      <Tooltip>
        {/* Span intercalaire : le kit ne transmet pas de ref, Radix en a besoin. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('serviceRequests.create')}
              onClick={() => navigate('/service-requests/new')}
              className={CREATE_BUTTON_CLASS}
            >
              <Add size={20} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('serviceRequests.create')}</TooltipContent>
      </Tooltip>
    </div>
  );

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t('serviceRequests.search')}
      filters={{
        type: {
          value: selectedType,
          options: serviceTypes,
          onChange: setSelectedType,
          label: t('common.type')
        },
        status: {
          value: selectedStatus,
          options: statuses,
          onChange: setSelectedStatus,
          label: t('common.status')
        },
        priority: {
          value: selectedPriority,
          options: priorities,
          onChange: setSelectedPriority,
          label: t('serviceRequests.fields.priority')
        }
      }}
      counter={{
        label: t('serviceRequests.request'),
        count: viewMode === 'map' ? mapOverview.data?.total ?? 0 : visibleRequests.length,
        singular: "",
        plural: "s"
      }}
      viewToggle={{
        mode: viewMode,
        onChange: setViewMode,
      }}
    />
  );

  return (
    <>
      {/* Le bandeau du header deborde du rembourrage du conteneur de contenu
          (marges negatives). Il vit donc HORS de la colonne ci-dessous, dont le
          `overflow-hidden` decoupait ce debordement sur les quatre cotes : le
          bandeau s'arretait au bord du rembourrage, comme une carte. */}
      {!embedded && (
        <div className="shrink-0">
          <PageHeader
            title={t('serviceRequests.title')}
            subtitle={t('serviceRequests.subtitle')}
            iconBadge={<Description />}
            backPath="/dashboard"
            showBackButton={false}
            actions={actionButtons}
            filters={filterBar}
          />
        </div>
      )}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Portal actions into parent's PageHeader when embedded */}
        {embedded && actionsContainer && createPortal(compactHeaderActions(actionButtons), actionsContainer)}

        {/* Portal filters into parent's PageHeader when embedded */}
        {embedded && filtersContainer && createPortal(filterBar, filtersContainer)}


        {(isAdmin() || isManager()) && <ServiceReferenceIssues />}
        {!loadFailed && !loading && viewMode !== "map" && (
          <div className="mb-2 flex shrink-0 justify-end">{indicators}</div>
        )}

        {/* Liste des demandes de service */}
        {viewMode === 'map' ? <ServiceRequestsMapView filters={mapFilters} /> : loadFailed ? <Alert variant="destructive"><AlertDescription>
          {t('serviceRequests.loadError')}
          <Button variant="outline" onClick={() => void refetch()}>{t('common.retry')}</Button>
        </AlertDescription></Alert> : loading ? <Skeleton className="h-48 w-full" /> : visibleRequests.length === 0 ? (
          <EmptyState
            icon={<Description />}
            title={t('serviceRequests.noRequestFound')}
            description={`${
              isAdmin() || isManager()
                ? t('serviceRequests.noRequestCreated')
                : t('serviceRequests.noRequestAssigned')
            } — ${t('serviceRequests.requestsDescription')}`}
            action={(isAdmin() || isManager() || isHost()) && (
              <Button variant="outline" size="sm" onClick={() => navigate('/service-requests/new')}>
                <Add size={16} strokeWidth={1.75} />
                {t('serviceRequests.createFirst')}
              </Button>
            )}
          />
        ) : viewMode === 'grid' ? (
          <ServiceRequestsGridView
            serviceRequests={paginatedServiceRequests}
            totalCount={visibleRequests.length}
            page={page}
            onPageChange={setPage}
            onMenuOpen={handleMenuOpen}
            typeIcons={typeIcons}
            statuses={statuses}
            priorities={priorities}
            statusColors={statusColors}
            priorityColors={priorityColors}
            navigate={navigate}
          />
        ) : (
          <ServiceRequestsTableView
            serviceRequests={paginatedServiceRequests}
            totalCount={visibleRequests.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            containerRef={listContainerRef}
            onMenuOpen={handleMenuOpen}
            navigate={navigate}
          />
        )}

        {/* Menu contextuel */}
        <DropdownMenu
          open={Boolean(anchorEl)}
          onOpenChange={(next) => { if (!next) handleMenuClose(); }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed pointer-events-none opacity-0"
              // Coordonnees issues du rectangle de l'ancre : valeurs d'execution,
              // donc style inline (une classe Tailwind ne peut pas naitre d'une
              // variable). `left` et non `inset-inline-start` : le rectangle est
              // toujours mesure depuis le bord gauche du viewport, meme en RTL.
              style={anchorRect
                ? { left: anchorRect.left, top: anchorRect.top, width: anchorRect.width, height: anchorRect.height }
                : { left: 0, top: 0, width: 0, height: 0 }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-auto min-w-[220px]"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              lastAnchorRef.current?.focus();
            }}
          >
            <DropdownMenuItem onSelect={handleViewDetails}>
              <Visibility size={20} strokeWidth={1.75} />
              {t('serviceRequests.viewDetails')}
            </DropdownMenuItem>

            {/* Action d'assignation - visible pour managers et admins si la demande n'est pas assignee */}
            {(isAdmin() || isManager()) && selectedServiceRequest?.status === 'PENDING' && !selectedServiceRequest.assignedToId && (
              <DropdownMenuItem onSelect={() => handleAssignServiceRequest(selectedServiceRequest)}>
                {/* Icone teintee : l'assignation est l'action mise en avant de ce
                    menu. La teinte vient du jeton de marque, pas d'une prop MUI. */}
                <Assignment size={20} strokeWidth={1.75} className="text-primary" />
                {t('serviceRequests.assign')}
              </DropdownMenuItem>
            )}

            {/* Option de modification - toujours visible si permissions */}
            {selectedServiceRequest && canModifyServiceRequest(selectedServiceRequest) && (
              <DropdownMenuItem onSelect={handleEdit}>
                <Edit size={20} strokeWidth={1.75} />
                {t('serviceRequests.modify')}
              </DropdownMenuItem>
            )}

            {/* Option de suppression - seulement si pas approuvee */}
            {selectedServiceRequest && canDeleteServiceRequest(selectedServiceRequest) && (
              <DropdownMenuItem onSelect={handleDelete}>
                <Delete size={20} strokeWidth={1.75} />
                {t('serviceRequests.delete')}
              </DropdownMenuItem>
            )}

            {/* Option d'annulation - seulement si approuvee */}
            {selectedServiceRequest && canCancelServiceRequest(selectedServiceRequest) && (
              <DropdownMenuItem
                onSelect={() => {
                  setSelectedRequestForStatusChange(selectedServiceRequest);
                  setNewStatus('CANCELLED');
                  setStatusChangeDialogOpen(true);
                }}
              >
                <Cancel size={20} strokeWidth={1.75} className="text-warning" />
                {/* Deux lignes : libelle d'action + delai restant en appui. */}
                <span className="flex flex-col">
                  <span>{t('serviceRequests.cancel')}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {`Temps restant: ${Math.round(getRemainingCancellationTime(selectedServiceRequest.createdAt))}h`}
                  </span>
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dialogs */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
          requestTitle={selectedRequestForDeletion?.title}
          t={t}
        />

        <StatusChangeDialog
          open={statusChangeDialogOpen}
          onClose={() => { if (!changingStatus) setStatusChangeDialogOpen(false); }}
          onConfirm={confirmStatusChange}
          requestTitle={selectedRequestForStatusChange?.title}
          newStatus={newStatus}
          pending={changingStatus}
          onStatusChange={setNewStatus}
          statuses={statuses.filter(s =>
            s.value === selectedRequestForStatusChange?.status ||
            (s.value === "REJECTED" && selectedRequestForStatusChange?.status === "PENDING") ||
            (s.value === "CANCELLED" && ["PENDING", "ASSIGNED", "AWAITING_PAYMENT", "IN_PROGRESS"].includes(selectedRequestForStatusChange?.status ?? ""))
          )}
          t={t}
        />

        <AssignDialog
          open={assignDialogOpen}
          onClose={closeAssignDialog}
          onConfirm={confirmAssignment}
          selectedRequest={selectedRequestForAssignment}
          assignmentType={assignAssignmentType}
          onAssignmentTypeChange={setAssignAssignmentType}
          selectedTeamId={assignSelectedTeamId}
          onTeamChange={setAssignSelectedTeamId}
          selectedUserId={assignSelectedUserId}
          onUserChange={setAssignSelectedUserId}
          teams={assignTeams}
          users={assignUsers}
          loadingData={loadingAssignData}
          assigning={assigning}
          t={t}
        />

        <ErrorDialog
          open={errorDialogOpen}
          onClose={() => setErrorDialogOpen(false)}
          message={errorMessage}
          t={t}
        />

        <SuccessDialog
          open={successDialogOpen}
          onClose={() => setSuccessDialogOpen(false)}
          message={successMessage}
          t={t}
        />
      </div>
    </>
  );
}
