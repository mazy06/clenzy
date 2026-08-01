import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
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
import ConfirmationModal from '../../components/ConfirmationModal';
import PortfolioStatsTab from './PortfolioStatsTab';
import { ReassignmentDialog } from './PortfoliosDialogs';
import { usePortfoliosPage } from './usePortfoliosPage';
import PageTabs from '../../components/PageTabs';

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

// Couleur semantique → tokens (chips -soft : texte couleur + fond -soft)
const SEM_CHIP_TOKEN: Record<string, { fg: string; bg: string }> = {
  primary: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
  secondary: { fg: '#7B68A8', bg: '#7B68A818' },
  success: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  warning: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  error: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  info: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  default: { fg: 'var(--muted)', bg: 'var(--hover)' },
};
const semChip = (c: string) => SEM_CHIP_TOKEN[c] ?? SEM_CHIP_TOKEN.default;

// Le contour de la Card du kit est un `ring`, pas un `border` : le survol se joue
// donc sur la couleur de l'anneau, et la transition porte sur box-shadow.
const ROW_CARD_CLASS =
  'gap-0 py-[9px] rounded-[16px] ring-[var(--line)] transition-[box-shadow] duration-200 '
  + 'hover:ring-[var(--line-2)] motion-reduce:transition-none';

const NESTED_ROW_CARD_CLASS =
  'gap-0 py-[7.5px] rounded-[12px] ring-[var(--line)] transition-[box-shadow] duration-200 '
  + 'hover:ring-[var(--line-2)] motion-reduce:transition-none';

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  color?: string;
}

function SectionHeader({ icon, title, count, color = 'var(--accent)' }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {/* `color` est une prop : aucune classe Tailwind ne peut en naitre. */}
      <span className="flex items-center" style={{ color }}>{icon}</span>
      <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem]">
        {title}
      </h6>
      <Badge variant="secondary" className="h-[22px] text-[0.7rem] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] tabular-nums">{count}</Badge>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-[30px] text-center border border-dashed border-[var(--line-2)] bg-[var(--field)] rounded-[12px] flex-1">
      <div className="text-muted-foreground opacity-60 mb-1.5">{icon}</div>
      <p className={cn('cn-text-body2 text-[var(--muted)] text-[0.85rem]', action ? 'mb-3' : 'mb-0')}>
        {message}
      </p>
      {action}
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
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

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
        <div className="border-b border-solid border-[var(--line)]">
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
            <p className="cn-text-body1 text-destructive text-center py-6 text-[0.85rem]">
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
                              <AvatarFallback className="rounded-[10px] bg-[var(--accent)] text-[var(--on-accent)] [font-family:var(--font-display)] text-[0.7rem] font-semibold">
                                {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h6 className="cn-text-subtitle2 text-[0.85rem] font-semibold truncate">
                                {client.firstName} {client.lastName}
                              </h6>
                              <span className="cn-text-caption text-muted-foreground text-[0.72rem] truncate">
                                {client.email}
                              </span>
                            </div>
                            <div className="flex items-center gap-[3px] ms-1.5">
                              <StatusChip tokens={{ color: semChip(getRoleColor(client.role)).fg, bg: semChip(getRoleColor(client.role)).bg }} label={getRoleLabel(client.role)} className="text-[0.65rem]" />
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
                                      className="text-[var(--accent)]"
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
                                      className="text-[var(--err)]"
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
                              <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                                {client.phoneNumber}
                              </span>
                            </div>
                          )}
                          <span className="cn-text-caption text-muted-foreground block mt-0.5 ms-8 text-[0.65rem]">
                            {t('portfolios.fields.associatedOn')} {formatDate(client.associatedAt)}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Person size={40} strokeWidth={1.75} />}
                    message={t('portfolios.fields.noClientAssociated')}
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
                                <AvatarFallback className="rounded-[8px] bg-[var(--accent)] text-[var(--on-accent)] [font-family:var(--font-display)] text-[0.55rem] font-semibold">
                                  {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <h6 className="cn-text-subtitle2 text-primary text-[0.82rem] font-semibold">
                                {client.firstName} {client.lastName}
                              </h6>
                              <Badge variant="secondary" className="h-[20px] text-[0.65rem] text-[var(--accent)] bg-[var(--accent-soft)] tabular-nums">{`${clientProperties.length} ${t('portfolios.fields.properties')}`}</Badge>
                            </div>
                            {/* Chevron purement indicatif : le clic est porte par la rangee entiere.
                                Un <span> evite d'imbriquer un bouton dans une zone deja cliquable. */}
                            <span className="inline-flex p-0.5 text-[var(--accent)]" aria-hidden>
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
                                          <h6 className="cn-text-subtitle2 text-[0.82rem] font-semibold truncate">
                                            {property.name}
                                          </h6>
                                          <div className="flex items-center">
                                            <span className="inline-flex text-muted-foreground me-0.5"><LocationOn size={13} strokeWidth={1.75} /></span>
                                            <span className="cn-text-caption text-muted-foreground text-[0.7rem] truncate">
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
                                                    <span className="inline-flex text-[var(--ok)] me-1.5"><Group size={16} strokeWidth={1.75} /></span>
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
                                                  className="text-[var(--err)]"
                                                >
                                                  <DeleteIcon size={14} strokeWidth={1.75} />
                                                </Button>
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('portfolios.fields.unassignProperty')}</TooltipContent>
                                          </Tooltip>
                                        </div>
                                      </div>
                                      <span className="cn-text-caption text-muted-foreground block mt-0.5 ms-7 text-[0.62rem]">
                                        {t('portfolios.fields.createdOn')} {formatDate(property.createdAt)}
                                      </span>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <span className="cn-text-caption text-muted-foreground ms-6 italic text-[0.72rem]">
                                {t('portfolios.fields.clickArrowToSee', { count: clientProperties.length })}
                              </span>
                            )
                          ) : (
                            <span className="cn-text-caption text-muted-foreground ms-6 italic text-[0.72rem]">
                              {t('portfolios.fields.noClientAssociated')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Home size={40} strokeWidth={1.75} />}
                    message={t('portfolios.fields.noClientAssociated')}
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
                color="var(--ok)"
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
                            <AvatarFallback className="rounded-[10px] bg-[var(--ok-soft)] text-[var(--ok)]">
                              <Group size={16} strokeWidth={1.75} />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h6 className="cn-text-subtitle2 text-[0.85rem] font-semibold truncate">
                              {team.name}
                            </h6>
                            <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
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
                                  className="text-[var(--err)]"
                                >
                                  <DeleteIcon size={16} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t('portfolios.confirmations.unassignTeamTitle')}</TooltipContent>
                          </Tooltip>
                        </div>
                        {team.description && (
                          <span className="cn-text-caption text-muted-foreground block mt-0.5 ms-8 text-[0.72rem]">
                            {team.description}
                          </span>
                        )}
                        <span className="cn-text-caption text-muted-foreground block mt-0.5 ms-8 text-[0.62rem]">
                          {t('portfolios.fields.createdOn')} {formatDate(team.assignedAt)}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Group size={40} strokeWidth={1.75} />}
                  message={t('portfolios.fields.noClientAssociated')}
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
                color="var(--warn)"
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
                            <AvatarFallback className="rounded-[10px] bg-[var(--warn-soft)] text-[var(--warn)] [font-family:var(--font-display)] text-[0.7rem] font-semibold">
                              {portfolioUser.firstName.charAt(0)}{portfolioUser.lastName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h6 className="cn-text-subtitle2 text-[0.85rem] font-semibold truncate">
                              {portfolioUser.firstName} {portfolioUser.lastName}
                            </h6>
                            <span className="cn-text-caption text-muted-foreground text-[0.72rem] truncate">
                              {portfolioUser.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-[3px] ms-1.5">
                            <StatusChip tokens={{ color: semChip(getRoleColor(portfolioUser.role)).fg, bg: semChip(getRoleColor(portfolioUser.role)).bg }} label={getRoleLabel(portfolioUser.role)} className="text-[0.65rem]" />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => handleUnassignUser(portfolioUser.id)}
                                    aria-label={t('portfolios.confirmations.unassignUserTitle')}
                                    className="text-[var(--err)]"
                                  >
                                    <DeleteIcon size={16} strokeWidth={1.75} />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{t('portfolios.confirmations.unassignUserTitle')}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <span className="cn-text-caption text-muted-foreground block mt-0.5 ms-8 text-[0.62rem]">
                          {t('portfolios.fields.associatedOn')} {formatDate(portfolioUser.assignedAt)}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Person size={40} strokeWidth={1.75} />}
                  message={t('portfolios.fields.noClientAssociated')}
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
