import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
} from '@mui/material';
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
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import ConfirmationModal from '../../components/ConfirmationModal';
import PortfolioStatsTab from './PortfolioStatsTab';
import { ReassignmentDialog } from './PortfoliosDialogs';
import { usePortfoliosPage } from './usePortfoliosPage';

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
      {value === index && <Box sx={{ p: 2.5 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `portfolios-tab-${index}`,
    'aria-controls': `portfolios-tabpanel-${index}`,
  };
}

// ─── Section Header ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  color?: string;
}

function SectionHeader({ icon, title, count, color = 'primary.main' }: SectionHeaderProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
        {title}
      </Typography>
      <Chip
        label={count}
        size="small"
        color="primary"
        variant="outlined"
        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
      />
    </Box>
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 5,
        textAlign: 'center',
        border: '2px dashed',
        borderColor: 'grey.200',
        borderRadius: 2,
        flex: 1,
      }}
    >
      <Box sx={{ color: 'text.disabled', mb: 1 }}>{icon}</Box>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mb: action ? 2 : 0 }}>
        {message}
      </Typography>
      {action}
    </Box>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const PortfoliosPage: React.FC = () => {
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
  const [teamMenuPropertyId, setTeamMenuPropertyId] = useState<number | null>(null);

  if (!canView) {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t('portfolios.title')}
        subtitle={t('portfolios.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AssignmentIcon sx={{ fontSize: 16 }} />}
              onClick={handleClientAssignment}
              sx={{ fontSize: '0.8rem' }}
              title={t('portfolios.associateClientsProperties')}
            >
              {t('portfolios.associateClientsProperties')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PeopleIcon sx={{ fontSize: 16 }} />}
              onClick={handleTeamAssignment}
              sx={{ fontSize: '0.8rem' }}
              title={t('portfolios.associateTeamsUsers')}
            >
              {t('portfolios.associateTeamsUsers')}
            </Button>
          </Box>
        }
      />

      <Paper sx={{ width: '100%', mt: 2, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="portfolios tabs"
            sx={{
              px: 2,
              '& .MuiTab-root': {
                fontSize: '0.82rem',
                fontWeight: 500,
                textTransform: 'none',
                minHeight: 48,
                py: 1,
              },
            }}
          >
            <Tab
              label={t('portfolios.tabs.myPortfolios')}
              icon={<BusinessIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              label={t('portfolios.tabs.teamManagement')}
              icon={<Group sx={{ fontSize: 18 }} />}
              iconPosition="start"
              {...a11yProps(1)}
            />
            <Tab
              label={t('portfolios.tabs.statistics')}
              icon={<BarChart sx={{ fontSize: 18 }} />}
              iconPosition="start"
              {...a11yProps(2)}
            />
          </Tabs>
        </Box>

        {/* ─── Tab 0: My Portfolios ─────────────────────────────────────── */}
        <TabPanel value={tabValue} index={0}>
          {error ? (
            <Typography color="error" sx={{ textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
              {error}
            </Typography>
          ) : (
            <Grid container spacing={3}>
              {/* Clients */}
              <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                <SectionHeader
                  icon={<Person sx={{ fontSize: 20 }} />}
                  title={t('portfolios.sections.clients')}
                  count={clients.length}
                />
                {clients.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {clients.map((client) => (
                      <Card
                        key={client.id}
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            borderColor: 'primary.main',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 2px 8px rgba(107, 138, 154, 0.12)',
                          },
                        }}
                      >
                        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                          <Box display="flex" alignItems="center">
                            <Avatar
                              sx={{
                                bgcolor: 'primary.main',
                                width: 32,
                                height: 32,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                mr: 1.5,
                              }}
                            >
                              {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                            </Avatar>
                            <Box flex={1} minWidth={0}>
                              <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', fontWeight: 600 }} noWrap>
                                {client.firstName} {client.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }} noWrap>
                                {client.email}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={0.5} ml={1}>
                              <Chip
                                label={getRoleLabel(client.role)}
                                color={getRoleColor(client.role)}
                                size="small"
                                sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600 }}
                              />
                              <Tooltip title={t('portfolios.fields.reassignClient')}>
                                <IconButton
                                  size="small"
                                  onClick={() => setEditingClient(client)}
                                  sx={{ color: 'primary.main', p: 0.5 }}
                                >
                                  <EditIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('portfolios.fields.unassignClient')}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleUnassignClient(client.id)}
                                  sx={{ color: 'error.main', p: 0.5 }}
                                >
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                          {client.phoneNumber && (
                            <Box display="flex" alignItems="center" mt={0.75} ml={5.5}>
                              <Phone sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                {client.phoneNumber}
                              </Typography>
                            </Box>
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 5.5, fontSize: '0.65rem' }}>
                            {t('portfolios.fields.associatedOn')} {formatDate(client.associatedAt)}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                ) : (
                  <EmptyState
                    icon={<Person sx={{ fontSize: 40 }} />}
                    message={t('portfolios.fields.noClientAssociated')}
                    action={
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AssignmentIcon sx={{ fontSize: 14 }} />}
                        onClick={handleClientAssignment}
                        sx={{ fontSize: '0.78rem' }}
                      >
                        {t('portfolios.associateClientsProperties')}
                      </Button>
                    }
                  />
                )}
              </Grid>

              {/* Properties grouped by client */}
              <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                <SectionHeader
                  icon={<Home sx={{ fontSize: 20 }} />}
                  title={t('portfolios.sections.propertiesByClient')}
                  count={properties.length}
                  color="secondary.main"
                />
                {clients.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {clients.map((client) => {
                      const clientProperties = properties.filter(prop => prop.ownerId === client.id);
                      return (
                        <Box key={client.id}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 0.75,
                              cursor: 'pointer',
                              '&:hover': { opacity: 0.8 },
                            }}
                            onClick={() => toggleClientExpansion(client.id)}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Avatar
                                sx={{
                                  width: 24,
                                  height: 24,
                                  fontSize: '0.55rem',
                                  fontWeight: 600,
                                  bgcolor: 'primary.main',
                                }}
                              >
                                {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                              </Avatar>
                              <Typography variant="subtitle2" color="primary" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                {client.firstName} {client.lastName}
                              </Typography>
                              <Chip
                                label={`${clientProperties.length} ${t('portfolios.fields.properties')}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            </Box>
                            <IconButton size="small" sx={{ color: 'primary.main', p: 0.25 }}>
                              {expandedClients.has(client.id) ? (
                                <ExpandLessIcon sx={{ fontSize: 18 }} />
                              ) : (
                                <ExpandMoreIcon sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </Box>

                          {clientProperties.length > 0 ? (
                            expandedClients.has(client.id) ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 1 }}>
                                {clientProperties.map((property) => (
                                  <Card
                                    key={property.id}
                                    variant="outlined"
                                    sx={{
                                      borderRadius: 1.5,
                                      borderLeft: 3,
                                      borderLeftColor: 'primary.main',
                                      transition: 'all 0.2s ease-in-out',
                                      '&:hover': {
                                        borderColor: 'primary.main',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 2px 8px rgba(107, 138, 154, 0.1)',
                                      },
                                    }}
                                  >
                                    <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
                                      <Box display="flex" alignItems="flex-start">
                                        <Avatar
                                          sx={{
                                            bgcolor: 'secondary.main',
                                            width: 28,
                                            height: 28,
                                            mr: 1.25,
                                          }}
                                        >
                                          <Home sx={{ fontSize: 14 }} />
                                        </Avatar>
                                        <Box flex={1} minWidth={0}>
                                          <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', fontWeight: 600 }} noWrap>
                                            {property.name}
                                          </Typography>
                                          <Box display="flex" alignItems="center">
                                            <LocationOn sx={{ fontSize: 13, mr: 0.5, color: 'text.secondary' }} />
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
                                              {property.address}, {property.city}
                                            </Typography>
                                          </Box>
                                        </Box>
                                        <Box display="flex" alignItems="center" gap={0.5} ml={0.5} flexWrap="wrap">
                                          <Chip
                                            label={property.type}
                                            size="small"
                                            sx={{ height: 20, fontSize: '0.6rem' }}
                                          />
                                          {propertyTeamMap.get(property.id) ? (
                                            <Chip
                                              icon={<Group sx={{ fontSize: 13 }} />}
                                              label={propertyTeamMap.get(property.id)!.teamName}
                                              size="small"
                                              color="success"
                                              onDelete={() => handleRemoveTeamFromProperty(property.id)}
                                              sx={{ height: 20, fontSize: '0.6rem' }}
                                            />
                                          ) : (
                                            <Chip
                                              icon={<Group sx={{ fontSize: 13 }} />}
                                              label={t('portfolios.fields.assignTeam')}
                                              size="small"
                                              variant="outlined"
                                              onClick={(e) => {
                                                setTeamMenuAnchor(e.currentTarget);
                                                setTeamMenuPropertyId(property.id);
                                              }}
                                              sx={{ height: 20, fontSize: '0.6rem', cursor: 'pointer' }}
                                            />
                                          )}
                                          <Tooltip title={t('portfolios.fields.unassignProperty')}>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleUnassignProperty(property.id)}
                                              sx={{ color: 'error.main', p: 0.25 }}
                                            >
                                              <DeleteIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                          </Tooltip>
                                        </Box>
                                      </Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 4.5, fontSize: '0.62rem' }}>
                                        {t('portfolios.fields.createdOn')} {formatDate(property.createdAt)}
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, fontStyle: 'italic', fontSize: '0.72rem' }}>
                                {t('portfolios.fields.clickArrowToSee', { count: clientProperties.length })}
                              </Typography>
                            )
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 4, fontStyle: 'italic', fontSize: '0.72rem' }}>
                              {t('portfolios.fields.noClientAssociated')}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <EmptyState
                    icon={<Home sx={{ fontSize: 40 }} />}
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
                icon={<Group sx={{ fontSize: 20 }} />}
                title={t('teams.title')}
                count={teams.length}
                color="success.main"
              />
              {teams.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {teams.map((team) => (
                    <Card
                      key={team.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'success.main',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(76, 175, 80, 0.12)',
                        },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box display="flex" alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: 'success.main',
                              width: 32,
                              height: 32,
                              mr: 1.5,
                            }}
                          >
                            <Group sx={{ fontSize: 16 }} />
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', fontWeight: 600 }} noWrap>
                              {team.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                              {team.memberCount} {t('portfolios.fields.members')}
                            </Typography>
                          </Box>
                          <Tooltip title={t('portfolios.confirmations.unassignTeamTitle')}>
                            <IconButton
                              size="small"
                              onClick={() => handleUnassignTeam(team.id)}
                              sx={{ color: 'error.main', p: 0.5 }}
                            >
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        {team.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 5.5, fontSize: '0.72rem' }}>
                            {team.description}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 5.5, fontSize: '0.62rem' }}>
                          {t('portfolios.fields.createdOn')} {formatDate(team.assignedAt)}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <EmptyState
                  icon={<Group sx={{ fontSize: 40 }} />}
                  message={t('portfolios.fields.noClientAssociated')}
                  action={
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PeopleIcon sx={{ fontSize: 14 }} />}
                      onClick={handleTeamAssignment}
                      sx={{ fontSize: '0.78rem' }}
                    >
                      {t('portfolios.associateTeamsUsers')}
                    </Button>
                  }
                />
              )}
            </Grid>

            {/* Users */}
            <Grid item xs={12} md={6}>
              <SectionHeader
                icon={<Person sx={{ fontSize: 20 }} />}
                title={t('users.title')}
                count={users.length}
                color="warning.main"
              />
              {users.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {users.map((portfolioUser) => (
                    <Card
                      key={portfolioUser.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'warning.main',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(255, 167, 38, 0.12)',
                        },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box display="flex" alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: 'warning.main',
                              width: 32,
                              height: 32,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              mr: 1.5,
                            }}
                          >
                            {portfolioUser.firstName.charAt(0)}{portfolioUser.lastName.charAt(0)}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', fontWeight: 600 }} noWrap>
                              {portfolioUser.firstName} {portfolioUser.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }} noWrap>
                              {portfolioUser.email}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5} ml={1}>
                            <Chip
                              label={getRoleLabel(portfolioUser.role)}
                              color={getRoleColor(portfolioUser.role)}
                              size="small"
                              sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600 }}
                            />
                            <Tooltip title={t('portfolios.confirmations.unassignUserTitle')}>
                              <IconButton
                                size="small"
                                onClick={() => handleUnassignUser(portfolioUser.id)}
                                sx={{ color: 'error.main', p: 0.5 }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 5.5, fontSize: '0.62rem' }}>
                          {t('portfolios.fields.associatedOn')} {formatDate(portfolioUser.assignedAt)}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <EmptyState
                  icon={<Person sx={{ fontSize: 40 }} />}
                  message={t('portfolios.fields.noClientAssociated')}
                  action={
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PeopleIcon sx={{ fontSize: 14 }} />}
                      onClick={handleTeamAssignment}
                      sx={{ fontSize: '0.78rem' }}
                    >
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
      </Paper>

      {/* Team selection menu for property assignment */}
      <Menu
        anchorEl={teamMenuAnchor}
        open={Boolean(teamMenuAnchor)}
        onClose={() => { setTeamMenuAnchor(null); setTeamMenuPropertyId(null); }}
        slotProps={{
          paper: { sx: { borderRadius: 2, minWidth: 200 } },
        }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary', display: 'block' }}>
          {t('portfolios.fields.assignTeam')}
        </Typography>
        <Divider sx={{ mb: 0.5 }} />
        {teams.length > 0 ? teams.map((team) => (
          <MenuItem
            key={team.id}
            onClick={() => {
              if (teamMenuPropertyId) {
                handleAssignTeamToProperty(teamMenuPropertyId, team.id);
              }
              setTeamMenuAnchor(null);
              setTeamMenuPropertyId(null);
            }}
            sx={{ fontSize: '0.82rem', py: 0.75 }}
          >
            <Group sx={{ fontSize: 16, mr: 1, color: 'success.main' }} />
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
    </Box>
  );
};

export default PortfoliosPage;
