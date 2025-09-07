import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  Save,
  Cancel,
  Add,
  Delete,
  Group,
  Person,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import PageHeader from '../../components/PageHeader';

// Types pour les équipes
export interface TeamFormData {
  name: string;
  description: string;
  interventionType: string;
  members: TeamMember[];
}

interface TeamMember {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// Type pour les utilisateurs
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const interventionTypes = [
  { value: 'CLEANING', label: 'Nettoyage', icon: '🧹', roles: ['housekeeper'] },
  { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express', icon: '🧹', roles: ['housekeeper'] },
  { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur', icon: '🧹', roles: ['housekeeper'] },
  { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres', icon: '🧹', roles: ['housekeeper'] },
  { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols', icon: '🧹', roles: ['housekeeper'] },
  { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine', icon: '🧹', roles: ['housekeeper'] },
  { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires', icon: '🧹', roles: ['housekeeper'] },
  { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance Préventive', icon: '🔧', roles: ['technician', 'supervisor'] },
  { value: 'EMERGENCY_REPAIR', label: 'Réparation d\'Urgence', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'ELECTRICAL_REPAIR', label: 'Réparation Électrique', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'PLUMBING_REPAIR', label: 'Réparation Plomberie', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'HVAC_REPAIR', label: 'Réparation Climatisation', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'APPLIANCE_REPAIR', label: 'Réparation Électroménager', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'GARDENING', label: 'Jardinage', icon: '🌱', roles: ['technician'] },
  { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Extérieur', icon: '🧹', roles: ['housekeeper'] },
  { value: 'PEST_CONTROL', label: 'Désinsectisation', icon: '🐛', roles: ['technician'] },
  { value: 'DISINFECTION', label: 'Désinfection', icon: '🧪', roles: ['housekeeper', 'technician'] },
  { value: 'RESTORATION', label: 'Remise en État', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'OTHER', label: 'Autre', icon: '📋', roles: ['housekeeper', 'technician', 'supervisor', 'manager'] }
];

const teamRoles = [
  { value: 'housekeeper', label: 'Agent de ménage' },
  { value: 'technician', label: 'Technicien' },
  { value: 'supervisor', label: 'Superviseur' },
  { value: 'manager', label: 'Manager' },
];

const TeamForm: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // État pour les permissions
  const [canCreate, setCanCreate] = useState(false);
  
  // Vérifier les permissions au chargement
  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('teams:create');
      setCanCreate(canCreatePermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);
  
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    description: '',
    interventionType: 'CLEANING',
    members: [],
  });

  // Charger la liste des utilisateurs depuis l'API
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const usersList = data.content || data;
          console.log('🔍 TeamForm - Utilisateurs chargés:', usersList);
          setUsers(usersList);
        }
      } catch (err) {
        console.error('🔍 TeamForm - Erreur chargement utilisateurs:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  // Vérifier les permissions APRÈS tous les hooks
  if (!canCreate) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Vous n'avez pas les permissions nécessaires pour créer des équipes.
        </Alert>
      </Box>
    );
  }

  const handleInputChange = (field: keyof TeamFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Si le type d'intervention change, vider la liste des membres
    if (field === 'interventionType') {
      setFormData(prev => ({ ...prev, members: [] }));
    }
  };

  // Filtrer les utilisateurs selon le type d'intervention sélectionné
  const getFilteredUsers = () => {
    const selectedType = interventionTypes.find(type => type.value === formData.interventionType);
    if (!selectedType) return users;
    
    return users.filter(user => 
      selectedType.roles.includes(user.role.toLowerCase())
    );
  };

  // Obtenir les rôles disponibles pour le type d'intervention sélectionné
  const getAvailableRoles = () => {
    const selectedType = interventionTypes.find(type => type.value === formData.interventionType);
    if (!selectedType) return teamRoles;
    
    return teamRoles.filter(role => 
      selectedType.roles.includes(role.value)
    );
  };

  const handleAddMember = () => {
    if (formData.members.length === 0) {
      setFormData(prev => ({
        ...prev,
        members: [{
          userId: 0,
          firstName: '',
          lastName: '',
          email: '',
          role: getAvailableRoles()[0]?.value || 'housekeeper',
        }]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        members: [...prev.members, {
          userId: 0,
          firstName: '',
          lastName: '',
          email: '',
          role: getAvailableRoles()[0]?.value || 'housekeeper',
        }]
      }));
    }
  };

  const handleMemberChange = (index: number, field: keyof TeamMember, value: any) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map((member, i) => 
        i === index ? { ...member, [field]: value } : member
      )
    }));
  };

  const handleUserSelection = (index: number, user: User | null) => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        members: prev.members.map((member, i) => 
          i === index ? {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
          } : member
        )
      }));
    }
  };

  const handleRemoveMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Le nom de l\'équipe est obligatoire');
      return;
    }

    if (!formData.interventionType) {
      setError('Le type d\'intervention est obligatoire');
      return;
    }

    if (formData.members.length === 0) {
      setError('L\'équipe doit avoir au moins un membre');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Préparer les données pour le backend
      const backendData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        interventionType: formData.interventionType,
        members: formData.members.map(member => ({
          userId: member.userId,
          role: member.role,
        })),
      };

      console.log('🔍 TeamForm - Données envoyées au backend:', backendData);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(backendData),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/teams');
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('🔍 TeamForm - Erreur création:', errorData);
        setError('Erreur lors de la création: ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 TeamForm - Erreur création:', err);
      setError('Erreur lors de la création de l\'équipe');
    } finally {
      setSaving(false);
    }
  };

  if (loadingUsers) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const filteredUsers = getFilteredUsers();
  const availableRoles = getAvailableRoles();
  const selectedInterventionType = interventionTypes.find(type => type.value === formData.interventionType);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Nouvelle équipe"
        subtitle="Créer une nouvelle équipe dans le système"
        backPath="/teams"
        showBackButton={true}
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => navigate('/teams')}
              startIcon={<Cancel />}
              disabled={saving}
              sx={{ mr: 1 }}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                // Déclencher la soumission du formulaire
                const submitButton = document.querySelector('[data-submit-team]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              startIcon={saving ? <CircularProgress size={20} /> : <Save />}
              disabled={saving || filteredUsers.length === 0}
            >
              {saving ? 'Création...' : 'Créer l\'équipe'}
            </Button>
          </>
        }
      />

      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Équipe créée avec succès ! Redirection en cours...
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations de base */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Informations de l'équipe
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nom de l'équipe *"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  placeholder="Ex: Équipe de nettoyage Centre"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Type d'intervention *</InputLabel>
                  <Select
                    value={formData.interventionType}
                    onChange={(e) => handleInputChange('interventionType', e.target.value)}
                    label="Type d'intervention *"
                  >
                    {interventionTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span style={{ fontSize: '1.2em' }}>{type.icon}</span>
                          {type.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Description */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Description de l'équipe et de ses responsabilités"
                />
              </Grid>
            </Grid>

            {/* Informations sur le type d'intervention */}
            {selectedInterventionType && (
              <Box sx={{ mb: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                  📋 Type d'intervention : {selectedInterventionType.icon} {selectedInterventionType.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rôles autorisés : {selectedInterventionType.roles.map(role => 
                    teamRoles.find(r => r.value === role)?.label
                  ).join(', ')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {filteredUsers.length} utilisateur(s) disponible(s) pour ce type d'intervention
                </Typography>
              </Box>
            )}

            {/* Membres de l'équipe */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Membres de l'équipe
            </Typography>

            {formData.members.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Aucun membre ajouté
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddMember}
                  disabled={filteredUsers.length === 0}
                >
                  {filteredUsers.length === 0 ? 'Aucun utilisateur disponible' : 'Ajouter le premier membre'}
                </Button>
                {filteredUsers.length === 0 && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                    Aucun utilisateur avec les rôles appropriés n'est disponible pour ce type d'intervention
                  </Typography>
                )}
              </Box>
            ) : (
              <List>
                {formData.members.map((member, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                          <Autocomplete
                            options={filteredUsers}
                            getOptionLabel={(user) => `${user.firstName} ${user.lastName} (${user.email})`}
                            value={filteredUsers.find(u => u.id === member.userId) || null}
                            onChange={(_, user) => handleUserSelection(index, user)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Sélectionner un utilisateur *"
                                required
                                size="small"
                              />
                            )}
                            renderOption={(props, user) => (
                              <li {...props}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Person />
                                  {user.firstName} {user.lastName} ({user.email})
                                </Box>
                              </li>
                            )}
                          />
                        </Grid>

                        <Grid item xs={12} md={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Rôle dans l'équipe</InputLabel>
                            <Select
                              value={member.role}
                              onChange={(e) => handleMemberChange(index, 'role', e.target.value)}
                              label="Rôle dans l'équipe"
                            >
                              {availableRoles.map((role) => (
                                <MenuItem key={role.value} value={role.value}>
                                  {role.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} md={3}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : 'Non sélectionné'}
                              color={member.userId ? 'primary' : 'default'}
                              size="small"
                            />
                            {member.role && (
                              <Chip
                                label={availableRoles.find(r => r.value === member.role)?.label || member.role}
                                variant="outlined"
                                size="small"
                              />
                            )}
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={2}>
                          <IconButton
                            onClick={() => handleRemoveMember(index)}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </ListItem>
                    {index < formData.members.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}

            {/* Bouton ajouter membre */}
            {formData.members.length > 0 && filteredUsers.length > formData.members.length && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddMember}
                >
                  Ajouter un membre
                </Button>
              </Box>
            )}
            
            {/* Bouton de soumission caché pour le PageHeader */}
            <Button
              type="submit"
              sx={{ display: 'none' }}
              data-submit-team
            >
              Soumettre
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeamForm;
