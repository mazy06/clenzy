import React, { useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card as BuiCard } from '../../components/ui';
import { createPortal } from 'react-dom';
import { Grid, Card, CardContent, Avatar, IconButton, Tooltip, Divider, Menu, MenuItem } from '@mui/material';
import { Button } from '../../components/ui';
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

  // ── Team menu state (for assigning team to property) ────────────────────
  const [teamMenuAnchor, setTeamMenuAnchor] = useState<null | HTMLElement>(null);
  // Propriete cible du menu equipe : lue uniquement dans les handlers du menu
  // (l'ouverture est pilotee par teamMenuAnchor) : ref, pas de re-render.
  const teamMenuPropertyIdRef = useRef<number | null>(null);

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
            <Grid container spacing={3}>
              {/* Clients */}
              <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
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
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          transition: 'border-color 0.2s ease',
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                          '&:hover': { borderColor: 'var(--line-2)' },
                        }}
                      >
                        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                          <div className="flex items-center">
                            <Avatar
                              sx={{
                                bgcolor: 'var(--accent)',
                                color: 'var(--on-accent)',
                                fontFamily: 'var(--font-display)',
                                borderRadius: '10px',
                                width: 32,
                                height: 32,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                mr: 1.5,
                              }}
                            >
                              {client.firstName.charAt(0)}{client.lastName.charAt(0)}
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
                              <Tooltip title={t('portfolios.fields.reassignClient')}>
                                <IconButton
                                  size="small"
                                  onClick={() => setEditingClient(client)}
                                  sx={{ color: 'var(--accent)', p: 0.5 }}
                                >
                                  <EditIcon size={16} strokeWidth={1.75} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('portfolios.fields.unassignClient')}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleUnassignClient(client.id)}
                                  sx={{ color: 'var(--err)', p: 0.5 }}
                                >
                                  <DeleteIcon size={16} strokeWidth={1.75} />
                                </IconButton>
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
              </Grid>

              {/* Properties grouped by client */}
              <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
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
                              <Avatar
                                sx={{
                                  width: 24,
                                  height: 24,
                                  fontSize: '0.55rem',
                                  fontFamily: 'var(--font-display)',
                                  fontWeight: 600,
                                  bgcolor: 'var(--accent)',
                                  color: 'var(--on-accent)',
                                  borderRadius: '8px',
                                }}
                              >
                                {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                              </Avatar>
                              <h6 className="cn-text-subtitle2 text-primary text-[0.82rem] font-semibold">
                                {client.firstName} {client.lastName}
                              </h6>
                              <Badge variant="secondary" className="h-[20px] text-[0.65rem] text-[var(--accent)] bg-[var(--accent-soft)] tabular-nums">{`${clientProperties.length} ${t('portfolios.fields.properties')}`}</Badge>
                            </div>
                            <IconButton size="small" sx={{ color: 'var(--accent)', p: 0.25 }}>
                              {expandedClients.has(client.id) ? (
                                <ExpandLessIcon size={18} strokeWidth={1.75} />
                              ) : (
                                <ExpandMoreIcon size={18} strokeWidth={1.75} />
                              )}
                            </IconButton>
                          </div>

                          {clientProperties.length > 0 ? (
                            expandedClients.has(client.id) ? (
                              <div className="flex flex-col gap-1.5 ms-1.5">
                                {clientProperties.map((property) => (
                                  <Card
                                    key={property.id}
                                    variant="outlined"
                                    sx={{
                                      borderRadius: 1.5,
                                      transition: 'border-color 0.2s',
                                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                                      '&:hover': { borderColor: 'var(--line-2)' },
                                    }}
                                  >
                                    <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
                                      <div className="flex items-start">
                                        <Avatar
                                          sx={{
                                            bgcolor: '#7B68A818',
                                            color: '#7B68A8',
                                            borderRadius: '8px',
                                            width: 28,
                                            height: 28,
                                            mr: 1.25,
                                          }}
                                        >
                                          <Home size={14} strokeWidth={1.75} />
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
                                            <Badge variant="outline" className="h-[20px] text-[0.6rem] cursor-pointer" onClick={(e) => {
                                                setTeamMenuAnchor(e.currentTarget);
                                                teamMenuPropertyIdRef.current = property.id;
                                              }}><Group size={13} strokeWidth={1.75} />{t('portfolios.fields.assignTeam')}</Badge>
                                          )}
                                          <Tooltip title={t('portfolios.fields.unassignProperty')}>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleUnassignProperty(property.id)}
                                              sx={{ color: 'var(--err)', p: 0.25 }}
                                            >
                                              <DeleteIcon size={14} strokeWidth={1.75} />
                                            </IconButton>
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
              </Grid>
            </Grid>
          )}
        </TabPanel>

        {/* ─── Tab 1: Teams & Users ─────────────────────────────────────── */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            {/* Teams */}
            <Grid item xs={12} md={6}>
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
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        transition: 'border-color 0.2s ease',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        '&:hover': { borderColor: 'var(--line-2)' },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <div className="flex items-center">
                          <Avatar
                            sx={{
                              bgcolor: 'var(--ok-soft)',
                              color: 'var(--ok)',
                              borderRadius: '10px',
                              width: 32,
                              height: 32,
                              mr: 1.5,
                            }}
                          >
                            <Group size={16} strokeWidth={1.75} />
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h6 className="cn-text-subtitle2 text-[0.85rem] font-semibold truncate">
                              {team.name}
                            </h6>
                            <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                              {team.memberCount} {t('portfolios.fields.members')}
                            </span>
                          </div>
                          <Tooltip title={t('portfolios.confirmations.unassignTeamTitle')}>
                            <IconButton
                              size="small"
                              onClick={() => handleUnassignTeam(team.id)}
                              sx={{ color: 'var(--err)', p: 0.5 }}
                            >
                              <DeleteIcon size={16} strokeWidth={1.75} />
                            </IconButton>
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
            </Grid>

            {/* Users */}
            <Grid item xs={12} md={6}>
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
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        transition: 'border-color 0.2s ease',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        '&:hover': { borderColor: 'var(--line-2)' },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <div className="flex items-center">
                          <Avatar
                            sx={{
                              bgcolor: 'var(--warn-soft)',
                              color: 'var(--warn)',
                              fontFamily: 'var(--font-display)',
                              borderRadius: '10px',
                              width: 32,
                              height: 32,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              mr: 1.5,
                            }}
                          >
                            {portfolioUser.firstName.charAt(0)}{portfolioUser.lastName.charAt(0)}
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
                            <Tooltip title={t('portfolios.confirmations.unassignUserTitle')}>
                              <IconButton
                                size="small"
                                onClick={() => handleUnassignUser(portfolioUser.id)}
                                sx={{ color: 'var(--err)', p: 0.5 }}
                              >
                                <DeleteIcon size={16} strokeWidth={1.75} />
                              </IconButton>
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
            </Grid>
          </Grid>
        </TabPanel>

        {/* ─── Tab 2: Statistics ─────────────────────────────────────────── */}
        <TabPanel value={tabValue} index={2}>
          <PortfolioStatsTab />
        </TabPanel>
      </BuiCard>

      {/* Team selection menu for property assignment */}
      <Menu
        anchorEl={teamMenuAnchor}
        open={Boolean(teamMenuAnchor)}
        onClose={() => { setTeamMenuAnchor(null); teamMenuPropertyIdRef.current = null; }}
        slotProps={{
          paper: { sx: { borderRadius: 2, minWidth: 200 } },
        }}
      >
        <span className="cn-text-caption px-3 py-0.5 font-semibold text-[0.72rem] text-muted-foreground block">
          {t('portfolios.fields.assignTeam')}
        </span>
        <Divider sx={{ mb: 0.5 }} />
        {teams.length > 0 ? teams.map((team) => (
          <MenuItem
            key={team.id}
            onClick={() => {
              const targetPropertyId = teamMenuPropertyIdRef.current;
              if (targetPropertyId) {
                handleAssignTeamToProperty(targetPropertyId, team.id);
              }
              setTeamMenuAnchor(null);
              teamMenuPropertyIdRef.current = null;
            }}
            sx={{ fontSize: '0.82rem', py: 0.75 }}
          >
            <span className="inline-flex text-[var(--ok)] me-1.5"><Group size={16} strokeWidth={1.75} /></span>
            {team.name}
          </MenuItem>
        )) : (
          <MenuItem disabled sx={{ fontSize: '0.82rem' }}>
            {t('portfolios.fields.noTeamAssigned')}
          </MenuItem>
        )}
      </Menu>

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
