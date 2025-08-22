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

const statuses = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' }
];

const priorities = [
  { value: 'LOW', label: 'Basse' },
  { value: 'NORMAL', label: 'Normale' },
  { value: 'HIGH', label: 'Élevée' },
  { value: 'CRITICAL', label: 'Critique' }
];

interface InterventionFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
}

const InterventionForm: React.FC<InterventionFormProps> = ({ onClose, onSuccess, setLoading, loading }) => {
  const { user, hasPermission, isAdmin, isManager, isHost } = useAuth();
  
  // Vérifier la permission de création d'interventions silencieusement
  const canCreateInterventions = isAdmin() || isManager();

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Si l'utilisateur n'a pas la permission de créer des interventions, ne rien afficher
  if (!canCreateInterventions) {
    return null;
  }

  const [formData, setFormData] = useState<InterventionFormData>({
    title: '',
    description: '',
    type: InterventionType.CLEANING,
    status: 'PENDING',
    priority: 'NORMAL',
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
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Informations principales */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informations principales
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Titre"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      required
                      error={!formData.title}
                      helperText={!formData.title ? 'Le titre est obligatoire' : ''}
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
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Type d'intervention</InputLabel>
                      <Select
                        value={formData.type}
                        onChange={(e) => handleInputChange('type', e.target.value)}
                        label="Type d'intervention"
                      >
                        {interventionTypes.map((type) => {
                          const typeOption = INTERVENTION_TYPE_OPTIONS.find(option => option.value === type.value);
                          const IconComponent = typeOption?.icon;
                          
                          return (
                            <MenuItem key={type.value} value={type.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {IconComponent && <IconComponent sx={{ fontSize: '1.2em' }} />}
                                {type.label}
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
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Informations secondaires */}
          <Grid item xs={12} md={4}>
            {/* Propriété et demandeur */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Propriété et demandeur
                </Typography>
                
                <FormControl fullWidth required sx={{ mb: 2 }}>
                  <InputLabel>Propriété</InputLabel>
                  <Select
                    value={formData.propertyId}
                    onChange={(e) => handleInputChange('propertyId', e.target.value)}
                    label="Propriété"
                  >
                    {properties.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        {property.name} - {property.address}, {property.city}
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
                  >
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </MenuItem>
                    ))}
                  </Select>
                  {!isAdmin() && !isManager() && (
                    <FormHelperText>
                      Le demandeur est automatiquement défini selon votre rôle
                    </FormHelperText>
                  )}
                </FormControl>
              </CardContent>
            </Card>

            {/* Assignation */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Assignation
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Type d'assignation</InputLabel>
                  <Select
                    value={formData.assignedToType || ''}
                    onChange={(e) => {
                      handleInputChange('assignedToType', e.target.value);
                      handleInputChange('assignedToId', undefined);
                    }}
                    label="Type d'assignation"
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
                    >
                      {users.filter(user => ['TECHNICIAN', 'SUPERVISOR', 'MANAGER'].includes(user.role)).map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.role})
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
                    >
                      {teams.map((team) => (
                        <MenuItem key={team.id} value={team.id}>
                          {team.name} ({team.interventionType})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </CardContent>
            </Card>

            {/* Coûts */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Coûts
                </Typography>
                
                <TextField
                  fullWidth
                  label="Coût estimé (€)"
                  type="number"
                  value={formData.estimatedCost || ''}
                  onChange={(e) => handleInputChange('estimatedCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Notes et photos */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Notes et photos
                </Typography>
                
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  multiline
                  rows={3}
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="URL des photos"
                  value={formData.photos}
                  onChange={(e) => handleInputChange('photos', e.target.value)}
                  placeholder="Séparer les URLs par des virgules"
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
