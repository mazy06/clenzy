import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
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
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import ConfirmationModal from '../../components/ConfirmationModal';
import { usePermissions } from "../../hooks/usePermissions";
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../../config/api';
import TeamManagementTab from './TeamManagementTab';
import PortfolioStatsTab from './PortfolioStatsTab';
import { useTranslation } from '../../hooks/useTranslation';

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

const PortfoliosPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // États pour les données
  const [clients, setClients] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  
  // États pour les modals de confirmation
  const [confirmationModal, setConfirmationModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    severity?: 'warning' | 'error' | 'info';
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  // Utiliser notre système de permissions au lieu de isAdmin/isManager
  const { hasPermission } = usePermissions();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Fonction pour basculer l'affichage des propriétés d'un client
  const toggleClientExpansion = (clientId: number) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const handleClientAssignment = () => {
    navigate('/portfolios/client-assignment');
  };

  const handleTeamAssignment = () => {
    navigate('/portfolios/team-assignment');
  };

  // Charger les données des associations
  useEffect(() => {
    if (user?.id) {
      loadAssociations();
      loadManagers();
    }
  }, [user?.id]);

  const loadManagers = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/all`);
      if (response.ok) {
        const data = await response.json();
        setManagers(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des managers:', error);
    }
  };

  const handleReassignClient = async (clientId: number, newManagerId: number, notes: string) => {
    setReassignLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${clientId}/reassign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newManagerId,
          notes
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Client réassigné avec succès:', result);
        // Recharger les associations
        loadAssociations();
        setEditingClient(null);
      } else {
        const errorData = await response.json();
        console.error('❌ Erreur lors de la réassignation:', errorData);
        setError(errorData.error || t('portfolios.errors.reassignError'));
      }
    } catch (error) {
      console.error('❌ Erreur lors de la réassignation:', error);
      setError(t('portfolios.errors.reassignConnectionError'));
    } finally {
      setReassignLoading(false);
    }
  };

  // Fonctions de désassignation
  const handleUnassignClient = (clientId: number) => {
    if (!user?.id) return;
    
    setConfirmationModal({
      open: true,
      title: t('portfolios.confirmations.unassignClientTitle'),
      message: t('portfolios.confirmations.unassignClientMessage'),
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignClient(clientId);
      },
    });
  };

  const performUnassignClient = async (clientId: number) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${user.id}/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Client désassigné avec succès:', result);
        // Recharger les associations
        loadAssociations();
      } else {
        const errorData = await response.json();
        console.error('❌ Erreur lors de la désassignation du client:', errorData);
        setError(errorData.error || t('portfolios.errors.unassignError'));
      }
    } catch (error) {
      console.error('❌ Erreur lors de la désassignation du client:', error);
      setError(t('portfolios.errors.connectionError'));
    }
  };

  const handleUnassignTeam = (teamId: number) => {
    if (!user?.id) return;
    
    setConfirmationModal({
      open: true,
      title: t('teams.delete'),
      message: 'Êtes-vous sûr de vouloir désassigner cette équipe ?',
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignTeam(teamId);
      },
    });
  };

  const performUnassignTeam = async (teamId: number) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${user.id}/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Équipe désassignée avec succès:', result);
        // Recharger les associations
        loadAssociations();
      } else {
        const errorData = await response.json();
        console.error('❌ Erreur lors de la désassignation de l\'équipe:', errorData);
        setError(errorData.error || 'Erreur lors de la désassignation');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la désassignation de l\'équipe:', error);
      setError('Erreur de connexion lors de la désassignation');
    }
  };

  const handleUnassignUser = (userId: number) => {
    if (!user?.id) return;
    
    setConfirmationModal({
      open: true,
      title: t('portfolios.confirmations.unassignClientTitle'),
      message: t('portfolios.confirmations.unassignClientMessage'),
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignUser(userId);
      },
    });
  };

  const performUnassignUser = async (userId: number) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${user.id}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Utilisateur désassigné avec succès:', result);
        // Recharger les associations
        loadAssociations();
      } else {
        const errorData = await response.json();
        console.error('❌ Erreur lors de la désassignation de l\'utilisateur:', errorData);
        setError(errorData.error || t('portfolios.errors.unassignError'));
      }
    } catch (error) {
      console.error('❌ Erreur lors de la désassignation de l\'utilisateur:', error);
      setError(t('portfolios.errors.connectionError'));
    }
  };

  // Fonctions pour la gestion des propriétés individuelles
  const handleReassignProperty = async (propertyId: number) => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${user.id}/properties/${propertyId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Propriété réassignée avec succès:', result);
        // Recharger les associations
        loadAssociations();
      } else {
        const errorData = await response.json();
        console.error('❌ Erreur lors de la réassignation de la propriété:', errorData);
        setError(errorData.error || t('portfolios.errors.reassignError'));
      }
    } catch (error) {
      console.error('❌ Erreur lors de la réassignation de la propriété:', error);
      setError(t('portfolios.errors.reassignConnectionError'));
    }
  };

  const handleUnassignProperty = (propertyId: number) => {
    if (!user?.id) return;
    
    setConfirmationModal({
      open: true,
      title: 'Désassigner la propriété',
      message: 'Êtes-vous sûr de vouloir désassigner cette propriété ? Le client restera assigné mais cette propriété ne sera plus gérée par vous.',
      severity: 'warning',
      onConfirm: () => {
        setConfirmationModal(prev => ({ ...prev, open: false }));
        performUnassignProperty(propertyId);
      },
    });
  };

  const performUnassignProperty = async (propertyId: number) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${user.id}/properties/${propertyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Propriété désassignée avec succès:', result);
        // Recharger les associations
        loadAssociations();
      } else {
        const errorData = await response.json();
        console.error('❌ Erreur lors de la désassignation de la propriété:', errorData);
        setError(errorData.error || t('portfolios.errors.unassignError'));
      }
    } catch (error) {
      console.error('❌ Erreur lors de la désassignation de la propriété:', error);
      setError(t('portfolios.errors.connectionError'));
    }
  };

  const loadAssociations = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 PortfoliosPage - Chargement des associations pour user ID:', user.id);
      
      // Appeler l'API des associations
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/managers/${user.id}/associations`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );

      if (response.ok) {
        const associationsData = await response.json();
        console.log('📊 PortfoliosPage - Données reçues:', associationsData);

        setClients(associationsData.clients || []);
        setProperties(associationsData.properties || []);
        setTeams(associationsData.teams || []);
        setUsers(associationsData.users || []);
      } else {
        const errorText = await response.text();
        console.error('❌ PortfoliosPage - Erreur API:', response.status, errorText);
        setError(`${t('portfolios.errors.loadError')}: ${response.status}`);
      }
    } catch (err) {
      setError(t('portfolios.errors.connectionError'));
      console.error('❌ PortfoliosPage - Erreur chargement associations:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'HOST': return 'primary';
      case 'TECHNICIAN': return 'secondary';
      case 'HOUSEKEEPER': return 'success';
      case 'SUPERVISOR': return 'warning';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'HOST': return t('portfolios.roles.owner');
      case 'TECHNICIAN': return t('portfolios.roles.technician');
      case 'HOUSEKEEPER': return t('portfolios.roles.housekeeper');
      case 'SUPERVISOR': return t('portfolios.roles.supervisor');
      default: return role;
    }
  };

  // Vérifier la permission portfolios:view silencieusement
  if (!user || !hasPermission("portfolios:view")) {
    return null; // Retourner null au lieu d'un message d'erreur
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
                                    color={getRoleColor(client.role) as any}
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

                {/* Propriétés groupées par client */}
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

        <TabPanel value={tabValue} index={1}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.sections.teamsUsers')}
            </Typography>
            
            <Grid container spacing={3}>
              {/* Équipes */}
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

              {/* Utilisateurs */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person color="warning" />
                  {t('users.title')} ({users.length})
                </Typography>
                {users.length > 0 ? (
                  <Grid container spacing={2}>
                    {users.map((user) => (
                      <Grid item xs={12} key={user.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box display="flex" alignItems="center" mb={1}>
                              <Avatar sx={{ bgcolor: 'warning.main', mr: 2, width: 32, height: 32 }}>
                                <Person />
                              </Avatar>
                              <Box flex={1}>
                                <Typography variant="subtitle2">
                                  {user.firstName} {user.lastName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {user.email}
                                </Typography>
                              </Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip
                                  label={getRoleLabel(user.role)}
                                  color={getRoleColor(user.role) as any}
                                  size="small"
                                />
                                <Tooltip title={t('portfolios.fields.unassignClient')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleUnassignUser(user.id)}
                                    sx={{ color: 'error.main' }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                              <Typography variant="caption" color="text.secondary">
                                {t('portfolios.fields.associatedOn')} {formatDate(user.assignedAt)}
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

        <TabPanel value={tabValue} index={2}>
          <PortfolioStatsTab />
        </TabPanel>
      </Paper>

      {/* Dialogue de réassignation */}
      <ReassignmentDialog
        open={!!editingClient}
        onClose={() => setEditingClient(null)}
        client={editingClient}
        onReassign={handleReassignClient}
        managers={managers}
        loading={reassignLoading}
      />
      
      {/* Modal de confirmation pour les désassignations */}
      <ConfirmationModal
        open={confirmationModal.open}
        onClose={() => setConfirmationModal(prev => ({ ...prev, open: false }))}
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

// Composant de dialogue pour la réassignation
const ReassignmentDialog = ({ open, onClose, client, onReassign, managers, loading }: {
  open: boolean;
  onClose: () => void;
  client: any;
  onReassign: (clientId: number, newManagerId: number, notes: string) => void;
  managers: any[];
  loading: boolean;
}) => {
  const { t } = useTranslation();
  const [selectedManagerId, setSelectedManagerId] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (selectedManagerId && client) {
      onReassign(client.id, selectedManagerId, notes);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('portfolios.fields.reassignClient')} {client?.firstName} {client?.lastName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('portfolios.fields.newManager')}</InputLabel>
            <Select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(Number(e.target.value))}
              label="Nouveau Manager"
            >
              {managers.map((manager) => (
                <MenuItem key={manager.id} value={manager.id}>
                  {manager.firstName} {manager.lastName} - {manager.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Notes (optionnel)"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajoutez des notes sur cette réassignation..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!selectedManagerId || loading}
        >
          {loading ? 'Réassignation...' : 'Réassigner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PortfoliosPage;
