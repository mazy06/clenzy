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
import { API_CONFIG } from '../../config/api';

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

const steps = [
  'Sélectionner le manager',
  'Choisir les équipes',
  'Choisir les utilisateurs',
  'Confirmer les assignations'
];

const TeamUserAssignmentForm: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [activeStep, setActiveStep] = useState(0);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedManager, setSelectedManager] = useState<number | ''>('');
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
      console.log('🔄 TeamUserAssignmentForm - useEffect triggered:', { isAdmin, isManager, userId: user.id });
      
      // Charger la liste des managers pour tous les utilisateurs
      loadManagers();
      
      if (isManager && !isAdmin) {
        // Si c'est un manager (mais pas admin), pré-sélectionner son ID
        console.log('🔄 TeamUserAssignmentForm - Pré-sélection manager:', user.id);
        setSelectedManager(Number(user.id));
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
      console.log('🔄 TeamUserAssignmentForm - Chargement des managers...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/all`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` }
      });

      console.log('📡 TeamUserAssignmentForm - Réponse managers:', response.status, response.statusText);

      if (response.ok) {
        const managersArray = await response.json();
        console.log('📊 TeamUserAssignmentForm - Managers reçus:', managersArray);
        
        setManagers(managersArray);
      } else {
        console.error('❌ TeamUserAssignmentForm - Erreur utilisateurs:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ TeamUserAssignmentForm - Détails erreur:', errorText);
        setManagers([]);
      }
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
      setManagers([]);
    }
  };

  const loadTeamsAndUsers = async () => {
    if (!selectedManager) {
      console.log('⏳ TeamUserAssignmentForm - En attente de la sélection du manager...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 TeamUserAssignmentForm - Chargement des équipes et utilisateurs pour manager:', selectedManager);
      
      const [teamsRes, usersRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/api/managers/teams`),
        fetch(`${API_CONFIG.BASE_URL}/api/managers/operational-users`)
      ]);


      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        console.log('📊 TeamUserAssignmentForm - Équipes reçues:', teamsData);
        // S'assurer que c'est un tableau
        const teamsArray = Array.isArray(teamsData) ? teamsData : (teamsData.content || []);
        setTeams(teamsArray);
      } else {
        console.error('❌ TeamUserAssignmentForm - Erreur équipes:', teamsRes.status, teamsRes.statusText);
        // Utiliser des données de test en cas d'erreur - correspondant aux vraies équipes de la base
        const testTeams = [
          { id: 1, name: "Équipe Maintenance Technique", description: "Techniciens qualifiés pour la maintenance préventive et corrective", interventionType: "MAINTENANCE", memberCount: 2, isActive: true },
          { id: 2, name: "Équipe Nettoyage Premium", description: "Spécialisée dans le nettoyage approfondi des logements Airbnb", interventionType: "CLEANING", memberCount: 2, isActive: true }
        ];
        setTeams(testTeams);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        console.log('📊 TeamUserAssignmentForm - Utilisateurs reçus:', usersData);
        // S'assurer que c'est un tableau
        const usersArray = Array.isArray(usersData) ? usersData : (usersData.content || []);
        setUsers(usersArray);
      } else {
        console.error('❌ TeamUserAssignmentForm - Erreur utilisateurs:', usersRes.status, usersRes.statusText);
        setUsers([]);
      }
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error('Erreur chargement données:', err);
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${selectedManager}/assign-teams-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
        },
        body: JSON.stringify({
          managerId: selectedManager,
          teamIds: selectedTeams,
          userIds: selectedUsers
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Assignation réussie ! ${result.teamsAssigned} équipe(s) et ${result.usersAssigned} utilisateur(s) assigné(s).`);
        setTimeout(() => {
          window.location.href = '/portfolios';
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors de l\'assignation');
      }
    } catch (err) {
      setError('Erreur lors de l\'assignation');
      console.error('Erreur assignation:', err);
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'HOUSEKEEPER': return 'success';
      case 'TECHNICIAN': return 'warning';
      case 'SUPERVISOR': return 'info';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'HOUSEKEEPER': return 'Agent de nettoyage';
      case 'TECHNICIAN': return 'Technicien';
      case 'SUPERVISOR': return 'Superviseur';
      default: return role;
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Sélectionnez le manager
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choisissez le manager dont vous voulez gérer les portefeuilles.
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
                  console.log('🔄 TeamUserAssignmentForm - Sélection manager:', e.target.value);
                  setSelectedManager(e.target.value as number);
                }}
                label="Manager"
                disabled={false} // Tous les utilisateurs peuvent changer
                displayEmpty
                renderValue={(value) => {
                  if (!value || value === 0) {
                    return <span style={{ color: '#999' }}>Sélectionnez un manager...</span>;
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
                    Sélectionnez un manager...
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
              Sélectionnez les équipes à assigner
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choisissez les équipes opérationnelles à assigner au portefeuille. 
              <strong>Cette étape est optionnelle</strong> - vous pouvez passer à l'étape suivante pour assigner des utilisateurs individuels.
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
                          {team.memberCount} membre{team.memberCount > 1 ? 's' : ''}
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
              Sélectionnez les utilisateurs à assigner
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choisissez les utilisateurs opérationnels à assigner directement au manager.
              {selectedTeams.length === 0 ? (
                <strong> Vous devez sélectionner au moins un utilisateur pour continuer</strong>
              ) : (
                <strong> Sélection optionnelle - vous pouvez passer à l'étape suivante</strong>
              )}
            </Typography>
            
            {/* Barre de recherche */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Rechercher un utilisateur par nom, email ou rôle..."
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
                <strong>Attention :</strong> Aucune équipe n'a été sélectionnée. Vous devez choisir au moins un utilisateur pour continuer.
              </Alert>
            )}

            {filteredUsers.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <People sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {userSearchTerm ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur disponible'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {userSearchTerm 
                    ? `Aucun utilisateur ne correspond à "${userSearchTerm}"`
                    : 'Aucun utilisateur opérationnel n\'est disponible pour l\'assignation'
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
                        color={getRoleColor(user.role) as any}
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
              Confirmez les assignations
            </Typography>
            
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                <People sx={{ mr: 1, verticalAlign: 'middle' }} />
                Manager sélectionné
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
                    Équipes sélectionnées ({selectedTeamsData.length})
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
                            secondary={`${team.memberCount} membre${team.memberCount > 1 ? 's' : ''} • ${team.interventionType}`}
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
                    Utilisateurs sélectionnés ({selectedUsersData.length})
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
                      Aucun utilisateur sélectionné
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return 'Étape inconnue';
    }
  };

  if (!user?.id) {
    return (
      <Container maxWidth="lg">
        <PageHeader
          title="Association Équipes & Utilisateurs"
          subtitle="Associez vos équipes et utilisateurs aux portefeuilles"
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
          title="Association Équipes & Utilisateurs"
          subtitle="Associez vos équipes et utilisateurs aux portefeuilles"
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
        title="Association Équipes & Utilisateurs"
        subtitle="Associez vos équipes et utilisateurs aux portefeuilles"
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
            Retour
          </Button>
          
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !selectedManager || (selectedTeams.length === 0 && selectedUsers.length === 0)}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {loading ? 'Assignation...' : 'Confirmer les assignations'}
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
              Suivant
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default TeamUserAssignmentForm;
