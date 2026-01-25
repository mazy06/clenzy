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
  Person,
  Add,
  Description,
  Schedule,
  PriorityHigh,
  Category,
  Group,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { InterventionType, INTERVENTION_TYPE_OPTIONS, InterventionTypeUtils } from '../../types/interventionTypes';
import { useTranslation } from '../../hooks/useTranslation';

// Types pour les demandes de service
export interface ServiceRequestFormData {
  title: string;
  description: string;
  propertyId: number;
  serviceType: string; // Changed from 'type' to 'serviceType'
  priority: string;
  estimatedDurationHours: number; // Changed from 'estimatedDuration' to 'estimatedDurationHours'
  desiredDate: string; // Changed from 'dueDate' to 'desiredDate'
  userId: number; // Changed from 'requestorId' to 'userId'
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
}

// Type pour les propriétés
interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  ownerId?: number; // Added ownerId
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

interface ServiceRequestFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({ onClose, onSuccess, setLoading, loading }) => {
  const navigate = useNavigate();
  const { user, hasPermissionAsync,  isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // IMPORTANT: déclarer tous les hooks avant tout retour conditionnel
  const [formData, setFormData] = useState<ServiceRequestFormData>({
    title: '',
    description: '',
    propertyId: 0,
    serviceType: 'CLEANING', // Updated to match backend enum
    priority: 'NORMAL', // Updated to match backend enum
    estimatedDurationHours: 1,
    desiredDate: '',
    userId: 0,
    assignedToId: undefined,
    assignedToType: undefined,
  });

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
          console.log('🔍 ServiceRequestForm - Propriétés chargées:', propertiesList);
          setProperties(propertiesList);
          
          // Si c'est un HOST, définir automatiquement sa première propriété
          if (isHost() && propertiesList.length > 0) {
            const hostProperty = propertiesList.find((prop: Property) => 
              prop.ownerId?.toString() === user?.id?.toString()
            );
            if (hostProperty) {
              console.log('🔍 ServiceRequestForm - Propriété HOST trouvée:', hostProperty);
              setFormData(prev => ({ ...prev, propertyId: hostProperty.id }));
            } else {
              console.warn('🔍 ServiceRequestForm - Aucune propriété trouvée pour le HOST:', user?.id);
            }
          }
        }
      } catch (err) {
        console.error('🔍 ServiceRequestForm - Erreur chargement propriétés:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadProperties();
  }, [isHost, user?.id]);

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
          console.log('🔍 ServiceRequestForm - Utilisateurs chargés:', usersList);
          setUsers(usersList);
          
          // Si c'est un HOST, définir automatiquement son ID comme demandeur
          if (isHost() && user?.id) {
            const hostUser = usersList.find((u: User) => u.id.toString() === user.id.toString());
            if (hostUser) {
              console.log('🔍 ServiceRequestForm - Utilisateur HOST trouvé:', hostUser);
              setFormData(prev => ({ ...prev, userId: hostUser.id }));
            } else {
              console.warn('🔍 ServiceRequestForm - Utilisateur HOST non trouvé dans la liste:', user.id);
            }
          }
        }
      } catch (err) {
        console.error('🔍 ServiceRequestForm - Erreur chargement utilisateurs:', err);
      }
    };

    loadUsers();
  }, [isHost, user?.id]);

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
          console.log('🔍 ServiceRequestForm - Équipes chargées:', teamsList);
          setTeams(teamsList);
        }
      } catch (err) {
        console.error('🔍 ServiceRequestForm - Erreur chargement équipes:', err);
      }
    };

    loadTeams();
  }, []);

  // Définir l'utilisateur par défaut selon le rôle
  useEffect(() => {
    if (isHost() && user?.id) {
      // Pour un HOST, essayer de trouver son ID dans la base
      const hostUser = users.find(u => u.email === user.email);
      if (hostUser) {
        setFormData(prev => ({ ...prev, userId: hostUser.id }));
      }
    } else if (!isAdmin() && !isManager()) {
      // Pour les autres rôles non-admin, sélectionner automatiquement l'utilisateur connecté
      const currentUser = users.find(u => u.email === user?.email);
      if (currentUser) {
        setFormData(prev => ({ ...prev, userId: currentUser.id }));
      }
    }
  }, [users, user, isHost, isAdmin, isManager]);

  // Vérifier les permissions silencieusement
  const [canCreate, setCanCreate] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('service-requests:create');
      setCanCreate(canCreatePermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;
  
  // Si l'utilisateur n'a pas les permissions, ne rien afficher
  if (!canCreate) {
    return null;
  }
  
  if (loadingData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }
  
  const handleInputChange = (field: keyof ServiceRequestFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 ServiceRequestForm - Tentative de soumission, formData:', formData);
    console.log('🔍 ServiceRequestForm - propertyId:', formData.propertyId, 'userId:', formData.userId);
    
    if (!formData.propertyId || !formData.userId) {
      console.error('🔍 ServiceRequestForm - Erreur: propertyId ou userId manquant');
      setError(t('serviceRequests.errors.selectPropertyRequestor'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Transformer la date en format ISO pour le backend
      const desiredDate = formData.desiredDate ? new Date(formData.desiredDate).toISOString() : null;
      
      // Préparer les données pour le backend
      const backendData = {
        title: formData.title,
        description: formData.description,
        propertyId: formData.propertyId,
        serviceType: formData.serviceType,
        priority: formData.priority,
        estimatedDurationHours: formData.estimatedDurationHours,
        desiredDate: desiredDate,
        userId: formData.userId,
        assignedToId: formData.assignedToId || null,
        assignedToType: formData.assignedToType || null,
        status: 'PENDING', // Statut par défaut - doit être en majuscule
      };

      console.log('🔍 ServiceRequestForm - Données envoyées au backend:', backendData);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(backendData),
      });

      if (response.ok) {
        // Utiliser onSuccess si fourni, sinon rediriger
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/service-requests?success=true');
        }
      } else {
        const errorData = await response.json();
        console.error('🔍 ServiceRequestForm - Erreur création:', errorData);
        setError(t('serviceRequests.errors.createErrorDetails') + ': ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 ServiceRequestForm - Erreur création:', err);
      setError(t('serviceRequests.errors.createError'));
    } finally {
      setSaving(false);
    }
  };

  // Constantes pour les enums
  const serviceTypes = INTERVENTION_TYPE_OPTIONS.map(option => ({
    value: option.value,
    label: option.label
  }));

  const priorities = [
    { value: 'LOW', label: t('serviceRequests.priorities.low') },
    { value: 'NORMAL', label: t('serviceRequests.priorities.normal') },
    { value: 'HIGH', label: t('serviceRequests.priorities.high') },
    { value: 'CRITICAL', label: t('serviceRequests.priorities.critical') },
  ];

  const durations = [
    { value: 0.5, label: t('serviceRequests.durations.30min') },
    { value: 1, label: t('serviceRequests.durations.1h') },
    { value: 1.5, label: t('serviceRequests.durations.1h30') },
    { value: 2, label: t('serviceRequests.durations.2h') },
    { value: 3, label: t('serviceRequests.durations.3h') },
    { value: 4, label: t('serviceRequests.durations.4h') },
    { value: 6, label: t('serviceRequests.durations.6h') },
    { value: 8, label: t('serviceRequests.durations.8h') },
  ];

  // Filtrer les utilisateurs par rôle approprié pour l'assignation
  const getAssignableUsers = () => {
    return users.filter(user => 
      ['housekeeper', 'technician', 'supervisor', 'manager'].includes(user.role.toLowerCase())
    );
  };

  // Obtenir le label du type d'intervention
  const getInterventionTypeLabel = (type: string) => {
    const interventionTypes: Record<string, string> = {
      cleaning: t('serviceRequests.interventionTypes.cleaning'),
      maintenance: t('serviceRequests.interventionTypes.maintenance'),
      repair: t('serviceRequests.interventionTypes.repair'),
      inspection: t('serviceRequests.interventionTypes.inspection'),
      mixed: t('serviceRequests.interventionTypes.mixed'),
    };
    return interventionTypes[type.toLowerCase()] || type;
  };

  return (
    <Box>
      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {/* Formulaire */}
      <Card sx={{ mt: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations de base */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.basicInfo')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label={`${t('serviceRequests.fields.title')} *`}
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                  placeholder={t('serviceRequests.fields.titlePlaceholder')}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>{t('serviceRequests.fields.serviceType')} *</InputLabel>
                  <Select
                    value={formData.serviceType}
                    onChange={(e) => handleInputChange('serviceType', e.target.value)}
                    label={`${t('serviceRequests.fields.serviceType')} *`}
                    size="small"
                  >
                    {serviceTypes.map((type) => {
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
            </Grid>

            {/* Description */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.description')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label={`${t('serviceRequests.fields.detailedDescription')} *`}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                  placeholder={t('serviceRequests.fields.descriptionPlaceholder')}
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Propriété */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.property')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>{t('serviceRequests.fields.property')} *</InputLabel>
                  <Select
                    value={formData.propertyId}
                    onChange={(e) => handleInputChange('propertyId', e.target.value)}
                    label={`${t('serviceRequests.fields.property')} *`}
                    size="small"
                  >
                    {properties.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Home sx={{ fontSize: 18 }} />
                          <Typography variant="body2">{property.name} - {property.address}, {property.city}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Priorité et durée */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.priorityPlanning')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>{t('serviceRequests.fields.priority')} *</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    label={`${t('serviceRequests.fields.priority')} *`}
                    size="small"
                  >
                    {priorities.map((priority) => (
                      <MenuItem key={priority.value} value={priority.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <PriorityHigh sx={{ fontSize: 18 }} />
                          <Typography variant="body2">{priority.label}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>{t('serviceRequests.fields.estimatedDuration')} *</InputLabel>
                  <Select
                    value={formData.estimatedDurationHours}
                    onChange={(e) => handleInputChange('estimatedDurationHours', e.target.value)}
                    label={`${t('serviceRequests.fields.estimatedDuration')} *`}
                    size="small"
                  >
                    {durations.map((duration) => (
                      <MenuItem key={duration.value} value={duration.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Schedule sx={{ fontSize: 18 }} />
                          <Typography variant="body2">{duration.label}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label={`${t('serviceRequests.fields.dueDate')} *`}
                  type="datetime-local"
                  value={formData.desiredDate}
                  onChange={(e) => handleInputChange('desiredDate', e.target.value)}
                  required
                  size="small"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
            </Grid>

            {/* Demandeur et assignation */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.requestorAssignment')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              {/* Demandeur */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>{t('serviceRequests.fields.requestor')} *</InputLabel>
                  <Select
                    value={formData.userId}
                    onChange={(e) => handleInputChange('userId', e.target.value)}
                    label={`${t('serviceRequests.fields.requestor')} *`}
                    disabled={!isAdmin() && !isManager()} // Seuls les admin/manager peuvent changer le demandeur
                    size="small"
                  >
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Person sx={{ fontSize: 18 }} />
                          <Typography variant="body2">{user.firstName} {user.lastName} ({user.role}) - {user.email}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  {!isAdmin() && !isManager() && (
                    <FormHelperText sx={{ fontSize: '0.7rem' }}>
                      {t('serviceRequests.fields.requestorHelper')}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('serviceRequests.fields.assignmentType')}</InputLabel>
                  <Select
                    value={formData.assignedToType || ''}
                    onChange={(e) => {
                      handleInputChange('assignedToType', e.target.value || undefined);
                      handleInputChange('assignedToId', undefined);
                    }}
                    label={t('serviceRequests.fields.assignmentType')}
                    size="small"
                  >
                    <MenuItem value="">
                      <em>{t('serviceRequests.fields.noAssignment')}</em>
                    </MenuItem>
                    <MenuItem value="user">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Person sx={{ fontSize: 18 }} />
                        <Typography variant="body2">{t('serviceRequests.fields.individualUser')}</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="team">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Group sx={{ fontSize: 18 }} />
                        <Typography variant="body2">{t('serviceRequests.fields.team')}</Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Assignation spécifique */}
            {formData.assignedToType && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>
                      {formData.assignedToType === 'user' ? t('serviceRequests.fields.assignedToUser') : t('serviceRequests.fields.assignedToTeam')}
                    </InputLabel>
                    <Select
                      value={formData.assignedToId || ''}
                      onChange={(e) => handleInputChange('assignedToId', e.target.value || undefined)}
                      label={formData.assignedToType === 'user' ? t('serviceRequests.fields.assignedToUser') : t('serviceRequests.fields.assignedToTeam')}
                      size="small"
                    >
                      <MenuItem value="">
                        <em>{t('serviceRequests.fields.select')}</em>
                      </MenuItem>
                      {formData.assignedToType === 'user' ? (
                        getAssignableUsers().map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Person sx={{ fontSize: 18 }} />
                              <Typography variant="body2">{user.firstName} {user.lastName} ({user.role}) - {user.email}</Typography>
                            </Box>
                          </MenuItem>
                        ))
                      ) : (
                        teams.map((team) => (
                          <MenuItem key={team.id} value={team.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Group sx={{ fontSize: 18 }} />
                              <Box>
                                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                                  {team.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                  {team.memberCount} {t('serviceRequests.members')} • {getInterventionTypeLabel(team.interventionType)}
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

          </form>
          
          {/* Bouton de soumission caché pour le PageHeader */}
          <Button
            type="submit"
            sx={{ display: 'none' }}
            data-submit-service-request
          >
            Soumettre
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ServiceRequestForm;
