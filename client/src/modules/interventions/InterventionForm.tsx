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
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

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

const interventionTypes = [
  { value: 'CLEANING', label: 'Nettoyage' },
  { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express' },
  { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur' },
  { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres' },
  { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols' },
  { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine' },
  { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires' },
  { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance Préventive' },
  { value: 'EMERGENCY_REPAIR', label: 'Réparation d\'Urgence' },
  { value: 'ELECTRICAL_REPAIR', label: 'Réparation Électrique' },
  { value: 'PLUMBING_REPAIR', label: 'Réparation Plomberie' },
  { value: 'HVAC_REPAIR', label: 'Réparation Climatisation' },
  { value: 'APPLIANCE_REPAIR', label: 'Réparation Électroménager' },
  { value: 'GARDENING', label: 'Jardinage' },
  { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Extérieur' },
  { value: 'PEST_CONTROL', label: 'Désinsectisation' },
  { value: 'DISINFECTION', label: 'Désinfection' },
  { value: 'RESTORATION', label: 'Remise en État' },
  { value: 'OTHER', label: 'Autre' }
];

const statuses = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' }
];

const priorities = [
  { value: 'LOW', label: 'Basse' },
  { value: 'NORMAL', label: 'Normale' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'URGENT', label: 'Urgente' }
];

export default function InterventionForm() {
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [formData, setFormData] = useState<InterventionFormData>({
    title: '',
    description: '',
    type: 'CLEANING',
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Charger les propriétés
        const propertiesResponse = await fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          setProperties(propertiesData.content || propertiesData);
        }

        // Charger les utilisateurs
        const usersResponse = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData.content || usersData);
        }

        // Charger les équipes
        const teamsResponse = await fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          setTeams(teamsData.content || teamsData);
        }

      } catch (err) {
        console.error('🔍 InterventionForm - Erreur chargement:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
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

    setSaving(true);
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
        
        // Rediriger vers les détails de l'intervention
        navigate(`/interventions/${savedIntervention.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error('🔍 InterventionForm - Erreur création:', err);
      setError('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  // Vérifier les droits d'accès
  if (!isAdmin() && !isManager()) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/interventions')}
          sx={{ mb: 2 }}
        >
          Retour aux interventions
        </Button>
        <Alert severity="error">
          Vous n'avez pas les droits pour créer des interventions. Seuls les administrateurs et managers peuvent créer des interventions.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Nouvelle intervention
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/interventions')}
        >
          Retour
        </Button>
      </Box>

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
                        {interventionTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Statut initial</InputLabel>
                      <Select
                        value={formData.status}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        label="Statut initial"
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
                      label="Date et heure planifiées"
                      type="datetime-local"
                      value={formData.scheduledDate}
                      onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                      required
                      InputLabelProps={{ shrink: true }}
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
                      inputProps={{ min: 1 }}
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
                  >
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </MenuItem>
                    ))}
                  </Select>
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

        {/* Actions */}
        <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => navigate('/interventions')}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            disabled={saving}
          >
            {saving ? 'Création...' : 'Créer l\'intervention'}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
