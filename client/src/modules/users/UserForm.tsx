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
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../hooks/useAuth';
import { usersApi } from '../../services/api';
import { UserStatus, USER_STATUS_OPTIONS } from '../../types/statusEnums';
import { userSchema } from '../../schemas';
import PageHeader from '../../components/PageHeader';

// Keep exported interface for backward compatibility
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
  { value: 'SUPER_ADMIN', label: 'Super Admin', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'SUPER_MANAGER', label: 'Super Manager', icon: <SupervisorAccount />, color: 'secondary' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'LAUNDRY', label: 'Blanchisserie', icon: <CleaningServices />, color: 'default' },
  { value: 'EXTERIOR_TECH', label: 'Tech. Extérieur', icon: <Build />, color: 'primary' },
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

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema) as unknown as Resolver<UserFormData>,
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      role: 'HOUSEKEEPER',
      status: 'ACTIVE',
    },
  });

  const watchedRole = watch('role');
  const watchedPassword = watch('password');
  const watchedConfirmPassword = watch('confirmPassword');

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

  const onSubmit = async (data: UserFormData) => {
    setSaving(true);
    setError(null);

    try {
      // Préparer les données pour le backend
      const backendData = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        phoneNumber: data.phoneNumber?.trim() || null,
        password: data.password,
        role: data.role,
        status: data.status,
      };

      await usersApi.create(backendData as any);
      setSuccess(true);
      setTimeout(() => {
        navigate('/users');
      }, 1500);
    } catch (err: any) {
      setError('Erreur lors de la création: ' + (err?.message || 'Erreur inconnue'));
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
              title="Annuler"
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmit(onSubmit)}
              startIcon={saving ? <CircularProgress size={16} /> : <Save sx={{ fontSize: 16 }} />}
              disabled={saving}
              sx={{ fontSize: '0.8125rem' }}
              title="Créer l'utilisateur"
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
          <form onSubmit={handleSubmit(onSubmit)}>
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
                  {...register('firstName')}
                  error={!!errors.firstName}
                  helperText={errors.firstName?.message}
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
                  {...register('lastName')}
                  error={!!errors.lastName}
                  helperText={errors.lastName?.message}
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
                  {...register('email')}
                  error={!!errors.email}
                  helperText={errors.email?.message}
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
                  {...register('phoneNumber')}
                  error={!!errors.phoneNumber}
                  helperText={errors.phoneNumber?.message}
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
                  {...register('password')}
                  error={!!errors.password}
                  placeholder="Minimum 8 caractères"
                  InputProps={{
                    startAdornment: <Lock sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                  FormHelperTextProps={{ sx: { fontSize: '0.7rem' } }}
                  helperText={errors.password?.message || 'Le mot de passe doit contenir au moins 8 caractères'}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Confirmer le mot de passe *"
                  type="password"
                  {...register('confirmPassword')}
                  error={!!errors.confirmPassword || (watchedPassword !== watchedConfirmPassword && watchedConfirmPassword !== '')}
                  placeholder="Retapez le mot de passe"
                  InputProps={{
                    startAdornment: <Lock sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                  FormHelperTextProps={{ sx: { fontSize: '0.7rem' } }}
                  helperText={
                    errors.confirmPassword?.message
                      ? errors.confirmPassword.message
                      : watchedPassword !== watchedConfirmPassword && watchedConfirmPassword !== ''
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
                <FormControl fullWidth required size="small" error={!!errors.role}>
                  <InputLabel>Rôle *</InputLabel>
                  <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
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
                    )}
                  />
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    {errors.role?.message || "Le rôle détermine les permissions de l'utilisateur"}
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required size="small" error={!!errors.status}>
                  <InputLabel>Statut *</InputLabel>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label="Statut *"
                      >
                        {userStatuses.map((status) => (
                          <MenuItem key={status.value} value={status.value}>
                              <Chip
                                label={status.label}
                                size="small"
                                color={status.color}
                                variant="outlined"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                              />
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    {errors.status?.message || "Le statut détermine si l'utilisateur peut se connecter"}
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>

            {/* Aperçu du rôle sélectionné */}
            {watchedRole && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="primary" sx={{ mb: 0.75, fontWeight: 600, fontSize: '0.75rem' }}>
                  📋 Rôle sélectionné : {userRoles.find(r => r.value === watchedRole)?.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {watchedRole === 'SUPER_ADMIN' && 'Super administrateur avec accès complet multi-organisations'}
                  {watchedRole === 'SUPER_MANAGER' && 'Super manager avec gestion étendue multi-équipes'}
                  {watchedRole === 'SUPERVISOR' && 'Supervision des interventions et du personnel'}
                  {watchedRole === 'TECHNICIAN' && 'Exécution des interventions techniques'}
                  {watchedRole === 'HOUSEKEEPER' && 'Exécution des interventions de nettoyage'}
                  {watchedRole === 'HOST' && 'Gestion de ses propres propriétés'}
                  {watchedRole === 'LAUNDRY' && 'Gestion du linge et de la blanchisserie'}
                  {watchedRole === 'EXTERIOR_TECH' && 'Entretien des espaces extérieurs'}
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
