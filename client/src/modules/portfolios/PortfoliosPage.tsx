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
            options={[
              {
                label: t('portfolios.tabs.myPortfolios'),
                icon: <BusinessIcon />,
              },
              { label: t('portfolios.tabs.teamManagement'), icon: <Group /> },
              { label: t('portfolios.tabs.statistics'), icon: <BarChart /> },
            ]}
            value={tabValue}
            onChange={handleTabChange}
            ariaLabel="portfolios tabs"
            mb={0}
          />
        </div>

        {/* ─── Tab 0: My Portfolios ─────────────────────────────────────── */}
        <TabPanel value={tabValue} index={0}>
          {error ? (
            <p className="text-sm text-destructive text-center py-6">
              {error}
            </p>
          ) : (
            <div className="grid grid-cols-12 gap-[18px]">
              {/* Clients */}
              <div className="col-span-12 min-[900px]:col-span-6 flex flex-col">
                <SectionHeader
                  icon={<Person size={20} strokeWidth={1.75} />}
                  title={t('portfolios.sections.clients')}
                  count={clients.length}
                />
                {clients.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {clients.map((client) => (
                      <Card
                        key={client.id}
                        className={ROW_CARD_CLASS}
                      >
                        <CardContent className="py-[9px] px-3">
                          <div className="flex items-center">
                            <Avatar className="size-8 rounded-[10px] after:rounded-[10px] me-1.5">
                              <AvatarFallback className="rounded-[10px] bg-primary text-primary-foreground [font-family:var(--font-display)] text-[0.7rem] font-semibold">
                                {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h6 className="text-[0.85rem] font-semibold truncate">
                                {client.firstName} {client.lastName}
                              </h6>
                              <span className="text-[0.72rem] text-muted-foreground truncate">
                                {client.email}
                              </span>
                            </div>
                            <div className="flex items-center gap-[3px] ms-1.5">
                              <StatusChip tone={ROLE_TONE[getRoleColor(client.role)] ?? 'neutral'} label={getRoleLabel(client.role)} className="text-[0.65rem]" />
                              <Tooltip>
                                {/* Radix pose sa ref d'ancrage sur l'enfant : un <span> hote,
                                    le Button du kit ne transmettant pas de ref (React 18). */}
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => setEditingClient(client)}
                                      aria-label={t('portfolios.fields.reassignClient')}
                                      className="text-primary"
                                    >
                                      <EditIcon size={16} strokeWidth={1.75} />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{t('portfolios.fields.reassignClient')}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => handleUnassignClient(client.id)}
                                      aria-label={t('portfolios.fields.unassignClient')}
                                      className="text-destructive"
                                    >
                                      <DeleteIcon size={16} strokeWidth={1.75} />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{t('portfolios.fields.unassignClient')}</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          {client.phoneNumber && (
                            <div className="flex items-center mt-[4.5px] ms-[33px]">
                              <span className="inline-flex text-muted-foreground me-0.5"><Phone size={14} strokeWidth={1.75} /></span>
                              <span className="text-[0.7rem] text-muted-foreground">
                                {client.phoneNumber}
                              </span>
                            </div>
                          )}
                          <span className="block mt-0.5 ms-8 text-[0.65rem] text-muted-foreground">
                            {t('portfolios.fields.associatedOn')} {formatDate(client.associatedAt)}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Person />}
                    title={t('portfolios.fields.noClientAssociated')}
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClientAssignment}
                      >
                        <AssignmentIcon strokeWidth={1.75} />
                        {t('portfolios.associateClientsProperties')}
                      </Button>
                    }
                  />
                )}
              </div>

              {/* Properties grouped by client */}
              <div className="col-span-12 min-[900px]:col-span-6 flex flex-col">
                <SectionHeader
                  icon={<Home size={20} strokeWidth={1.75} />}
                  title={t('portfolios.sections.propertiesByClient')}
                  count={properties.length}
                  color="#7B68A8"
                />
                {clients.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {clients.map((client) => {
                      const clientProperties = properties.filter(prop => prop.ownerId === client.id);
                      return (
                        <div key={client.id}>
                          <div className="flex items-center justify-between mb-[4.5px] cursor-pointer hover:opacity-80" onClick={() => toggleClientExpansion(client.id)}>
                            <div className="flex items-center gap-1">
                              <Avatar className="size-6 rounded-[8px] after:rounded-[8px]">
                                <AvatarFallback className="rounded-md bg-primary text-primary-foreground [font-family:var(--font-display)] text-[0.55rem] font-semibold">
                                  {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <h6 className="text-primary text-xs font-semibold">
                                {client.firstName} {client.lastName}
                              </h6>
                              <Badge variant="secondary" className="h-[20px] text-[0.65rem] text-primary bg-primary-soft tabular-nums">{`${clientProperties.length} ${t('portfolios.fields.properties')}`}</Badge>
                            </div>
                            {/* Chevron purement indicatif : le clic est porte par la rangee entiere.
                                Un <span> evite d'imbriquer un bouton dans une zone deja cliquable. */}
                            <span className="inline-flex p-0.5 text-primary" aria-hidden>
                              {expandedClients.has(client.id) ? (
                                <ExpandLessIcon size={18} strokeWidth={1.75} />
                              ) : (
                                <ExpandMoreIcon size={18} strokeWidth={1.75} />
                              )}
                            </span>
                          </div>

                          {clientProperties.length > 0 ? (
                            expandedClients.has(client.id) ? (
                              <div className="flex flex-col gap-1.5 ms-1.5">
                                {clientProperties.map((property) => (
                                  <Card
                                    key={property.id}
                                    className={NESTED_ROW_CARD_CLASS}
                                  >
                                    <CardContent className="py-[7.5px] px-[9px]">
                                      <div className="flex items-start">
                                        <Avatar className="size-7 rounded-[8px] after:rounded-[8px] me-[7.5px]">
                                          <AvatarFallback className="rounded-[8px] bg-[#7B68A818] text-[#7B68A8]">
                                            <Home size={14} strokeWidth={1.75} />
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <h6 className="text-xs font-semibold truncate">
                                            {property.name}
                                          </h6>
                                          <div className="flex items-center">
                                            <span className="inline-flex text-muted-foreground me-0.5"><LocationOn size={13} strokeWidth={1.75} /></span>
                                            <span className="text-[0.7rem] text-muted-foreground truncate">
                                              {property.address}, {property.city}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-[3px] ms-[3px] flex-wrap">
                                          <Badge variant="secondary" className="h-[20px] text-[0.6rem]">{property.type}</Badge>
                                          {propertyTeamMap.get(property.id) ? (
                                            <StatusChip
                                              tone="ok"
                                              icon={<Group size={13} strokeWidth={1.75} />}
                                              label={propertyTeamMap.get(property.id)!.teamName}
                                              onDelete={() => handleRemoveTeamFromProperty(property.id)}
                                              deleteLabel={t('portfolios.confirmations.unassignTeamTitle')}
                                              className="h-[20px] text-[0.6rem]"
                                            />
                                          ) : (
                                            <DropdownMenu>
                                              {/* Le menu vit avec sa pastille : chaque bien porte son propre
                                                  declencheur, ce qui remplace l'ancien couple anchorEl + ref. */}
                                              <DropdownMenuTrigger asChild>
                                                <span className="inline-flex">
                                                  <Badge variant="outline" className="h-[20px] text-[0.6rem] cursor-pointer"><Group size={13} strokeWidth={1.75} />{t('portfolios.fields.assignTeam')}</Badge>
                                                </span>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="w-auto min-w-[200px]">
                                                <DropdownMenuLabel>{t('portfolios.fields.assignTeam')}</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {teams.length > 0 ? teams.map((team) => (
                                                  <DropdownMenuItem
                                                    key={team.id}
                                                    onSelect={() => handleAssignTeamToProperty(property.id, team.id)}
                                                  >
                                                    <span className="inline-flex text-success me-1.5"><Group size={16} strokeWidth={1.75} /></span>
                                                    {team.name}
                                                  </DropdownMenuItem>
                                                )) : (
                                                  <DropdownMenuItem disabled>
                                                    {t('portfolios.fields.noTeamAssigned')}
                                                  </DropdownMenuItem>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          )}
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="inline-flex">
                                                <Button
                                                  variant="ghost"
                                                  size="icon-xs"
                                                  onClick={() => handleUnassignProperty(property.id)}
                                                  aria-label={t('portfolios.fields.unassignProperty')}
                                                  className="text-destructive"
                                                >
                                                  <DeleteIcon size={14} strokeWidth={1.75} />
                                                </Button>
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('portfolios.fields.unassignProperty')}</TooltipContent>
                                          </Tooltip>
                                        </div>
                                      </div>
                                      <span className="block mt-0.5 ms-7 text-[0.62rem] text-muted-foreground">
                                        {t('portfolios.fields.createdOn')} {formatDate(property.createdAt)}
                                      </span>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <span className="ms-6 italic text-[0.72rem] text-muted-foreground">
                                {t('portfolios.fields.clickArrowToSee', { count: clientProperties.length })}
                              </span>
                            )
                          ) : (
                            <span className="ms-6 italic text-[0.72rem] text-muted-foreground">
                              {t('portfolios.fields.noClientAssociated')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Home />}
                    title={t('portfolios.fields.noClientAssociated')}
                  />
                )}
              </div>
            </div>
          )}
        </TabPanel>

        {/* ─── Tab 1: Teams & Users ─────────────────────────────────────── */}
        <TabPanel value={tabValue} index={1}>
          <div className="grid grid-cols-12 gap-[18px]">
            {/* Teams */}
            <div className="col-span-12 min-[900px]:col-span-6">
              <SectionHeader
                icon={<Group size={20} strokeWidth={1.75} />}
                title={t('teams.title')}
                count={teams.length}
                color="var(--bui-success)"
              />
              {teams.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {teams.map((team) => (
                    <Card
                      key={team.id}
                      className={ROW_CARD_CLASS}
                    >
                      <CardContent className="py-[9px] px-3">
                        <div className="flex items-center">
                          <Avatar className="size-8 rounded-[10px] after:rounded-[10px] me-1.5">
                            <AvatarFallback className="rounded-[10px] bg-success-soft text-success">
                              <Group size={16} strokeWidth={1.75} />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h6 className="text-[0.85rem] font-semibold truncate">
                              {team.name}
                            </h6>
                            <span className="text-[0.72rem] text-muted-foreground">
                              {team.memberCount} {t('portfolios.fields.members')}
                            </span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => handleUnassignTeam(team.id)}
                                  aria-label={t('portfolios.confirmations.unassignTeamTitle')}
                                  className="text-destructive"
                                >
                                  <DeleteIcon size={16} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t('portfolios.confirmations.unassignTeamTitle')}</TooltipContent>
                          </Tooltip>
                        </div>
                        {team.description && (
                          <span className="block mt-0.5 ms-8 text-[0.72rem] text-muted-foreground">
                            {team.description}
                          </span>
                        )}
                        <span className="block mt-0.5 ms-8 text-[0.62rem] text-muted-foreground">
                          {t('portfolios.fields.createdOn')} {formatDate(team.assignedAt)}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Group />}
                  title={t('portfolios.fields.noClientAssociated')}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTeamAssignment}
                    >
                      <PeopleIcon strokeWidth={1.75} />
                      {t('portfolios.associateTeamsUsers')}
                    </Button>
                  }
                />
              )}
            </div>

            {/* Users */}
            <div className="col-span-12 min-[900px]:col-span-6">
              <SectionHeader
                icon={<Person size={20} strokeWidth={1.75} />}
                title={t('users.title')}
                count={users.length}
                color="var(--bui-warning)"
              />
              {users.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {users.map((portfolioUser) => (
                    <Card
                      key={portfolioUser.id}
                      className={ROW_CARD_CLASS}
                    >
                      <CardContent className="py-[9px] px-3">
                        <div className="flex items-center">
                          <Avatar className="size-8 rounded-[10px] after:rounded-[10px] me-1.5">
                            <AvatarFallback className="rounded-[10px] bg-warning-soft text-warning [font-family:var(--font-display)] text-[0.7rem] font-semibold">
                              {portfolioUser.firstName.charAt(0)}{portfolioUser.lastName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h6 className="text-[0.85rem] font-semibold truncate">
                              {portfolioUser.firstName} {portfolioUser.lastName}
                            </h6>
                            <span className="text-[0.72rem] text-muted-foreground truncate">
                              {portfolioUser.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-[3px] ms-1.5">
                            <StatusChip tone={ROLE_TONE[getRoleColor(portfolioUser.role)] ?? 'neutral'} label={getRoleLabel(portfolioUser.role)} className="text-[0.65rem]" />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => handleUnassignUser(portfolioUser.id)}
                                    aria-label={t('portfolios.confirmations.unassignUserTitle')}
                                    className="text-destructive"
                                  >
                                    <DeleteIcon size={16} strokeWidth={1.75} />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{t('portfolios.confirmations.unassignUserTitle')}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <span className="block mt-0.5 ms-8 text-[0.62rem] text-muted-foreground">
                          {t('portfolios.fields.associatedOn')} {formatDate(portfolioUser.assignedAt)}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Person />}
                  title={t('portfolios.fields.noClientAssociated')}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTeamAssignment}
                    >
                      <PeopleIcon strokeWidth={1.75} />
                      {t('portfolios.associateTeamsUsers')}
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </TabPanel>

        {/* ─── Tab 2: Statistics ─────────────────────────────────────────── */}
        <TabPanel value={tabValue} index={2}>
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
