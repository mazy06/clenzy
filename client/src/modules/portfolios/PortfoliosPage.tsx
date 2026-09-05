import React from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Card as BuiCard,
} from '../../components/ui';
import { createPortal } from 'react-dom';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Person,
  Home,
  Group,
  Phone,
  LocationOn,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BarChart,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ConfirmationModal from '../../components/ConfirmationModal';
import PortfolioStatsTab from './PortfolioStatsTab';
import PortfolioByCity from './PortfolioByCity';
import { ReassignmentDialog } from './PortfoliosDialogs';
import { usePortfoliosPage } from './usePortfoliosPage';
import PageTabs from '../../components/PageTabs';
import compactHeaderActions from '../../components/compactHeaderActions';

// ─── Helper components ───────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`portfolios-tabpanel-${index}`}
      aria-labelledby={`portfolios-tab-${index}`}
      {...other}
    >
      {value === index && <div className="p-3.5">{children}</div>}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

// `getRoleColor` rend un nom de couleur semantique : on le transpose en ton de
// puce, le hook etant partage avec d'autres ecrans.
const ROLE_TONE: Record<string, StatusTone> = {
  primary: 'accent',
  secondary: 'neutral',
  success: 'ok',
  warning: 'warn',
  error: 'err',
  info: 'info',
  default: 'neutral',
};

// Le contour de la Card du kit est un `ring`, pas un `border` : le survol se joue
// donc sur la couleur de l'anneau, et la transition porte sur box-shadow.
// `--line` et `--line-2` tombent tous deux sur `border` cote Baitly UI : le
// survol prend donc la teinte primaire attenuee, sans quoi il serait inerte.
const ROW_CARD_CLASS =
  'gap-0 py-[9px] rounded-2xl ring-border transition-[box-shadow] duration-200 '
  + 'hover:ring-primary/40 motion-reduce:transition-none';

const NESTED_ROW_CARD_CLASS =
  'gap-0 py-[7.5px] rounded-xl ring-border transition-[box-shadow] duration-200 '
  + 'hover:ring-primary/40 motion-reduce:transition-none';

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  color?: string;
}

function SectionHeader({ icon, title, count, color = 'var(--bui-primary)' }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {/* `color` est une prop : aucune classe Tailwind ne peut en naitre. */}
      <span className="flex items-center" style={{ color }}>{icon}</span>
      <h6 className="text-sm font-semibold tracking-tight">
        {title}
      </h6>
      <Badge variant="secondary" className="h-[22px] text-[0.7rem] font-semibold text-primary bg-primary-soft tabular-nums">{count}</Badge>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface PortfoliosPageProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
}

const PortfoliosPage: React.FC<PortfoliosPageProps> = ({ embedded = false, actionsContainer }) => {
  const {
    canView,
    t,
    tabValue,
    handleTabChange,
    clients,
    properties,
    teams,
    users,
    loading,
    error,
    managers,
    reassignLoading,
    expandedClients,
    editingClient,
    setEditingClient,
    handleClientAssignment,
    handleTeamAssignment,
    toggleClientExpansion,
    handleReassignClient,
    handleUnassignClient,
    handleUnassignTeam,
    handleUnassignUser,
    handleUnassignProperty,
    propertyTeamMap,
    handleAssignTeamToProperty,
    handleRemoveTeamFromProperty,
    confirmationModal,
    closeConfirmationModal,
    formatDate,
    getRoleColor,
    getRoleLabel,
  } = usePortfoliosPage();

  if (!canView) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  const actionButtons = (
    <div className="flex gap-1.5">
      {/* Deux associations de meme poids dans l'en-tete : outline des deux
          cotes, aucune n'est l'action attendue par defaut. */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleClientAssignment}
        title={t('portfolios.associateClientsProperties')}
      >
        <AssignmentIcon strokeWidth={1.75} />
        {t('portfolios.associateClientsProperties')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleTeamAssignment}
        title={t('portfolios.associateTeamsUsers')}
      >
        <PeopleIcon strokeWidth={1.75} />
        {t('portfolios.associateTeamsUsers')}
      </Button>
    </div>
  );

  return (
    <div>
      {/* Portal actions into parent's PageHeader when embedded */}
      {embedded && actionsContainer && createPortal(compactHeaderActions(actionButtons), actionsContainer)}

      {!embedded && (
        <PageHeader
          title={t('portfolios.title')}
          subtitle={t('portfolios.subtitle')}
          iconBadge={<BusinessIcon />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
        />
      )}

      <BuiCard className="gap-0 py-0 w-full mt-3 overflow-hidden">
        <div className="border-b border-solid border-border">
          <PageTabs
            // « Mes Portefeuilles » et « Gestion des Équipes » fusionnent : leurs
            // deux listes parallèles decrivaient les cotes d'une meme relation,
            // que ni l'une ni l'autre ne montrait. Un seul onglet, organise par
            // ville — l'axe par lequel le parc est reellement dispatche.
            options={[
              { label: t('portfolios.tabs.portfolio', 'Portefeuille'), icon: <BusinessIcon /> },
              { label: t('portfolios.tabs.statistics'), icon: <BarChart /> },
            ]}
            value={tabValue}
            onChange={handleTabChange}
            ariaLabel="portfolios tabs"
            mb={0}
          />
        </div>

        {/* ─── Onglet 0 : le portefeuille, par ville ────────────────────── */}
        <TabPanel value={tabValue} index={0}>
          {error ? (
            <p className="text-sm text-destructive text-center py-6">{error}</p>
          ) : (
            <div className="p-3">
              <PortfolioByCity
                clients={clients}
                properties={properties}
                teams={teams}
                users={users}
                loading={loading}
                onAssignProperties={handleClientAssignment}
                onAssignStaff={handleTeamAssignment}
              />
            </div>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PortfolioStatsTab />
        </TabPanel>
      </BuiCard>

      {/* Reassignment dialog */}
      <ReassignmentDialog
        open={!!editingClient}
        onClose={() => setEditingClient(null)}
        client={editingClient}
        onReassign={handleReassignClient}
        managers={managers}
        loading={reassignLoading}
      />

      {/* Confirmation modal for unassignments */}
      <ConfirmationModal
        open={confirmationModal.open}
        onClose={closeConfirmationModal}
        onConfirm={confirmationModal.onConfirm}
        title={confirmationModal.title}
        message={confirmationModal.message}
        severity={confirmationModal.severity}
        confirmText={t('portfolios.fields.unassignClient')}
        cancelText={t('common.cancel')}
      />
    </div>
  );
};

export default PortfoliosPage;
