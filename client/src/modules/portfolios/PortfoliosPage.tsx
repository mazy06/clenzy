import React from 'react';
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
  Alert,
  IconButton,
  Tooltip,
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
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import ConfirmationModal from '../../components/ConfirmationModal';
import TeamManagementTab from './TeamManagementTab';
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
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `portfolios-tab-${index}`,
    'aria-controls': `portfolios-tabpanel-${index}`,
  };
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
    handleReassignProperty,
    handleUnassignProperty,
    confirmationModal,
    closeConfirmationModal,
    formatDate,
    getRoleColor,
    getRoleLabel,
  } = usePortfoliosPage();

  if (!canView) {
    return null;
  }

  return (
    <Box>
      <PageHeader
        title={t('portfolios.title')}
        subtitle={t('portfolios.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<AssignmentIcon />}
              onClick={handleClientAssignment}
              sx={{ borderWidth: 2 }}
            >
              {t('portfolios.associateClientsProperties')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<PeopleIcon />}
              onClick={handleTeamAssignment}
              sx={{ borderWidth: 2 }}
            >
              {t('portfolios.associateTeamsUsers')}
            </Button>
          </Box>
        }
      />

      <Paper sx={{ width: '100%', mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="portfolios tabs"
            sx={{ px: 2 }}
          >
            <Tab
              label={t('portfolios.tabs.myPortfolios')}
              {...a11yProps(0)}
              icon={<BusinessIcon />}
              iconPosition="start"
            />
            <Tab
              label={t('portfolios.tabs.teamManagement')}
              {...a11yProps(1)}
            />
            <Tab
              label={t('portfolios.tabs.statistics')}
              {...a11yProps(2)}
            />
          </Tabs>
        </Box>

        {/* Tab 0: My Portfolios */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : (
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('portfolios.sections.clientsProperties')}
              </Typography>

              <Grid container spacing={3}>
                {/* Clients */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person color="primary" />
                    {t('portfolios.sections.clients')} ({clients.length})
                  </Typography>
                  {clients.length > 0 ? (
                    <Grid container spacing={2}>
                      {clients.map((client) => (
                        <Grid item xs={12} key={client.id}>
                          <Card variant="outlined">
                            <CardContent>
                              <Box display="flex" alignItems="center" mb={1}>
                                <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 32, height: 32 }}>
                                  <Person />
                                </Avatar>
                                <Box flex={1}>
                                  <Typography variant="subtitle2">
                                    {client.firstName} {client.lastName}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {client.email}
                                  </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Chip
                                    label={getRoleLabel(client.role)}
                                    color={getRoleColor(client.role)}
                                    size="small"
                                  />
                                  <Tooltip title={t('portfolios.fields.reassignClient')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => setEditingClient(client)}
                                      sx={{ color: 'primary.main' }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t('portfolios.fields.unassignClient')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleUnassignClient(client.id)}
                                      sx={{ color: 'error.main' }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                              {client.phoneNumber && (
                                <Box display="flex" alignItems="center" mb={1}>
                                  <Phone sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                                  <Typography variant="body2" color="text.secondary">
                                    {client.phoneNumber}
                                  </Typography>
                                </Box>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                Associé le {formatDate(client.associatedAt)}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                      {t('portfolios.fields.noClientAssociated')}
                    </Typography>
                  )}
                </Grid>

                {/* Properties grouped by client */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Home color="secondary" />
                    {t('portfolios.sections.propertiesByClient')} ({properties.length})
                  </Typography>
                  {properties.length > 0 ? (
                    <Box>
                      {clients.map((client) => {
                        const clientProperties = properties.filter(prop => prop.ownerId === client.id);
                        return (
                          <Box key={client.id} sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="h6" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Person sx={{ fontSize: 20 }} />
                                {client.firstName} {client.lastName}
                                <Chip
                                  label={`${clientProperties.length} ${clientProperties.length > 1 ? t('portfolios.fields.properties') : t('portfolios.fields.properties').replace('(ies)', '').trim()}`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => toggleClientExpansion(client.id)}
                                sx={{ color: 'primary.main' }}
                              >
                                {expandedClients.has(client.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </Box>
                            {clientProperties.length > 0 ? (
                              expandedClients.has(client.id) ? (
                                <Grid container spacing={1}>
                                  {clientProperties.map((property) => (
                                    <Grid item xs={12} key={property.id}>
                                      <Card variant="outlined" sx={{ ml: 2, borderLeft: 3, borderLeftColor: 'primary.main' }}>
                                        <CardContent sx={{ py: 1.5 }}>
                                          <Box display="flex" alignItems="flex-start" mb={1}>
                                            <Avatar sx={{ bgcolor: 'secondary.main', mr: 2, width: 28, height: 28 }}>
                                              <Home sx={{ fontSize: 16 }} />
                                            </Avatar>
                                            <Box flex={1}>
                                              <Typography variant="subtitle2">
                                                {property.name}
                                              </Typography>
                                              <Box display="flex" alignItems="center" mb={0.5}>
                                                <LocationOn sx={{ fontSize: 14, mr: 1, color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary">
                                                  {property.address}, {property.city}
                                                </Typography>
                                              </Box>
                                            </Box>
                                            <Box display="flex" alignItems="center" gap={1}>
                                              <Chip
                                                label={property.type}
                                                color="default"
                                                size="small"
                                              />
                                              <Tooltip title="Réassigner cette propriété">
                                                <IconButton
                                                  size="small"
                                                  onClick={() => handleReassignProperty(property.id)}
                                                  sx={{ color: 'primary.main' }}
                                                >
                                                  <EditIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                              <Tooltip title="Désassigner cette propriété">
                                                <IconButton
                                                  size="small"
                                                  onClick={() => handleUnassignProperty(property.id)}
                                                  sx={{ color: 'error.main' }}
                                                >
                                                  <DeleteIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            </Box>
                                          </Box>
                                          <Typography variant="caption" color="text.secondary">
                                            {t('portfolios.fields.createdOn')} {formatDate(property.createdAt)}
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                  ))}
                                </Grid>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 2, fontStyle: 'italic' }}>
                                  {t('portfolios.fields.clickArrowToSee', { count: clientProperties.length })}
                                </Typography>
                              )
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ ml: 2, fontStyle: 'italic' }}>
                                {t('portfolios.fields.noClientAssociated')}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                      {t('portfolios.fields.noClientAssociated')}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}
        </TabPanel>

        {/* Tab 1: Teams & Users */}
        <TabPanel value={tabValue} index={1}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.sections.teamsUsers')}
            </Typography>

            <Grid container spacing={3}>
              {/* Teams */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Group color="success" />
                  {t('teams.title')} ({teams.length})
                </Typography>
                {teams.length > 0 ? (
                  <Grid container spacing={2}>
                    {teams.map((team) => (
                      <Grid item xs={12} key={team.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box display="flex" alignItems="center" mb={1}>
                              <Avatar sx={{ bgcolor: 'success.main', mr: 2, width: 32, height: 32 }}>
                                <Group />
                              </Avatar>
                              <Box flex={1}>
                                <Typography variant="subtitle2">
                                  {team.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {team.memberCount} membre{team.memberCount > 1 ? 's' : ''}
                                </Typography>
                              </Box>
                              <Tooltip title={t('teams.delete')}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleUnassignTeam(team.id)}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            {team.description && (
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {team.description}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {t('portfolios.fields.createdOn')} {formatDate(team.assignedAt)}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    {t('portfolios.fields.noClientAssociated')}
                  </Typography>
                )}
              </Grid>

              {/* Users */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person color="warning" />
                  {t('users.title')} ({users.length})
                </Typography>
                {users.length > 0 ? (
                  <Grid container spacing={2}>
                    {users.map((portfolioUser) => (
                      <Grid item xs={12} key={portfolioUser.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box display="flex" alignItems="center" mb={1}>
                              <Avatar sx={{ bgcolor: 'warning.main', mr: 2, width: 32, height: 32 }}>
                                <Person />
                              </Avatar>
                              <Box flex={1}>
                                <Typography variant="subtitle2">
                                  {portfolioUser.firstName} {portfolioUser.lastName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {portfolioUser.email}
                                </Typography>
                              </Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip
                                  label={getRoleLabel(portfolioUser.role)}
                                  color={getRoleColor(portfolioUser.role)}
                                  size="small"
                                />
                                <Tooltip title={t('portfolios.fields.unassignClient')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleUnassignUser(portfolioUser.id)}
                                    sx={{ color: 'error.main' }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                              <Typography variant="caption" color="text.secondary">
                                {t('portfolios.fields.associatedOn')} {formatDate(portfolioUser.assignedAt)}
                              </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    {t('portfolios.fields.noClientAssociated')}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Tab 2: Statistics */}
        <TabPanel value={tabValue} index={2}>
          <PortfolioStatsTab />
        </TabPanel>
      </Paper>

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
