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
  IconButton,
  Alert,
  CircularProgress,
  Box as MuiBox,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Cancel,
  Person,
  Email,
  Phone,
  AdminPanelSettings,
  SupervisorAccount,
  Build,
  CleaningServices,
  Home,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

// Types pour les utilisateurs
export interface UserEditData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
}

const userRoles = [
  { value: 'ADMIN', label: 'Administrateur', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'MANAGER', label: 'Manager', icon: <SupervisorAccount />, color: 'warning' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'HOST', label: 'Propriétaire', icon: <Home />, color: 'success' },
];

const userStatuses = [
  { value: 'ACTIVE', label: 'Actif', color: 'success' },
  { value: 'INACTIVE', label: 'Inactif', color: 'default' },
  { value: 'SUSPENDED', label: 'Suspendu', color: 'error' },
  { value: 'PENDING_VERIFICATION', label: 'En attente de vérification', color: 'warning' },
  { value: 'BLOCKED', label: 'Bloqué', color: 'error' },
];

const UserEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  // Vérifier la permission de gestion des utilisateurs
  const canManageUsers = hasPermission('users:manage');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [formData, setFormData] = useState<UserEditData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    role: 'HOUSEKEEPER',
    status: 'ACTIVE',
  });

  // Charger les données de l'utilisateur à modifier
  useEffect(() => {
    const loadUser = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('🔍 UserEdit - Utilisateur chargé:', userData);
          
          setUser(userData);
          
          // Pré-remplir le formulaire avec les données existantes
          setFormData({
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || '',
            phoneNumber: userData.phoneNumber || '',
            role: userData.role?.toUpperCase() || 'HOUSEKEEPER',
            status: userData.status?.toUpperCase() || 'ACTIVE',
          });
        } else {
          setError('Erreur lors du chargement de l\'utilisateur');
        }
      } catch (err) {
        console.error('🔍 UserEdit - Erreur chargement:', err);
        setError('Erreur lors du chargement de l\'utilisateur');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id]);

  // Vérifier les permissions - accès uniquement aux utilisateurs avec la permission users:manage
  if (!canManageUsers) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour modifier des utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleInputChange = (field: keyof UserEditData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) {
      return 'Le prénom est obligatoire';
    }
    if (!formData.lastName.trim()) {
      return 'Le nom est obligatoire';
    }
    if (!formData.email.trim()) {
      return 'L\'email est obligatoire';
    }
    if (!formData.email.includes('@')) {
      return 'L\'email doit être valide';
    }
    if (!formData.role) {
      return 'Le rôle est obligatoire';
    }
    if (!formData.status) {
      return 'Le statut est obligatoire';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Préparer les données pour le backend
      const backendData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber?.trim() || null,
        role: formData.role,
        status: formData.status,
      };

      console.log('🔍 UserEdit - Données envoyées au backend:', backendData);
      console.log('🔍 UserEdit - JSON stringifié:', JSON.stringify(backendData, null, 2));

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(backendData),
      });

      console.log('🔍 UserEdit - Réponse reçue:', response.status, response.statusText);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('🔍 UserEdit - Données de réponse:', responseData);
        setSuccess(true);
        setTimeout(() => {
          navigate(`/users/${id}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('🔍 UserEdit - Erreur mise à jour:', errorData);
        setError('Erreur lors de la mise à jour: ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 UserEdit - Erreur mise à jour:', err);
      setError('Erreur lors de la mise à jour de l\'utilisateur');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header avec bouton retour */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => navigate(`/users/${id}`)} 
          sx={{ mr: 2 }}
          size="large"
        >
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" fontWeight={700}>
          Modifier l'utilisateur
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
          Utilisateur modifié avec succès ! Redirection en cours...
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations personnelles */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Informations personnelles
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Prénom *"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  required
                  placeholder="Ex: Jean"
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nom *"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  required
                  placeholder="Ex: Dupont"
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>
            </Grid>

            {/* Informations de contact */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Informations de contact
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Email *"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  placeholder="Ex: jean.dupont@clenzy.fr"
                  InputProps={{
                    startAdornment: <Email sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Téléphone"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  placeholder="Ex: +33 6 12 34 56 78"
                  InputProps={{
                    startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>
            </Grid>

            {/* Rôle et statut */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Rôle et statut
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Rôle *</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    label="Rôle *"
                  >
                    {userRoles.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        <MuiBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {role.icon}
                          {role.label}
                        </MuiBox>
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    Le rôle détermine les permissions de l'utilisateur
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Statut *</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    label="Statut *"
                  >
                    {userStatuses.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        <MuiBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={status.label}
                            size="small"
                            color={status.color as any}
                            variant="outlined"
                          />
                        </MuiBox>
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    Le statut détermine si l'utilisateur peut se connecter
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>

            {/* Aperçu du rôle sélectionné */}
            {formData.role && (
              <Box sx={{ mb: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                  📋 Rôle sélectionné : {userRoles.find(r => r.value === formData.role)?.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.role === 'ADMIN' && 'Accès complet à toutes les fonctionnalités de la plateforme'}
                  {formData.role === 'MANAGER' && 'Gestion des équipes et des demandes de service'}
                  {formData.role === 'SUPERVISOR' && 'Supervision des interventions et du personnel'}
                  {formData.role === 'TECHNICIAN' && 'Exécution des interventions techniques'}
                  {formData.role === 'HOUSEKEEPER' && 'Exécution des interventions de nettoyage'}
                  {formData.role === 'HOST' && 'Gestion de ses propres propriétés'}
                </Typography>
              </Box>
            )}

            {/* Boutons d'action */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => navigate(`/users/${id}`)}
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
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserEdit;
