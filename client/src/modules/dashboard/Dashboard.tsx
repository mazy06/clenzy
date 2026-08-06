import React, { useState, useMemo } from 'react';
import { Badge } from '../../components/ui';
import {
  Dashboard as DashboardIcon,
  Calculate as CalculateIcon,
  Sync as SyncIcon,
} from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import DashboardDateFilter from './DashboardDateFilter';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import DashboardOverview from './DashboardOverview';
import UpgradeBanner from './UpgradeBanner';
import { getVisibleTabs } from '../../config/dashboardConfig';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from 'lucide-react';
import { Button } from '../../components/ui';
import ChannexMappingDialog from '../settings/components/ChannexMappingDialog';
import type { DashboardPeriod, DateFilterOption } from './DashboardDateFilter';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { useDashboardActionItems } from '../../hooks/useDashboardOperations';
import { countActionItems } from '../../services/api/dashboardOperationsApi';
import PageTabs from '../../components/PageTabs';

// ─── Tab icon mapping ────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, React.ReactElement> = {
  overview: <DashboardIcon size={16} strokeWidth={1.75} />,
  simulator: <CalculateIcon size={16} strokeWidth={1.75} />,
};

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. dashboardTabMeta plus bas).

// ─── Tab helpers ────────────────────────────────────────────────────────────

// ─── Filter option configs ──────────────────────────────────────────────────

const PERIOD_OPTIONS: DateFilterOption<DashboardPeriod>[] = [
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'quarter', label: '90j' },
];

const EMPTY_INTERVENTIONS: Array<{ estimatedCost?: number; actualCost?: number; type: string; status: string; scheduledDate?: string; createdAt?: string }> = [];

// ─── Main component ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [tabValue, setTabValue] = useState(0);
  // Channel Manager : ouvre la modale guidee de distribution OTA (Channex).
  const [cmOpen, setCmOpen] = useState(false);
  const navigate = useNavigate();

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Roles
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;

  // Determine primary role for tab filtering
  const primaryRole = useMemo(() => {
    if (!user?.roles?.length) return '';
    const rolePriority = ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR', 'TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH'];
    return rolePriority.find((r) => user.roles.includes(r)) ?? user.roles[0];
  }, [user?.roles]);

  // Get visible tabs for this role
  const visibleTabs = useMemo(() => getVisibleTabs(primaryRole), [primaryRole]);

  // Get the tab key for the current selection
  const activeTabKey = visibleTabs[tabValue]?.key ?? 'overview';


  // ─── Titles ─────────────────────────────────────────────────────────────
  const getDashboardTitle = () => {
    if (isAdmin) return t('dashboard.titleAdmin');
    if (isManager) return t('dashboard.titleManager');
    if (isHost) return t('dashboard.titleHost');
    if (user?.roles?.includes('TECHNICIAN')) return t('dashboard.titleTechnician');
    if (user?.roles?.includes('HOUSEKEEPER')) return t('dashboard.titleHousekeeper');
    if (user?.roles?.includes('SUPERVISOR')) return t('dashboard.titleSupervisor');
    return t('dashboard.title');
  };

  const getDashboardDescription = () => {
    if (isAdmin) return t('dashboard.subtitleAdmin');
    if (isManager) return t('dashboard.subtitleManager');
    if (isHost) return t('dashboard.subtitleHost');
    if (user?.roles?.includes('TECHNICIAN')) return t('dashboard.subtitleTechnician');
    if (user?.roles?.includes('HOUSEKEEPER')) return t('dashboard.subtitleHousekeeper');
    if (user?.roles?.includes('SUPERVISOR')) return t('dashboard.subtitleSupervisor');
    return t('dashboard.subtitle');
  };

  // Resolution du title/subtitle en fonction du tab actif.
  // Title racine = role-based (getDashboardTitle), subtitle racine = role-based
  // (getDashboardDescription) — utilises comme fallback quand le tab n'a pas de meta.
  const visibleTabLabels = visibleTabs.map((tab) => t(tab.labelKey) || tab.key);
  // Sous-titre et badge de l'en-tête (projection §1.2 et §1.4).
  // Les deux hooks sont déjà montés par DashboardOverview : React Query
  // dédoublonne par clé de requête, il n'y a donc aucun appel supplémentaire.
  const { stats: headerStats } = useDashboardOverview({ period, t });
  const { data: headerActionItems } = useDashboardActionItems(activeTabKey === 'overview');
  const actionItemsCount = countActionItems(headerActionItems);

  /** « Mercredi 23 juillet · 4 logements actifs » — contexte du jour. */
  const overviewSubtitle = useMemo(() => {
    const today = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const dateLabel = today.charAt(0).toUpperCase() + today.slice(1);
    const active = headerStats?.properties.active;
    if (active === undefined) return dateLabel;
    return `${dateLabel} · ${active} ${t('dashboard.activePropertiesShort', 'logements actifs')}`;
  }, [headerStats?.properties.active, t]);

  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const dashboardTabMeta: Record<string, TabHeaderMeta> = {
    [t('dashboard.tabs.overview', "Vue d'ensemble")]: {
      // Contexte du jour plutôt qu'une description figée : sur un écran consulté
      // quotidiennement, la date et le parc actif valent mieux qu'un rappel de
      // ce que contient la page.
      subtitle: overviewSubtitle,
    },
  };
  const { title, subtitle } = resolveTabHeader(
    getDashboardTitle(),
    getDashboardDescription(),
    visibleTabLabels,
    tabValue,
    dashboardTabMeta,
  );

  // ─── Filtre de période — la vue d'ensemble est le seul onglet restant.
  const showDateFilter = activeTabKey === 'overview';
  const dateFilterElement = useMemo(() => {
    if (!showDateFilter) return null;
    return (
      <DashboardDateFilter<DashboardPeriod>
        value={period}
        onChange={setPeriod}
        options={PERIOD_OPTIONS}
      />
    );
  }, [showDateFilter, period]);

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <div className="flex flex-col h-full min-h-0">
        {/* ─── Header ────────────────────────────────────────────────────── */}
        <div className="shrink-0">
          <PageHeader
            title={title}
            subtitle={subtitle}
            iconBadge={<DashboardIcon />}
            titleAdornment={
              activeTabKey === 'overview' && actionItemsCount > 0 ? (
                <Badge variant="warning" className="h-[22px] text-2xs font-semibold tabular-nums">{`${actionItemsCount} ${t('dashboard.toHandle', 'à traiter')}`}</Badge>
              ) : undefined
            }
            backPath="/"
            showBackButton={false}
            actions={
              <div className="flex items-center gap-1">
                {headerActionsPortal}
                {dateFilterElement}
                {/* Action primaire de la projection : créer une réservation. */}
                <Button
                  size="sm"
                  onClick={() => navigate('/reservations/new')}
                >
                  <PlusIcon className="size-4" />
                  {t('dashboard.newReservation', 'Réservation')}
                </Button>
              </div>
            }
          />
        </div>

        {/* ─── Tabs (dynamic per role) ──────────────────────────────────── */}
        {visibleTabs.length > 1 && (
          <div className="shrink-0 border-b border-solid border-border bg-card">
            <PageTabs
              options={visibleTabs.map((tab) => ({
                key: tab.key,
                icon: TAB_ICONS[tab.key],
                label: t(tab.labelKey) || tab.key,
              }))}
              value={tabValue}
              onChange={setTabValue}
              mb={0}
            />
          </div>
        )}

        {/* ─── Tab content ────────────────────────────────────────────────── */}
        {activeTabKey === 'overview' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-auto pt-1.5" role="tabpanel" id="dashboard-tabpanel-0">
            {isHost && user?.forfait?.toLowerCase() === 'essentiel' && (
              <UpgradeBanner currentForfait={user.forfait} />
            )}
            <DashboardOverview period={period} />
          </div>
        )}


        {/* Channel Manager : modale guidee de distribution OTA (Channex).
            Mode guided = formulation end-user + degradation gracieuse. */}
        <ChannexMappingDialog open={cmOpen} guided onClose={() => setCmOpen(false)} />
      </div>
    </PageHeaderActionsProvider>
  );
};

export default Dashboard;
