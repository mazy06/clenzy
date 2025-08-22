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
  FormHelperText,
  Chip,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Home,
  LocationOn,
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Close,
  Save,
  Cancel,
  ArrowBack,
  Person,
  Add,
  Description,
  Schedule,
  PriorityHigh,
  Category,
  Group,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { RequestStatus, REQUEST_STATUS_OPTIONS, Priority, PRIORITY_OPTIONS } from '../../types/statusEnums';

// Types pour les demandes de service
export interface ServiceRequestFormData {
  title: string;
  description: string;
  propertyId: number;
  type: string;
  priority: string;
  estimatedDuration: number;
  dueDate: string;
  requestorId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  status: string;
}

// Type pour les propriétés
interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
}

// Type pour les utilisateurs
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// Type pour les équipes
interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
}

const ServiceRequestEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission, isAdmin, isManager, isHost } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // IMPORTANT: déclarer tous les hooks avant tout retour conditionnel
  const [formData, setFormData] = useState<ServiceRequestFormData>({
    title: '',
    description: '',
    propertyId: 0,
    type: 'CLEANING',
    priority: 'NORMAL',
    estimatedDuration: 1,
    dueDate: '',
    requestorId: 0,
    assignedToId: undefined,
    assignedToType: undefined,
    status: 'PENDING',
  });

  // Charger les données de la demande de service
  useEffect(() => {
    const loadServiceRequest = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const serviceRequest = await response.json();
          console.log('🔍 ServiceRequestEdit - Demande de service chargée:', serviceRequest);
          
          setFormData({
            title: serviceRequest.title || '',
            description: serviceRequest.description || '',
            propertyId: serviceRequest.propertyId || 0,
            type: serviceRequest.serviceType || 'CLEANING',
            priority: serviceRequest.priority || 'NORMAL',
            estimatedDuration: serviceRequest.estimatedDurationHours || 1,
            dueDate: serviceRequest.desiredDate ? new Date(serviceRequest.desiredDate).toISOString().slice(0, 16) : '',
            requestorId: serviceRequest.userId || 0,
            assignedToId: serviceRequest.assignedToId || undefined,
            assignedToType: serviceRequest.assignedToType || undefined,
            status: serviceRequest.status || 'PENDING',
          });
        } else {
          setError('Erreur lors du chargement de la demande de service');
        }
      } catch (err) {
        console.error('🔍 ServiceRequestEdit - Erreur chargement demande:', err);
        setError('Erreur lors du chargement de la demande de service');
      } finally {
        setLoading(false);
      }
    };

    loadServiceRequest();
  }, [id]);

  // Charger les propriétés depuis l'API
  useEffect(() => {
    const loadProperties = async () => {
      setLoadingData(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const propertiesList = data.content || data;
          console.log('🔍 ServiceRequestEdit - Propriétés chargées:', propertiesList);
          setProperties(propertiesList);
        }
      } catch (err) {
        console.error('🔍 ServiceRequestEdit - Erreur chargement propriétés:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadProperties();
  }, []);

  // Charger la liste des utilisateurs depuis l'API
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const usersList = data.content || data;
          console.log('🔍 ServiceRequestEdit - Utilisateurs chargés:', usersList);
          setUsers(usersList);
        }
      } catch (err) {
        console.error('🔍 ServiceRequestEdit - Erreur chargement utilisateurs:', err);
      }
    };

    loadUsers();
  }, []);

  // Charger la liste des équipes depuis l'API
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const teamsList = data.content || data;
          console.log('🔍 ServiceRequestEdit - Équipes chargées:', teamsList);
          setTeams(teamsList);
        }
      } catch (err) {
        console.error('🔍 ServiceRequestEdit - Erreur chargement équipes:', err);
      }
    };

    loadTeams();
  }, []);

  // Vérifier les permissions APRÈS tous les hooks
  if (!hasPermission('service-requests:edit')) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Vous n'avez pas les permissions nécessaires pour modifier les demandes de service.
        </Alert>
      </Box>
    );
  }

  const handleInputChange = (field: keyof ServiceRequestFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      // Préparer les données pour le backend
      const backendData = {
        title: formData.title,
        description: formData.description,
        propertyId: formData.propertyId,
        serviceType: formData.type,
        priority: formData.priority,
        estimatedDurationHours: formData.estimatedDuration,
        desiredDate: formData.dueDate,
        userId: formData.requestorId,
        assignedToId: formData.assignedToId || null,
        assignedToType: formData.assignedToType || null,
        status: formData.status,
      };

      console.log('🔍 ServiceRequestEdit - Données envoyées au backend:', backendData);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(backendData),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate(`/service-requests/${id}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('🔍 ServiceRequestEdit - Erreur mise à jour:', errorData);
        setError('Erreur lors de la mise à jour: ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 ServiceRequestEdit - Erreur mise à jour:', err);
      setError('Erreur lors de la mise à jour de la demande de service');
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Empêcher l'édition si la demande est déjà approuvée
  if (formData.status === 'APPROVED') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Cette demande de service a été approuvée et ne peut plus être modifiée.
          Une intervention a été créée automatiquement.
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate(`/service-requests/${id}`)}
          startIcon={<ArrowBack />}
        >
          Retour aux détails
        </Button>
      </Box>
    );
  }

  // Constantes pour les enums
  const serviceTypes = [
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
    { value: 'OTHER', label: 'Autre' },
  ];

  const priorities = [
    { value: 'LOW', label: 'Faible' },
    { value: 'NORMAL', label: 'Normale' },
    { value: 'HIGH', label: 'Élevée' },
    { value: 'CRITICAL', label: 'Critique' },
  ];

  // Utilisation des enums partagés pour les statuts
  const statuses = REQUEST_STATUS_OPTIONS.map(option => ({
    value: option.value,
    label: option.label
  }));

  const durations = [
    { value: 0.5, label: '30 min' },
    { value: 1, label: '1h' },
    { value: 1.5, label: '1h30' },
    { value: 2, label: '2h' },
    { value: 3, label: '3h' },
    { value: 4, label: '4h' },
    { value: 6, label: '6h' },
    { value: 8, label: '8h' },
  ];

  // Filtrer les utilisateurs par rôle approprié pour l'assignation
  const getAssignableUsers = () => {
    return users.filter(user => 
      ['housekeeper', 'technician', 'supervisor', 'manager'].includes(user.role.toLowerCase())
    );
  };

  // Obtenir le label du type d'intervention
  const getInterventionTypeLabel = (type: string) => {
    const interventionTypes = {
      cleaning: '🧹 Nettoyage',
      maintenance: '🔧 Maintenance',
      repair: '🔨 Réparation',
      inspection: '🔍 Inspection',
      mixed: '👥 Mixte',
    };
    return interventionTypes[type as keyof typeof interventionTypes] || type;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header avec bouton retour */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => navigate(`/service-requests/${id}`)} 
          sx={{ mr: 2 }}
          size="large"
        >
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" fontWeight={700}>
          Modifier la demande de service
        </Typography>
      </Box>

      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Demande de service mise à jour avec succès ! Redirection en cours...
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations de base */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Informations de base
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Titre de la demande *"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                  placeholder="Ex: Nettoyage après départ"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Type de service *</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    label="Type de service *"
                  >
                    {serviceTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Category />
                          {type.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Statut *</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    label="Statut *"
                  >
                    {statuses.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Description */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Description
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description détaillée *"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                  placeholder="Décrivez en détail la demande de service..."
                />
              </Grid>
            </Grid>

            {/* Propriété */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Propriété concernée
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Propriété *</InputLabel>
                  <Select
                    value={formData.propertyId}
                    onChange={(e) => handleInputChange('propertyId', e.target.value)}
                    label="Propriété *"
                  >
                    {properties.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Home />
                          {property.name} - {property.address}, {property.city}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Priorité et durée */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Priorité et planification
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Priorité *</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    label="Priorité *"
                  >
                    {priorities.map((priority) => (
                      <MenuItem key={priority.value} value={priority.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PriorityHigh />
                          {priority.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Durée estimée *</InputLabel>
                  <Select
                    value={formData.estimatedDuration}
                    onChange={(e) => handleInputChange('estimatedDuration', e.target.value)}
                    label="Durée estimée *"
                  >
                    {durations.map((duration) => (
                      <MenuItem key={duration.value} value={duration.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Schedule />
                          {duration.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Date d'échéance *"
                  type="datetime-local"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  required
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
            </Grid>

            {/* Demandeur et assignation */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Demandeur et assignation
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Demandeur *</InputLabel>
                  <Select
                    value={formData.requestorId}
                    onChange={(e) => handleInputChange('requestorId', e.target.value)}
                    label="Demandeur *"
                  >
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Person />
                          {user.firstName} {user.lastName} ({user.email})
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Type d'assignation</InputLabel>
                  <Select
                    value={formData.assignedToType || ''}
                    onChange={(e) => {
                      handleInputChange('assignedToType', e.target.value || undefined);
                      handleInputChange('assignedToId', undefined);
                    }}
                    label="Type d'assignation"
                  >
                    <MenuItem value="">
                      <em>Aucune assignation</em>
                    </MenuItem>
                    <MenuItem value="user">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person />
                        Utilisateur individuel
                      </Box>
                    </MenuItem>
                    <MenuItem value="team">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Group />
                        Équipe
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Assignation spécifique */}
            {formData.assignedToType && (
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>
                      {formData.assignedToType === 'user' ? 'Assigné à (utilisateur)' : 'Assigné à (équipe)'}
                    </InputLabel>
                    <Select
                      value={formData.assignedToId || ''}
                      onChange={(e) => handleInputChange('assignedToId', e.target.value || undefined)}
                      label={formData.assignedToType === 'user' ? 'Assigné à (utilisateur)' : 'Assigné à (équipe)'}
                    >
                      <MenuItem value="">
                        <em>Sélectionner...</em>
                      </MenuItem>
                      {formData.assignedToType === 'user' ? (
                        getAssignableUsers().map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Person />
                              {user.firstName} {user.lastName} ({user.role}) - {user.email}
                            </Box>
                          </MenuItem>
                        ))
                      ) : (
                        teams.map((team) => (
                          <MenuItem key={team.id} value={team.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Group />
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {team.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {team.memberCount} membre(s) • {getInterventionTypeLabel(team.interventionType)}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}

            {/* Boutons d'action */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => navigate(`/service-requests/${id}`)}
                startIcon={<Cancel />}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                disabled={saving}
              >
                {saving ? 'Mise à jour...' : 'Mettre à jour'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ServiceRequestEdit;
