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
  Autocomplete,
} from '@mui/material';
import {
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
  Lock,
  Visibility,
  VisibilityOff,
  Business,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usersApi, type User, type UserFormData } from '../../services/api';
import { organizationsApi, OrganizationDto } from '../../services/api/organizationsApi';
import PageHeader from '../../components/PageHeader';
import type { ChipColor } from '../../types';

// Types pour les utilisateurs
export interface UserEditData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
  // Champs pour le changement de mot de passe
  newPassword?: string;
  confirmPassword?: string;
}

const userRoles = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'SUPER_MANAGER', label: 'Super Manager', icon: <SupervisorAccount />, color: 'secondary' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'LAUNDRY', label: 'Blanchisserie', icon: <CleaningServices />, color: 'default' },
  { value: 'EXTERIOR_TECH', label: 'Tech. Extérieur', icon: <Build />, color: 'primary' },
  { value: 'HOST', label: 'Propriétaire', icon: <Home />, color: 'success' },
];

const userStatuses: Array<{ value: string; label: string; color: ChipColor }> = [
  { value: 'ACTIVE', label: 'Actif', color: 'success' },
  { value: 'INACTIVE', label: 'Inactif', color: 'default' },
  { value: 'SUSPENDED', label: 'Suspendu', color: 'error' },
  { value: 'PENDING_VERIFICATION', label: 'En attente de vérification', color: 'warning' },
  { value: 'BLOCKED', label: 'Bloqué', color: 'error' },
];

const UserEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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
  }, [hasPermissionAsync]);;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Organisations (pour le selecteur)
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDto | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const [formData, setFormData] = useState<UserEditData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    role: 'HOUSEKEEPER',
    status: 'ACTIVE',
    newPassword: '',
    confirmPassword: '',
  });

  // Charger les organisations disponibles
  useEffect(() => {
    const loadOrganizations = async () => {
      setOrgsLoading(true);
      try {
        const data = await organizationsApi.listAll();
        setOrganizations(data);
      } catch {
        // Silencieux — le selecteur sera vide
      } finally {
        setOrgsLoading(false);
      }
    };
    loadOrganizations();
  }, []);

  // Charger les données de l'utilisateur à modifier
  useEffect(() => {
    const loadUser = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const userData = await usersApi.getById(Number(id));
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

        // Pre-selectionner l'organisation
        if (userData.organizationId && organizations.length > 0) {
          const userOrg = organizations.find((o) => o.id === userData.organizationId);
          if (userOrg) setSelectedOrg(userOrg);
        }
      } catch (err) {
        setError('Erreur lors du chargement de l\'utilisateur');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id, organizations]);

  // Vérifier les permissions - accès uniquement aux utilisateurs avec la permission users:manage
  if (!canManageUsers) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ p: 2, py: 1 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
            Accès non autorisé
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            Vous n'avez pas les permissions nécessaires pour modifier des utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleInputChange = (field: keyof UserEditData, value: string) => {
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
    
    // Validation des mots de passe
    if (formData.newPassword && !formData.confirmPassword) {
      return 'Veuillez confirmer le nouveau mot de passe';
    }
    if (!formData.newPassword && formData.confirmPassword) {
      return 'Veuillez saisir le nouveau mot de passe';
    }
    if (formData.newPassword && formData.confirmPassword) {
      if (formData.newPassword.length < 8) {
        return 'Le mot de passe doit contenir au moins 8 caractères';
      }
      if (formData.newPassword !== formData.confirmPassword) {
        return 'Les mots de passe ne correspondent pas';
      }
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
      const backendData: Partial<UserFormData> & { newPassword?: string } = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber?.trim() || undefined,
        role: formData.role,
        status: formData.status,
      };

      // Ajouter l'organisation si selectionnee
      if (selectedOrg) {
        backendData.organizationId = selectedOrg.id;
      }

      // Ajouter le mot de passe seulement s'il est fourni
      if (formData.newPassword && formData.confirmPassword) {
        backendData.newPassword = formData.newPassword;
      }

      await usersApi.update(Number(id), backendData);
      setSuccess(true);

      // Réinitialiser les champs de mot de passe
      setFormData(prev => ({
        ...prev,
        newPassword: '',
        confirmPassword: ''
      }));

      setTimeout(() => {
        navigate(`/users/${id}`);
      }, 1500);
    } catch (err: unknown) {
      setError('Erreur lors de la mise à jour: ' + (err instanceof Error ? err.message : 'Erreur inconnue'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error && !user) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ p: 2, py: 1 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <PageHeader
        title="Modifier l'utilisateur"
        subtitle={`Modification des informations de ${user?.firstName || ''} ${user?.lastName || ''}`}
        backPath={`/users/${id}`}
        showBackButton={true}
        actions={
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(`/users/${id}`)}
              startIcon={<Cancel size={16} strokeWidth={1.75} />}
              disabled={saving}
              sx={{ fontSize: '0.8125rem' }}
              title="Annuler"
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmit}
              startIcon={<Save size={16} strokeWidth={1.75} />}
              disabled={saving}
              sx={{ ml: 1, fontSize: '0.8125rem' }}
              title="Sauvegarder"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
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
          Utilisateur modifié avec succès ! Redirection en cours...
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
                    startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><Person size={18} strokeWidth={1.75} /></Box>,
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
                    startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><Person size={18} strokeWidth={1.75} /></Box>,
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
                    startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><Email size={18} strokeWidth={1.75} /></Box>,
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
                    startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><Phone size={18} strokeWidth={1.75} /></Box>,
                  }}
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
                            color={status.color}
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

            {/* Organisation */}
            <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
              Organisation
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  size="small"
                  options={organizations}
                  value={selectedOrg}
                  loading={orgsLoading}
                  onChange={(_event, newValue) => setSelectedOrg(newValue)}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Business size={16} strokeWidth={1.75} /></Box>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.memberCount} membre{option.memberCount !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Organisation"
                      placeholder="Selectionner une organisation"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {orgsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  noOptionsText="Aucune organisation"
                />
                <FormHelperText sx={{ fontSize: '0.7rem' }}>
                  Organisation a laquelle l'utilisateur est rattache
                </FormHelperText>
              </Grid>
            </Grid>

            {/* Aperçu du rôle sélectionné */}
            {formData.role && (
              <Box sx={{ mb: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                  📋 Rôle sélectionné : {userRoles.find(r => r.value === formData.role)?.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.role === 'SUPER_ADMIN' && 'Super administrateur avec accès complet multi-organisations'}
                  {formData.role === 'SUPER_MANAGER' && 'Super manager avec gestion étendue multi-équipes'}
                  {formData.role === 'SUPERVISOR' && 'Supervision des interventions et du personnel'}
                  {formData.role === 'TECHNICIAN' && 'Exécution des interventions techniques'}
                  {formData.role === 'HOUSEKEEPER' && 'Exécution des interventions de nettoyage'}
                  {formData.role === 'HOST' && 'Gestion de ses propres propriétés'}
                  {formData.role === 'LAUNDRY' && 'Gestion du linge et de la blanchisserie'}
                  {formData.role === 'EXTERIOR_TECH' && 'Entretien des espaces extérieurs'}
                </Typography>
              </Box>
            )}

            {/* Changement de mot de passe */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              🔐 Changement de mot de passe
            </Typography>
            
            <Box sx={{ mb: 4, p: 3, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Laissez ces champs vides si vous ne souhaitez pas changer le mot de passe.
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Nouveau mot de passe"
                    type={showNewPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    placeholder="Minimum 8 caractères"
                    InputProps={{
                      startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><Lock  /></Box>,
                      endAdornment: (
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                          size="small"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Confirmer le mot de passe"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Répétez le mot de passe"
                    InputProps={{
                      startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><Lock  /></Box>,
                      endAdornment: (
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                          size="small"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
              
              {formData.newPassword && formData.confirmPassword && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: formData.newPassword === formData.confirmPassword ? 'success.main' : 'error.main' }}>
                  <Typography variant="caption" color={formData.newPassword === formData.confirmPassword ? 'success.main' : 'error.main'}>
                    {formData.newPassword === formData.confirmPassword 
                      ? '✅ Les mots de passe correspondent' 
                      : '❌ Les mots de passe ne correspondent pas'
                    }
                  </Typography>
                </Box>
              )}
            </Box>

          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserEdit;
