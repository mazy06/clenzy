import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  Snackbar,
  Fade
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { API_CONFIG } from '../../config/api';

export default function InterventionEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  
  // États du composant
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Données du formulaire
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  
  const [formDataExtended, setFormDataExtended] = useState({
    type: 'CLEANING',
    status: 'PENDING',
    priority: 'NORMAL',
    scheduledDate: '',
    estimatedDurationHours: 1,
    notes: ''
  });
  
  const [formDataAdvanced, setFormDataAdvanced] = useState({
    assignedToType: '',
    assignedToId: '',
    estimatedCost: '',
    actualCost: '',
    progressPercentage: 0,
    photos: ''
  });
  
  // Erreurs de validation
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  
  // Données réelles pour l'assignation
  const [availableUsers, setAvailableUsers] = useState<Array<{id: number, firstName: string, lastName: string, role: string}>>([]);
  const [availableTeams, setAvailableTeams] = useState<Array<{id: number, name: string, description: string, interventionType: string}>>([]);
  
  // Constantes pour les options
  const interventionTypes = useMemo(() => [
    { value: 'CLEANING', label: 'Nettoyage' },
    { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express' },
    { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'REPAIR', label: 'Réparation' },
    { value: 'OTHER', label: 'Autre' }
  ], []);
  
  const statuses = useMemo(() => [
    { value: 'PENDING', label: 'En attente' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'COMPLETED', label: 'Terminé' },
    { value: 'CANCELLED', label: 'Annulé' }
  ], []);
  
  const priorities = useMemo(() => [
    { value: 'LOW', label: 'Basse' },
    { value: 'NORMAL', label: 'Normale' },
    { value: 'HIGH', label: 'Haute' },
    { value: 'URGENT', label: 'Urgente' }
  ], []);
  
  // Chargement initial des données
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      
      try {
        // Charger les vraies données de l'intervention depuis l'API
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const interventionData = await response.json();
          console.log('🔍 InterventionEdit - Données de l\'intervention chargées:', interventionData);
          
          // Mettre à jour les données du formulaire avec les vraies données
          setFormData({
            title: interventionData.title || '',
            description: interventionData.description || ''
          });
          
          setFormDataExtended({
            type: interventionData.type || 'CLEANING',
            status: interventionData.status || 'PENDING',
            priority: interventionData.priority || 'NORMAL',
            scheduledDate: interventionData.scheduledDate ? new Date(interventionData.scheduledDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
            estimatedDurationHours: interventionData.estimatedDurationHours || 1,
            notes: interventionData.notes || ''
          });
          
          setFormDataAdvanced({
            assignedToType: interventionData.assignedToType || '',
            assignedToId: interventionData.assignedToId ? interventionData.assignedToId.toString() : '',
            estimatedCost: interventionData.estimatedCost ? interventionData.estimatedCost.toString() : '',
            actualCost: interventionData.actualCost ? interventionData.actualCost.toString() : '',
            progressPercentage: interventionData.progressPercentage || 0,
            photos: interventionData.photos || ''
          });
        } else {
          setError('Erreur lors du chargement de l\'intervention');
        }
        
      } catch (err) {
        console.error('🔍 InterventionEdit - Erreur chargement intervention:', err);
        setError('Erreur lors du chargement de l\'intervention');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [id]);
  
  // Chargement des utilisateurs et équipes disponibles
  useEffect(() => {
    const loadAvailableData = async () => {
      try {
        // Charger les utilisateurs
        const usersResponse = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          const filteredUsers = (usersData.content || usersData).filter((user: any) => 
            ['TECHNICIAN', 'SUPERVISOR', 'MANAGER'].includes(user.role)
          );
          setAvailableUsers(filteredUsers);
        }

        // Charger les équipes
        const teamsResponse = await fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          setAvailableTeams(teamsData.content || teamsData);
        }
      } catch (err) {
        console.error('🔍 InterventionEdit - Erreur chargement utilisateurs/équipes:', err);
        // Pas d'erreur critique, on peut continuer
      }
    };
    
    loadAvailableData();
  }, []);
  
  // Gestionnaires de changement optimisés
  const handleInputChange = useCallback((field: string, value: string) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, [validationErrors]);
  
  const handleExtendedInputChange = useCallback((field: string, value: any) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    setFormDataExtended(prev => ({
      ...prev,
      [field]: value
    }));
  }, [validationErrors]);
  
  const handleAdvancedInputChange = useCallback((field: string, value: any) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    if (field === 'assignedToType') {
      setFormDataAdvanced(prev => ({
        ...prev,
        [field]: value,
        assignedToId: ''
      }));
    } else {
      setFormDataAdvanced(prev => ({
        ...prev,
        [field]: value
      }));
    }
  }, [validationErrors]);
  
  // Validation du formulaire
  const validateForm = useCallback((): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Le titre est obligatoire';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'La description est obligatoire';
    }
    
    if (!formDataExtended.scheduledDate) {
      errors.scheduledDate = 'La date planifiée est obligatoire';
    }
    
    if (formDataExtended.estimatedDurationHours <= 0) {
      errors.estimatedDurationHours = 'La durée estimée doit être supérieure à 0';
    }
    
    if (formDataAdvanced.assignedToType && !formDataAdvanced.assignedToId) {
      errors.assignedToId = 'Veuillez sélectionner un assigné';
    }
    
    if (formDataAdvanced.progressPercentage < 0 || formDataAdvanced.progressPercentage > 100) {
      errors.progressPercentage = 'La progression doit être entre 0 et 100%';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, formDataExtended, formDataAdvanced]);
  
  // Soumission du formulaire
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      setLoading(true);
      setError(null);
      
      try {
        // Préparer les données dans le format attendu par le backend
        const allFormData = {
          ...formData,
          ...formDataExtended,
          ...formDataAdvanced,
          // Conversion des types pour correspondre au backend
          estimatedDurationHours: parseInt(formDataExtended.estimatedDurationHours.toString()),
          estimatedCost: formDataAdvanced.estimatedCost ? parseFloat(formDataAdvanced.estimatedCost) : null,
          actualCost: formDataAdvanced.actualCost ? parseFloat(formDataAdvanced.actualCost) : null,
          progressPercentage: parseInt(formDataAdvanced.progressPercentage.toString()),
          assignedToId: formDataAdvanced.assignedToId ? parseInt(formDataAdvanced.assignedToId) : null,
          // S'assurer que les champs obligatoires sont présents
          propertyId: 1, // À adapter selon votre logique métier
          requestorId: 1, // À adapter selon votre logique métier
        };
        
        console.log('🔍 InterventionEdit - Données à envoyer:', allFormData);
        
        // Appel API réel pour mettre à jour l'intervention
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(allFormData)
        });

        if (response.ok) {
          const updatedIntervention = await response.json();
          console.log('🔍 InterventionEdit - Intervention mise à jour avec succès:', updatedIntervention);
          
          setSuccess(true);
          
          // Redirection après un délai
          setTimeout(() => {
            navigate(`/interventions/${id}`);
          }, 1500);
        } else {
          const errorData = await response.json();
          console.error('🔍 InterventionEdit - Erreur API:', errorData);
          setError(errorData.message || 'Erreur lors de la mise à jour de l\'intervention');
        }
        
      } catch (err) {
        console.error('🔍 InterventionEdit - Erreur lors de la sauvegarde:', err);
        setError('Erreur lors de la sauvegarde');
      } finally {
        setLoading(false);
      }
    }
  }, [formData, formDataExtended, formDataAdvanced, validateForm, navigate, id]);
  
  // Vérification des permissions
  const canEditInterventions = hasPermission('interventions:edit');
  
  if (!canEditInterventions) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour modifier des interventions.
          </Typography>
        </Alert>
      </Box>
    );
  }
  
  if (loading && !formData.title) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Chargement de l'intervention...
        </Typography>
      </Box>
    );
  }
  
  return (
    <Fade in timeout={300}>
      <Box sx={{ p: 3 }}>
        {/* PageHeader avec titre, sous-titre et boutons d'action */}
        <PageHeader
          title={`Modifier l'intervention #${id}`}
          subtitle="Modifiez les informations de l'intervention"
          backPath={`/interventions/${id}`}
          backLabel="Retour aux détails"
          showBackButton={true}
          actions={
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => navigate(`/interventions/${id}`)}
                disabled={loading}
              >
                Annuler
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </Box>
          }
        />
        
        {/* Messages d'erreur et de succès */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {/* Formulaire principal */}
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Colonne principale */}
            <Grid item xs={12} md={8}>
              {/* Informations principales */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Informations principales
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Titre"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    sx={{ mb: 2 }}
                    required
                    error={!!validationErrors.title}
                    helperText={validationErrors.title}
                  />
                  
                  <TextField
                    fullWidth
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    multiline
                    rows={3}
                    sx={{ mb: 2 }}
                    required
                    error={!!validationErrors.description}
                    helperText={validationErrors.description}
                  />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Type d'intervention</InputLabel>
                        <Select
                          value={formDataExtended.type}
                          onChange={(e) => handleExtendedInputChange('type', e.target.value)}
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
                        <InputLabel>Statut</InputLabel>
                        <Select
                          value={formDataExtended.status}
                          onChange={(e) => handleExtendedInputChange('status', e.target.value)}
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
                          value={formDataExtended.priority}
                          onChange={(e) => handleExtendedInputChange('priority', e.target.value)}
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
                        label="Durée estimée (heures)"
                        type="number"
                        value={formDataExtended.estimatedDurationHours}
                        onChange={(e) => handleExtendedInputChange('estimatedDurationHours', parseInt(e.target.value))}
                        required
                        inputProps={{ min: 1 }}
                        error={!!validationErrors.estimatedDurationHours}
                        helperText={validationErrors.estimatedDurationHours}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
              
              {/* Assignation */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Assignation
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Type d'assignation</InputLabel>
                        <Select
                          value={formDataAdvanced.assignedToType}
                          onChange={(e) => handleAdvancedInputChange('assignedToType', e.target.value)}
                          label="Type d'assignation"
                        >
                          <MenuItem value="">Aucune assignation</MenuItem>
                          <MenuItem value="user">Utilisateur</MenuItem>
                          <MenuItem value="team">Équipe</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    {formDataAdvanced.assignedToType === 'user' && (
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Utilisateur assigné</InputLabel>
                          <Select
                            value={formDataAdvanced.assignedToId}
                            onChange={(e) => handleAdvancedInputChange('assignedToId', e.target.value)}
                            label="Utilisateur assigné"
                            error={!!validationErrors.assignedToId}
                          >
                            {availableUsers.map((user) => (
                              <MenuItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} ({user.role})
                              </MenuItem>
                            ))}
                          </Select>
                          {validationErrors.assignedToId && (
                            <Typography variant="caption" color="error">
                              {validationErrors.assignedToId}
                            </Typography>
                          )}
                        </FormControl>
                      </Grid>
                    )}
                    
                    {formDataAdvanced.assignedToType === 'team' && (
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Équipe assignée</InputLabel>
                          <Select
                            value={formDataAdvanced.assignedToId}
                            onChange={(e) => handleAdvancedInputChange('assignedToId', e.target.value)}
                            label="Équipe assignée"
                            error={!!validationErrors.assignedToId}
                          >
                            {availableTeams.map((team) => (
                              <MenuItem key={team.id} value={team.id}>
                                {team.name} ({team.interventionType})
                              </MenuItem>
                            ))}
                          </Select>
                          {validationErrors.assignedToId && (
                            <Typography variant="caption" color="error">
                              {validationErrors.assignedToId}
                            </Typography>
                          )}
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Colonne secondaire */}
            <Grid item xs={12} md={4}>
              {/* Planification */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Planification
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Date et heure planifiées"
                    type="datetime-local"
                    value={formDataExtended.scheduledDate}
                    onChange={(e) => handleExtendedInputChange('scheduledDate', e.target.value)}
                    required
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb: 2 }}
                    error={!!validationErrors.scheduledDate}
                    helperText={validationErrors.scheduledDate}
                  />
                  
                  <TextField
                    fullWidth
                    label="Notes"
                    value={formDataExtended.notes}
                    onChange={(e) => handleExtendedInputChange('notes', e.target.value)}
                    multiline
                    rows={3}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Progression (%)"
                    type="number"
                    value={formDataAdvanced.progressPercentage}
                    onChange={(e) => handleAdvancedInputChange('progressPercentage', parseInt(e.target.value))}
                    inputProps={{ min: 0, max: 100 }}
                    error={!!validationErrors.progressPercentage}
                    helperText={validationErrors.progressPercentage}
                  />
                </CardContent>
              </Card>
              
              {/* Coûts */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Coûts
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Coût estimé (€)"
                    type="number"
                    value={formDataAdvanced.estimatedCost}
                    onChange={(e) => handleAdvancedInputChange('estimatedCost', e.target.value)}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Coût réel (€)"
                    type="number"
                    value={formDataAdvanced.actualCost}
                    onChange={(e) => handleAdvancedInputChange('actualCost', e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </CardContent>
              </Card>
              
              {/* Photos */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Photos
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="URL des photos"
                    value={formDataAdvanced.photos}
                    onChange={(e) => handleAdvancedInputChange('photos', e.target.value)}
                    placeholder="Séparer les URLs par des virgules"
                    multiline
                    rows={2}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </form>
        
        {/* Snackbar de succès */}
        <Snackbar
          open={success}
          autoHideDuration={3000}
          onClose={() => setSuccess(false)}
          message="Intervention sauvegardée avec succès !"
        />
      </Box>
    </Fade>
  );
}
