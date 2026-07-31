import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { Info, TriangleAlert, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card, CardContent, TextField, Button, Grid, FormControl, InputLabel, Select, MenuItem, FormHelperText, Chip, IconButton, Box as MuiBox } from '@mui/material';
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
  Business,
  Group,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../hooks/useAuth';
import { usersApi, type UserFormData as ApiUserFormData } from '../../services/api/usersApi';
import { organizationsApi, type OrganizationDto } from '../../services/api/organizationsApi';
import { UserStatus, USER_STATUS_OPTIONS } from '../../types/statusEnums';
import { userSchema } from '../../schemas/userSchema';
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
  organizationId?: string;
  orgRole?: string;
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

const orgMemberRoles = [
  { value: 'OWNER', label: 'Propriétaire' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SUPERVISOR', label: 'Superviseur' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage' },
  { value: 'TECHNICIAN', label: 'Technicien' },
  { value: 'HOST', label: 'Hôte' },
  { value: 'MEMBER', label: 'Membre' },
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

  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const orgs = await organizationsApi.listAll();
        setOrganizations(orgs);
      } catch {
        // Silently fail — org selector will just be empty
      }
    };
    fetchOrganizations();
  }, []);

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
      organizationId: '',
      orgRole: '',
    },
  });

  const watchedRole = watch('role');
  const watchedPassword = watch('password');
  const watchedConfirmPassword = watch('confirmPassword');
  const watchedOrganizationId = watch('organizationId');

  // Vérifier les permissions - accès uniquement aux utilisateurs avec la permission users:manage
  if (!canManageUsers) {
    return (
      <div className="p-3">
        <Alert variant="info" className="p-3 py-1.5">
          <Info />
          <AlertDescription><h6 className="cn-text-subtitle1 mb-[0.35em] mb-1.5">
            Accès non autorisé
          </h6><p className="cn-text-body2 text-[0.85rem]">
            Vous n'avez pas les permissions nécessaires pour créer des utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </p></AlertDescription>
        </Alert>
      </div>
    );
  }

  const onSubmit = async (data: UserFormData) => {
    setSaving(true);
    setError(null);

    try {
      // Préparer les données pour le backend
      const backendData: ApiUserFormData = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        phoneNumber: data.phoneNumber?.trim() || undefined,
        password: data.password,
        role: data.role,
        status: data.status,
        organizationId: data.organizationId && data.organizationId !== '' ? Number(data.organizationId) : undefined,
        orgRole: data.orgRole || undefined,
      };

      await usersApi.create(backendData);
      setSuccess(true);
      setTimeout(() => {
        navigate('/users');
      }, 1500);
    } catch (err: unknown) {
      setError('Erreur lors de la création: ' + (err instanceof Error ? err.message : 'Erreur inconnue'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3">
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
              startIcon={<Cancel size={16} strokeWidth={1.75} />}
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
              startIcon={saving ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
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
        <Alert variant="destructive" className="mb-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-3 py-1.5">
          <CircleCheck />
          <AlertDescription>Utilisateur créé avec succès ! Redirection en cours...</AlertDescription>
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Informations personnelles */}
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Informations personnelles
            </h6>

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
                    startAdornment: <span className="inline-flex text-muted-foreground me-1.5"><Person size={18} strokeWidth={1.75} /></span>,
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
                    startAdornment: <span className="inline-flex text-muted-foreground me-1.5"><Person size={18} strokeWidth={1.75} /></span>,
                  }}
                />
              </Grid>
            </Grid>

            {/* Informations de contact */}
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Informations de contact
            </h6>

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
                    startAdornment: <span className="inline-flex text-muted-foreground me-1.5"><Email size={18} strokeWidth={1.75} /></span>,
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
                    startAdornment: <span className="inline-flex text-muted-foreground me-1.5"><Phone size={18} strokeWidth={1.75} /></span>,
                  }}
                />
              </Grid>
            </Grid>

            {/* Sécurité */}
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Sécurité
            </h6>

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
                    startAdornment: <span className="inline-flex text-muted-foreground me-1.5"><Lock size={18} strokeWidth={1.75} /></span>,
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
                    startAdornment: <span className="inline-flex text-muted-foreground me-1.5"><Lock size={18} strokeWidth={1.75} /></span>,
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
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Rôle et statut
            </h6>

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
                              <div className="text-[18px]">{role.icon}</div>
                              <p className="cn-text-body2">{role.label}</p>
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
              <div className="mb-3 p-2 bg-[var(--field)] border border-[var(--field-line)] rounded-[8px]">
                <span className="cn-text-caption text-primary mb-1 font-semibold text-[0.75rem]">
                  📋 Rôle sélectionné : {userRoles.find(r => r.value === watchedRole)?.label}
                </span>
                <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                  {watchedRole === 'SUPER_ADMIN' && 'Super administrateur avec accès complet multi-organisations'}
                  {watchedRole === 'SUPER_MANAGER' && 'Super manager avec gestion étendue multi-équipes'}
                  {watchedRole === 'SUPERVISOR' && 'Supervision des interventions et du personnel'}
                  {watchedRole === 'TECHNICIAN' && 'Exécution des interventions techniques'}
                  {watchedRole === 'HOUSEKEEPER' && 'Exécution des interventions de nettoyage'}
                  {watchedRole === 'HOST' && 'Gestion de ses propres propriétés'}
                  {watchedRole === 'LAUNDRY' && 'Gestion du linge et de la blanchisserie'}
                  {watchedRole === 'EXTERIOR_TECH' && 'Entretien des espaces extérieurs'}
                </span>
              </div>
            )}

            {/* Organisation */}
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Organisation
            </h6>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" error={!!errors.organizationId}>
                  <InputLabel>Organisation</InputLabel>
                  <Controller
                    name="organizationId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label="Organisation"
                      >
                        <MenuItem value="">
                          <p className="cn-text-body2 text-muted-foreground">Aucune</p>
                        </MenuItem>
                        {organizations.map((org) => (
                          <MenuItem key={org.id} value={String(org.id)}>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex text-muted-foreground"><Business size={18} strokeWidth={1.75} /></span>
                              <p className="cn-text-body2">{org.name}</p>
                            </div>
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    {errors.organizationId?.message || "Optionnel — rattacher l'utilisateur à une organisation"}
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl
                  fullWidth
                  size="small"
                  required={!!watchedOrganizationId && watchedOrganizationId !== ''}
                  error={!!errors.orgRole}
                  disabled={!watchedOrganizationId || watchedOrganizationId === ''}
                >
                  <InputLabel>
                    Rôle dans l'organisation {watchedOrganizationId && watchedOrganizationId !== '' ? '*' : ''}
                  </InputLabel>
                  <Controller
                    name="orgRole"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label={`Rôle dans l'organisation ${watchedOrganizationId && watchedOrganizationId !== '' ? '*' : ''}`}
                      >
                        <MenuItem value="">
                          <p className="cn-text-body2 text-muted-foreground">Aucun</p>
                        </MenuItem>
                        {orgMemberRoles.map((role) => (
                          <MenuItem key={role.value} value={role.value}>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex text-muted-foreground"><Group size={18} strokeWidth={1.75} /></span>
                              <p className="cn-text-body2">{role.label}</p>
                            </div>
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    {errors.orgRole?.message || (watchedOrganizationId && watchedOrganizationId !== ''
                      ? "Requis — rôle de l'utilisateur dans l'organisation"
                      : "Sélectionnez d'abord une organisation")}
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserForm;
