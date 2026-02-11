import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Stepper,
  Step,
  StepLabel,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Business,
  People,
  Group,
  CheckCircle,
  ArrowForward,
  ArrowBack,
  Person,
  Build,
  CleaningServices,
  SupervisorAccount,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import PageHeader from '../../components/PageHeader';
import { managersApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../hooks/useTranslation';

interface Portfolio {
  id: number;
  name: string;
  description: string;
  managerId: number;
  managerName?: string;
  isActive: boolean;
}

interface Manager {
  id: number;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  isActive: boolean;
}

interface User {
  id: number;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

// steps sera généré dynamiquement avec les traductions

const TeamUserAssignmentForm: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  
  // Générer les étapes avec traductions
  const steps = [
    t('portfolios.steps.selectManager'),
    t('portfolios.steps.chooseTeams'),
    t('portfolios.steps.chooseUsers'),
    t('portfolios.steps.confirmAssignments')
  ];
  const [managers, setManagers] = useState<Manager[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedManager, setSelectedManager] = useState<string | number | ''>('');
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const adminPerm = await hasPermission('portfolios:manage_all');
      const managerPerm = await hasPermission('portfolios:manage');
      setIsAdmin(adminPerm);
      setIsManager(managerPerm && !adminPerm);
    };
    checkPermissions();
  }, [hasPermission]);

  useEffect(() => {
    if (isAdmin !== undefined && isManager !== undefined && user?.id) {
      // Charger la liste des managers pour tous les utilisateurs
      loadManagers();
      
      if (isManager && !isAdmin) {
        // Si c'est un manager (mais pas admin), pré-sélectionner son ID
        setSelectedManager(user.id);
      }
    }
  }, [isAdmin, isManager, user?.id]);

  useEffect(() => {
    if (selectedManager) {
      loadTeamsAndUsers();
    }
  }, [selectedManager]);

  const loadManagers = async () => {
    try {
      const managersArray = await managersApi.getAll();
      setManagers(managersArray as Manager[]);
    } catch (err) {
      setManagers([]);
    }
  };

  const loadTeamsAndUsers = async () => {
    if (!selectedManager) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [teamsData, usersData] = await Promise.all([
        managersApi.getTeams(),
        managersApi.getOperationalUsers()
      ]);

      // S'assurer que c'est un tableau
      const teamsArray = Array.isArray(teamsData) ? teamsData : ((teamsData as any).content || []);
      setTeams(teamsArray as Team[]);

      // S'assurer que c'est un tableau
      const usersArray = Array.isArray(usersData) ? usersData : ((usersData as any).content || []);
      setUsers(usersArray as User[]);
    } catch (err) {
      // Utiliser des données de test en cas d'erreur - correspondant aux vraies équipes de la base
      const testTeams = [
        { id: 1, name: "Équipe Maintenance Technique", description: "Techniciens qualifiés pour la maintenance préventive et corrective", interventionType: "MAINTENANCE", memberCount: 2, isActive: true },
        { id: 2, name: "Équipe Nettoyage Premium", description: "Spécialisée dans le nettoyage approfondi des logements Airbnb", interventionType: "CLEANING", memberCount: 2, isActive: true }
      ];
      setTeams(testTeams);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleTeamToggle = (teamId: number) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleUserToggle = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Filtrer les utilisateurs selon le terme de recherche
  const filteredUsers = users.filter(user => 
    user.firstName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedManager) {
      setError('Veuillez sélectionner un manager');
      return;
    }
    
    if (selectedTeams.length === 0 && selectedUsers.length === 0) {
      setError('Veuillez sélectionner au moins une équipe ou un utilisateur');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<any>(`/managers/${selectedManager}/assign-teams-users`, {
        managerId: selectedManager,
        teamIds: selectedTeams,
        userIds: selectedUsers
      });
      setSuccess(t('portfolios.errors.assignmentSuccess') + ` ${result.teamsAssigned} ${t('teams.title')} et ${result.usersAssigned} ${t('users.title')} assigné(s).`);
      setTimeout(() => {
        window.location.href = '/portfolios';
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l\'assignation');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'HOUSEKEEPER': return <CleaningServices />;
      case 'TECHNICIAN': return <Build />;
      case 'SUPERVISOR': return <SupervisorAccount />;
      default: return <Person />;
    }
  };

  const getRoleColor = (role: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (role) {
      case 'HOUSEKEEPER': return 'success';
      case 'TECHNICIAN': return 'warning';
      case 'SUPERVISOR': return 'info';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'HOUSEKEEPER': return t('portfolios.roles.housekeeper');
      case 'TECHNICIAN': return t('portfolios.roles.technician');
      case 'SUPERVISOR': return t('portfolios.roles.supervisor');
      default: return role;
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.steps.selectManagerTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t('portfolios.steps.selectManagerDescription')}
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel shrink={true} sx={{ 
                position: 'absolute',
                top: '-6px',
                left: '12px',
                backgroundColor: 'white',
                padding: '0 6px',
                zIndex: 1,
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#1976d2'
              }}>Manager</InputLabel>
              <Select
                value={selectedManager}
                onChange={(e) => {
                  setSelectedManager(e.target.value as number);
                }}
                label="Manager"
                disabled={false} // Tous les utilisateurs peuvent changer
                displayEmpty
                renderValue={(value) => {
                  if (!value || value === 0) {
                    return <span style={{ color: '#999' }}>{t('portfolios.fields.selectManager')}</span>;
                  }
                  const selectedManagerData = managers.find(m => m.id === value);
                  if (selectedManagerData) {
                    return `${selectedManagerData.firstName} ${selectedManagerData.lastName} - ${selectedManagerData.email}`;
                  }
                  return value;
                }}
                sx={{
                  '& .MuiSelect-select': {
                    paddingTop: '16px',
                    paddingBottom: '16px',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d0d0d0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                    borderWidth: '2px',
                  }
                }}
              >
                <MenuItem value="">
                    <Typography variant="body2" color="text.secondary">
                      {t('portfolios.fields.selectManager')}
                    </Typography>
                </MenuItem>
                {managers.length > 0 ? (
                  managers.map((manager) => (
                    <MenuItem key={manager.id} value={manager.id}>
                      <Typography variant="subtitle1">
                        {manager.firstName} {manager.lastName} - {manager.email}
                      </Typography>
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">
                      Aucun manager trouvé
                    </Typography>
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            
            {/* Debug info - Commenté pour éviter les erreurs de build */}
            {/* 
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="caption" display="block">
                Debug: isAdmin={isAdmin.toString()}, isManager={isManager.toString()}
              </Typography>
              <Typography variant="caption" display="block">
                Managers count: {managers.length}
              </Typography>
              <Typography variant="caption" display="block">
                Selected manager: {selectedManager}
              </Typography>
              <Typography variant="caption" display="block">
                User ID: {user?.id}
              </Typography>
            </Box>
            */}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.fields.selectTeams')}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t('portfolios.fields.selectTeamsDescription')} 
              <strong>{t('portfolios.fields.optionalStep')}</strong>
            </Typography>
            <Grid container spacing={2}>
              {teams.map((team) => (
                <Grid item xs={12} sm={6} md={4} key={team.id}>
                  <Card 
                    variant={selectedTeams.includes(team.id) ? 'elevation' : 'outlined'}
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedTeams.includes(team.id) ? 2 : 1,
                      borderColor: selectedTeams.includes(team.id) ? 'primary.main' : 'divider'
                    }}
                    onClick={() => handleTeamToggle(team.id)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Checkbox
                          checked={selectedTeams.includes(team.id)}
                          onChange={() => handleTeamToggle(team.id)}
                          sx={{ mr: 1 }}
                        />
                        <Group color="primary" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1">
                          {team.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {team.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip 
                          label={team.interventionType} 
                          size="small" 
                          color={team.interventionType === 'CLEANING' ? 'success' : 'info'} 
                        />
                        <Typography variant="caption" color="text.secondary">
                          {team.memberCount} {team.memberCount > 1 ? t('portfolios.fields.members') : t('portfolios.fields.member')}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.fields.selectUsers')}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t('portfolios.fields.selectUsersDescription')}
              {selectedTeams.length === 0 ? (
                <strong> {t('portfolios.fields.mustSelectAtLeastOneUser')}</strong>
              ) : (
                <strong> {t('portfolios.fields.optionalSelection')}</strong>
              )}
            </Typography>
            
            {/* Barre de recherche */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                placeholder={t('portfolios.fields.searchUser')}
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <People />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              {userSearchTerm && (
                <Typography variant="body2" color="text.secondary">
                  {filteredUsers.length} utilisateur(s) trouvé(s) pour "{userSearchTerm}"
                </Typography>
              )}
            </Box>

            {/* Message d'alerte si aucune équipe sélectionnée et aucun utilisateur */}
            {selectedTeams.length === 0 && selectedUsers.length === 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>{t('portfolios.warnings.attention')} :</strong> {t('portfolios.warnings.noTeamSelectedWarning')}
              </Alert>
            )}

            {filteredUsers.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <People sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {userSearchTerm ? t('portfolios.fields.noUserFound') : t('portfolios.fields.noUserAvailable')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {userSearchTerm 
                    ? `${t('portfolios.fields.noUserMatch')} "${userSearchTerm}"`
                    : t('portfolios.fields.noOperationalUser')
                  }
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {filteredUsers.map((user) => (
                <Grid item xs={12} sm={6} md={4} key={user.id}>
                  <Card 
                    variant={selectedUsers.includes(user.id) ? 'elevation' : 'outlined'}
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedUsers.includes(user.id) ? 2 : 1,
                      borderColor: selectedUsers.includes(user.id) ? 'primary.main' : 'divider'
                    }}
                    onClick={() => handleUserToggle(user.id)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          sx={{ mr: 1 }}
                        />
                        {getRoleIcon(user.role)}
                        <Typography variant="subtitle1" sx={{ ml: 1 }}>
                          {user.firstName} {user.lastName}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {user.email}
                      </Typography>
                      <Chip 
                        label={getRoleLabel(user.role)} 
                        size="small" 
                        color={getRoleColor(user.role)}
                        icon={getRoleIcon(user.role)}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              </Grid>
            )}
          </Box>
        );

      case 3:
        const selectedTeamsData = teams.filter(t => selectedTeams.includes(t.id));
        const selectedUsersData = users.filter(u => selectedUsers.includes(u.id));
        const selectedManagerData = isAdmin 
          ? managers.find(m => m.id === selectedManager)
          : { firstName: user?.firstName, lastName: user?.lastName, email: user?.email };

        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.fields.confirmAssignments')}
            </Typography>
            
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                <People sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('portfolios.fields.selectedManager')}
              </Typography>
              <Typography variant="h6" color="primary">
                {selectedManagerData?.firstName} {selectedManagerData?.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedManagerData?.email}
              </Typography>
            </Paper>


            <Grid container spacing={3}>
              <Grid item xs={12} md={selectedTeamsData.length > 0 ? 6 : 12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <Group sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {t('portfolios.fields.selectedTeams')} ({selectedTeamsData.length})
                  </Typography>
                  {selectedTeamsData.length > 0 ? (
                    <List dense>
                      {selectedTeamsData.map((team) => (
                        <ListItem key={team.id}>
                          <ListItemIcon>
                            <CheckCircle color="success" />
                          </ListItemIcon>
                          <ListItemText
                            primary={team.name}
                            secondary={`${team.memberCount} ${team.memberCount > 1 ? t('portfolios.fields.members') : t('portfolios.fields.member')} • ${team.interventionType}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Aucune équipe sélectionnée
                    </Typography>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={selectedTeamsData.length > 0 ? 6 : 12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <People sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {t('portfolios.fields.selectedUsers')} ({selectedUsersData.length})
                  </Typography>
                  {selectedUsersData.length > 0 ? (
                    <List dense>
                      {selectedUsersData.map((user) => (
                        <ListItem key={user.id}>
                          <ListItemIcon>
                            <CheckCircle color="success" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${user.firstName} ${user.lastName}`}
                            secondary={`${user.email} • ${getRoleLabel(user.role)}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {t('portfolios.fields.noUserAvailable')}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return t('common.error');
    }
  };

  if (!user?.id) {
    return (
      <Container maxWidth="lg">
        <PageHeader
          title={t('portfolios.forms.teamUserAssociation')}
          subtitle={t('portfolios.forms.teamUserAssociationSubtitle')}
          backPath="/portfolios"
          showBackButton={true}
        />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Box textAlign="center">
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Chargement de votre profil...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Veuillez patienter pendant que nous récupérons vos informations.
            </Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  if (loading && activeStep === 0) {
    return (
      <Container maxWidth="lg">
        <PageHeader
          title={t('portfolios.forms.teamUserAssociation')}
          subtitle={t('portfolios.forms.teamUserAssociationSubtitle')}
          backPath="/portfolios"
          showBackButton={true}
        />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Box textAlign="center">
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Chargement des données...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Récupération des portefeuilles, équipes et utilisateurs.
            </Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <PageHeader
        title={t('portfolios.forms.teamUserAssociation')}
        subtitle={t('portfolios.forms.teamUserAssociationSubtitle')}
        backPath="/portfolios"
        showBackButton={true}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mb: 4 }}>
          {getStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack />}
          >
            {t('portfolios.forms.back')}
          </Button>
          
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !selectedManager || (selectedTeams.length === 0 && selectedUsers.length === 0)}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {loading ? t('portfolios.forms.assigning') : t('portfolios.forms.confirmAssignments')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={
                (activeStep === 0 && !selectedManager) ||
                (activeStep === 2 && selectedTeams.length === 0 && selectedUsers.length === 0)
              }
              endIcon={<ArrowForward />}
            >
              {t('portfolios.forms.next')}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default TeamUserAssignmentForm;
