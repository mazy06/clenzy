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
  Save,
  Cancel,
  Person,
  Email,
  Phone,
  Lock,
  AdminPanelSettings,
  SupervisorAccount,
  Build,
  CleaningServices,
  Home,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { UserStatus, USER_STATUS_OPTIONS } from '../../types/statusEnums';
import PageHeader from '../../components/PageHeader';

// Types pour les utilisateurs
export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  confirmPassword: string;
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

// Utilisation des enums partagés pour les statuts utilisateur
const userStatuses = USER_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
  color: option.color
}));

const UserForm: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  
  // Vérifier la permission de gestion des utilisateurs
  const [canManageUsers, setCanManageUsers] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canManageUsersPermission = await hasPermissionAsync('users:manage');
      setCanManageUsers(canManageUsersPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: 'HOUSEKEEPER',
    status: 'ACTIVE',
  });

  // Vérifier les permissions - accès uniquement aux utilisateurs avec la permission users:manage
  if (!canManageUsers) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ p: 2, py: 1 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
            Accès non autorisé
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            Vous n'avez pas les permissions nécessaires pour créer des utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleInputChange = (field: keyof UserFormData, value: any) => {
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
    if (formData.password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Les mots de passe ne correspondent pas';
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
        password: formData.password,
        role: formData.role,
        status: formData.status,
      };

      console.log('🔍 UserForm - Données envoyées au backend:', backendData);
      console.log('🔍 UserForm - JSON stringifié:', JSON.stringify(backendData, null, 2));

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(backendData),
      });

      console.log('🔍 UserForm - Réponse reçue:', response.status, response.statusText);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('🔍 UserForm - Données de réponse:', responseData);
        setSuccess(true);
        setTimeout(() => {
          navigate('/users');
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('🔍 UserForm - Erreur création:', errorData);
        setError('Erreur lors de la création: ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 UserForm - Erreur création:', err);
      setError('Erreur lors de la création de l\'utilisateur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <PageHeader
        title="Nouvel utilisateur"
        subtitle="Créez un nouveau compte utilisateur pour la gestion des utilisateurs"
        backPath="/users"
        showBackButton={true}
        actions={
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/users')}
              startIcon={<Cancel sx={{ fontSize: 16 }} />}
              disabled={saving}
              sx={{ mr: 1, fontSize: '0.8125rem' }}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmit}
              startIcon={saving ? <CircularProgress size={16} /> : <Save sx={{ fontSize: 16 }} />}
              disabled={saving}
              sx={{ fontSize: '0.8125rem' }}
            >
              {saving ? 'Création...' : 'Créer l\'utilisateur'}
            </Button>
          </>
        }
      />

      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2, py: 1 }}>
          Utilisateur créé avec succès ! Redirection en cours...
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations personnelles */}
            <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
              Informations personnelles
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Prénom *"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  required
                  placeholder="Ex: Jean"
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Nom *"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  required
                  placeholder="Ex: Dupont"
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                />
              </Grid>
            </Grid>

            {/* Informations de contact */}
            <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
              Informations de contact
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  size="small"
                  label="Email *"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  placeholder="Ex: jean.dupont@clenzy.fr"
                  InputProps={{
                    startAdornment: <Email sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Téléphone"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  placeholder="Ex: +33 6 12 34 56 78"
                  InputProps={{
                    startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                />
              </Grid>
            </Grid>

            {/* Sécurité */}
            <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
              Sécurité
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Mot de passe *"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  placeholder="Minimum 8 caractères"
                  InputProps={{
                    startAdornment: <Lock sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                  FormHelperTextProps={{ sx: { fontSize: '0.7rem' } }}
                  helperText="Le mot de passe doit contenir au moins 8 caractères"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Confirmer le mot de passe *"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  required
                  placeholder="Retapez le mot de passe"
                  InputProps={{
                    startAdornment: <Lock sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                  error={formData.password !== formData.confirmPassword && formData.confirmPassword !== ''}
                  FormHelperTextProps={{ sx: { fontSize: '0.7rem' } }}
                  helperText={
                    formData.password !== formData.confirmPassword && formData.confirmPassword !== ''
                      ? 'Les mots de passe ne correspondent pas'
                      : ''
                  }
                />
              </Grid>
            </Grid>

            {/* Rôle et statut */}
            <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
              Rôle et statut
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required size="small">
                  <InputLabel>Rôle *</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    label="Rôle *"
                  >
                    {userRoles.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        <MuiBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ fontSize: 18 }}>{role.icon}</Box>
                          <Typography variant="body2">{role.label}</Typography>
                        </MuiBox>
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    Le rôle détermine les permissions de l'utilisateur
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required size="small">
                  <InputLabel>Statut *</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    label="Statut *"
                  >
                    {userStatuses.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                          <Chip
                            label={status.label}
                            size="small"
                            color={status.color as any}
                            variant="outlined"
                          sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    Le statut détermine si l'utilisateur peut se connecter
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>

            {/* Aperçu du rôle sélectionné */}
            {formData.role && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="primary" sx={{ mb: 0.75, fontWeight: 600, fontSize: '0.75rem' }}>
                  📋 Rôle sélectionné : {userRoles.find(r => r.value === formData.role)?.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {formData.role === 'ADMIN' && 'Accès complet à toutes les fonctionnalités de la plateforme'}
                  {formData.role === 'MANAGER' && 'Gestion des équipes et des demandes de service'}
                  {formData.role === 'SUPERVISOR' && 'Supervision des interventions et du personnel'}
                  {formData.role === 'TECHNICIAN' && 'Exécution des interventions techniques'}
                  {formData.role === 'HOUSEKEEPER' && 'Exécution des interventions de nettoyage'}
                  {formData.role === 'HOST' && 'Gestion de ses propres propriétés'}
                </Typography>
              </Box>
            )}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserForm;
