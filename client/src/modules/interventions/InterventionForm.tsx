import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  FormHelperText
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { InterventionType, INTERVENTION_TYPE_OPTIONS, InterventionTypeUtils } from '../../types/interventionTypes';
import { InterventionStatus, INTERVENTION_STATUS_OPTIONS, Priority, PRIORITY_OPTIONS } from '../../types/statusEnums';

interface InterventionFormData {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  requestorId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  estimatedCost?: number;
  notes: string;
  photos: string;
  progressPercentage: number;
}

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
}

const interventionTypes = INTERVENTION_TYPE_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

// Utilisation des enums partagés
const statuses = INTERVENTION_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

const priorities = PRIORITY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

interface InterventionFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
}

const InterventionForm: React.FC<InterventionFormProps> = ({ onClose, onSuccess, setLoading, loading }) => {
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  
  // Vérifier la permission de création d'interventions
  const [canCreateInterventions, setCanCreateInterventions] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canCreate = isAdmin() || isManager();
      setCanCreateInterventions(canCreate);
    };
    
    checkPermissions();
  }, [isAdmin, isManager]);

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);



  const [formData, setFormData] = useState<InterventionFormData>({
    title: '',
    description: '',
    type: InterventionType.CLEANING,
    status: InterventionStatus.PENDING,
    priority: Priority.NORMAL,
    propertyId: 0,
    requestorId: 0,
    assignedToId: undefined,
    assignedToType: undefined,
    scheduledDate: '',
    estimatedDurationHours: 1,
    estimatedCost: undefined,
    notes: '',
    photos: '',
    progressPercentage: 0
  });

  // Définir l'utilisateur par défaut selon le rôle
  useEffect(() => {
    if (isHost() && user?.id) {
      // Pour un HOST, essayer de trouver son ID dans la base
      const hostUser = users.find(u => u.email === user.email);
      if (hostUser) {
        setFormData(prev => ({ ...prev, requestorId: hostUser.id }));
      }
    } else if (!isAdmin() && !isManager()) {
      // Pour les autres rôles non-admin, sélectionner automatiquement l'utilisateur connecté
      const currentUser = users.find(u => u.email === user?.email);
      if (currentUser) {
        setFormData(prev => ({ ...prev, requestorId: currentUser.id }));
      }
    }
  }, [users, user, isHost, isAdmin, isManager]);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔍 InterventionForm - Début du chargement des données');
        setIsLoading(true);
        setError(null);

        // Charger les propriétés
        console.log('🔍 InterventionForm - Chargement des propriétés...');
        const propertiesResponse = await fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          console.log('🔍 InterventionForm - Propriétés chargées:', propertiesData);
          setProperties(propertiesData.content || propertiesData);
        } else {
          console.error('🔍 InterventionForm - Erreur chargement propriétés:', propertiesResponse.status);
        }

        // Charger les utilisateurs
        console.log('🔍 InterventionForm - Chargement des utilisateurs...');
        const usersResponse = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log('🔍 InterventionForm - Utilisateurs chargés:', usersData);
          setUsers(usersData.content || usersData);
        } else {
          console.error('🔍 InterventionForm - Erreur chargement utilisateurs:', usersResponse.status);
        }

        // Charger les équipes
        console.log('🔍 InterventionForm - Chargement des équipes...');
        const teamsResponse = await fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          console.log('🔍 InterventionForm - Équipes chargées:', teamsData);
          setTeams(teamsData.content || teamsData);
        } else {
          console.error('🔍 InterventionForm - Erreur chargement équipes:', teamsResponse.status);
        }

      } catch (err) {
        console.error('🔍 InterventionForm - Erreur chargement:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        console.log('🔍 InterventionForm - Fin du chargement des données');
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Si l'utilisateur n'a pas la permission de créer des interventions, ne rien afficher
  // ATTENTION : Cette vérification doit être APRÈS tous les hooks !
  if (!canCreateInterventions) {
    return null;
  }

  const handleInputChange = (field: keyof InterventionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.propertyId || !formData.requestorId) {
      setError('Veuillez sélectionner une propriété et un demandeur');
      return;
    }

    if (setLoading) {
      setLoading(true);
    } else {
      setSaving(true);
    }
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const savedIntervention = await response.json();
        console.log('🔍 InterventionForm - Intervention créée:', savedIntervention);
        
        // Utiliser onSuccess si fourni, sinon rediriger
        if (onSuccess) {
          onSuccess();
        } else {
          // Redirection par défaut si pas de callback
          window.location.href = `/interventions/${savedIntervention.id}`;
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error('🔍 InterventionForm - Erreur création:', err);
      setError('Erreur lors de la création');
    } finally {
      if (setLoading) {
        setLoading(false);
      } else {
        setSaving(false);
      }
    }
  };

  // Vérifier les droits d'accès
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          {/* Informations principales */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Informations principales
                </Typography>
                
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Titre"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      required
                      error={!formData.title}
                      helperText={!formData.title ? 'Le titre est obligatoire' : ''}
                      size="small"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      multiline
                      rows={3}
                      required
                      size="small"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Type d'intervention</InputLabel>
                      <Select
                        value={formData.type}
                        onChange={(e) => handleInputChange('type', e.target.value)}
                        label="Type d'intervention"
                        size="small"
                      >
                        {interventionTypes.map((type) => {
                          const typeOption = INTERVENTION_TYPE_OPTIONS.find(option => option.value === type.value);
                          const IconComponent = typeOption?.icon;
                          
                          return (
                            <MenuItem key={type.value} value={type.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                {IconComponent && <IconComponent sx={{ fontSize: 18 }} />}
                                <Typography variant="body2">{type.label}</Typography>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Statut</InputLabel>
                      <Select
                        value={formData.status}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        label="Statut"
                        size="small"
                      >
                        {statuses.map((status) => (
                          <MenuItem key={status.value} value={status.value}>
                            {status.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Priorité</InputLabel>
                      <Select
                        value={formData.priority}
                        onChange={(e) => handleInputChange('priority', e.target.value)}
                        label="Priorité"
                        size="small"
                      >
                        {priorities.map((priority) => (
                          <MenuItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Date prévue"
                      type="datetime-local"
                      value={formData.scheduledDate}
                      onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                      required
                      size="small"
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Durée estimée (heures)"
                      type="number"
                      value={formData.estimatedDurationHours}
                      onChange={(e) => handleInputChange('estimatedDurationHours', parseInt(e.target.value))}
                      required
                      inputProps={{ min: 1, max: 24 }}
                      size="small"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Progression initiale (%)"
                      type="number"
                      value={formData.progressPercentage}
                      onChange={(e) => handleInputChange('progressPercentage', parseInt(e.target.value))}
                      inputProps={{ min: 0, max: 100 }}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Informations secondaires */}
          <Grid item xs={12} md={4}>
            {/* Propriété et demandeur */}
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Propriété et demandeur
                </Typography>
                
                <FormControl fullWidth required sx={{ mb: 1.5 }}>
                  <InputLabel>Propriété</InputLabel>
                  <Select
                    value={formData.propertyId}
                    onChange={(e) => handleInputChange('propertyId', e.target.value)}
                    label="Propriété"
                    size="small"
                  >
                    {properties.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        <Typography variant="body2">{property.name} - {property.address}, {property.city}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth required>
                  <InputLabel>Demandeur</InputLabel>
                  <Select
                    value={formData.requestorId}
                    onChange={(e) => handleInputChange('requestorId', e.target.value)}
                    label="Demandeur"
                    disabled={!isAdmin() && !isManager()} // Seuls les admin/manager peuvent changer le demandeur
                    size="small"
                  >
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Typography variant="body2">{user.firstName} {user.lastName} ({user.email})</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                  {!isAdmin() && !isManager() && (
                    <FormHelperText sx={{ fontSize: '0.7rem' }}>
                      Le demandeur est automatiquement défini selon votre rôle
                    </FormHelperText>
                  )}
                </FormControl>
              </CardContent>
            </Card>

            {/* Assignation */}
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Assignation
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 1.5 }}>
                  <InputLabel>Type d'assignation</InputLabel>
                  <Select
                    value={formData.assignedToType || ''}
                    onChange={(e) => {
                      handleInputChange('assignedToType', e.target.value);
                      handleInputChange('assignedToId', undefined);
                    }}
                    label="Type d'assignation"
                    size="small"
                  >
                    <MenuItem value="">Aucune assignation</MenuItem>
                    <MenuItem value="user">Utilisateur</MenuItem>
                    <MenuItem value="team">Équipe</MenuItem>
                  </Select>
                </FormControl>
                
                {formData.assignedToType === 'user' && (
                  <FormControl fullWidth>
                    <InputLabel>Utilisateur assigné</InputLabel>
                    <Select
                      value={formData.assignedToId || ''}
                      onChange={(e) => handleInputChange('assignedToId', e.target.value)}
                      label="Utilisateur assigné"
                      size="small"
                    >
                      {users.filter(user => ['TECHNICIAN', 'SUPERVISOR', 'MANAGER'].includes(user.role)).map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          <Typography variant="body2">{user.firstName} {user.lastName} ({user.role})</Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                
                {formData.assignedToType === 'team' && (
                  <FormControl fullWidth>
                    <InputLabel>Équipe assignée</InputLabel>
                    <Select
                      value={formData.assignedToId || ''}
                      onChange={(e) => handleInputChange('assignedToId', e.target.value)}
                      label="Équipe assignée"
                      size="small"
                    >
                      {teams.map((team) => (
                        <MenuItem key={team.id} value={team.id}>
                          <Typography variant="body2">{team.name} ({team.interventionType})</Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </CardContent>
            </Card>

            {/* Coûts */}
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Coûts
                </Typography>
                
                <TextField
                  fullWidth
                  label="Coût estimé (€)"
                  type="number"
                  value={formData.estimatedCost || ''}
                  onChange={(e) => handleInputChange('estimatedCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                  inputProps={{ min: 0, step: 0.01 }}
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Notes et photos */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Notes et photos
                </Typography>
                
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  multiline
                  rows={3}
                  sx={{ mb: 1.5 }}
                  size="small"
                />
                
                <TextField
                  fullWidth
                  label="URL des photos"
                  value={formData.photos}
                  onChange={(e) => handleInputChange('photos', e.target.value)}
                  placeholder="Séparer les URLs par des virgules"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Bouton de soumission caché pour le PageHeader */}
        <Button
          type="submit"
          sx={{ display: 'none' }}
          data-submit-intervention
        >
          Soumettre
        </Button>
      </form>
    </Box>
  );
};

export default InterventionForm;
