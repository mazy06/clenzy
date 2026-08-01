import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { Info, TriangleAlert, CircleCheck } from 'lucide-react';
import { Spinner, Button } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../../components/ui';
import { Card, CardContent, FormControl, InputLabel, Select, MenuItem, FormHelperText, IconButton, Box as MuiBox } from '@mui/material';
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
import StatusChip, { type StatusTone } from '../../components/StatusChip';

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

// La couleur portee par USER_STATUS_OPTIONS reste une cle de palette MUI ;
// on la lit comme un ton de la primitive.
const STATUS_TONE: Record<string, StatusTone> = {
  success: 'ok',
  warning: 'warn',
  error: 'err',
  info: 'info',
  primary: 'accent',
};

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
  // Mismatch verifie a la volee : le resolver zod ne rejoue pas tant que
  // l'utilisateur n'a pas quitte le second champ.
  const passwordsMismatch = watchedPassword !== watchedConfirmPassword && watchedConfirmPassword !== '';

  // Le champ du kit est une fonction sans forwardRef : sous React 18 la `ref`
  // de react-hook-form ne s'attacherait pas et declencherait un warning a
  // chaque rendu. On ne transmet donc que name/onChange/onBlur — la valeur
  // remonte par onChange, ce dont le resolver zod se contente.
  const registerField = (field: keyof UserFormData) => {
    const { name, onChange, onBlur } = register(field);
    return { name, onChange, onBlur };
  };

  // Vérifier les permissions - accès uniquement aux utilisateurs avec la permission users:manage
  if (!canManageUsers) {
    return (
      <div className="p-3">
        <Alert variant="info" className="p-3 py-1.5">
          <Info />
          <AlertDescription><h6 className="cn-text-subtitle1 mb-1.5">
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
              variant="outline"
              size="sm"
              className="me-1.5"
              onClick={() => navigate('/users')}
              disabled={saving}
              title="Annuler"
            >
              <Cancel size={16} strokeWidth={1.75} />
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit(onSubmit)}
              disabled={saving}
              title="Créer l'utilisateur"
            >
              {saving ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
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

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-first-name">Prénom *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Person size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-first-name"
                      {...registerField('firstName')}
                      aria-invalid={!!errors.firstName}
                      placeholder="Ex: Jean"
                    />
                  </InputGroup>
                  {errors.firstName?.message && <FieldError>{errors.firstName.message}</FieldError>}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-last-name">Nom *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Person size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-last-name"
                      {...registerField('lastName')}
                      aria-invalid={!!errors.lastName}
                      placeholder="Ex: Dupont"
                    />
                  </InputGroup>
                  {errors.lastName?.message && <FieldError>{errors.lastName.message}</FieldError>}
                </Field>
              </div>
            </div>

            {/* Informations de contact */}
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Informations de contact
            </h6>

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-8">
                <Field>
                  <FieldLabel htmlFor="user-email">Email *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Email size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-email"
                      type="email"
                      {...registerField('email')}
                      aria-invalid={!!errors.email}
                      placeholder="Ex: jean.dupont@baitly.fr"
                    />
                  </InputGroup>
                  {errors.email?.message && <FieldError>{errors.email.message}</FieldError>}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-4">
                <Field>
                  <FieldLabel htmlFor="user-phone-number">Téléphone</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Phone size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-phone-number"
                      {...registerField('phoneNumber')}
                      aria-invalid={!!errors.phoneNumber}
                      placeholder="Ex: +33 6 12 34 56 78"
                    />
                  </InputGroup>
                  {errors.phoneNumber?.message && <FieldError>{errors.phoneNumber.message}</FieldError>}
                </Field>
              </div>
            </div>

            {/* Sécurité */}
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Sécurité
            </h6>

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-password">Mot de passe *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Lock size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-password"
                      type="password"
                      {...registerField('password')}
                      aria-invalid={!!errors.password}
                      placeholder="Minimum 8 caractères"
                    />
                  </InputGroup>
                  {errors.password?.message ? (
                    <FieldError>{errors.password.message}</FieldError>
                  ) : (
                    <FieldDescription>Le mot de passe doit contenir au moins 8 caractères</FieldDescription>
                  )}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-confirm-password">Confirmer le mot de passe *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Lock size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-confirm-password"
                      type="password"
                      {...registerField('confirmPassword')}
                      aria-invalid={!!errors.confirmPassword || passwordsMismatch}
                      placeholder="Retapez le mot de passe"
                    />
                  </InputGroup>
                  {(errors.confirmPassword?.message || passwordsMismatch) && (
                    <FieldError>
                      {errors.confirmPassword?.message ?? 'Les mots de passe ne correspondent pas'}
                    </FieldError>
                  )}
                </Field>
              </div>
            </div>

            {/* Rôle et statut */}
            <h6 className="cn-text-subtitle1 mb-2 text-[var(--accent)] font-semibold">
              Rôle et statut
            </h6>

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
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
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
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
                            <StatusChip tone={STATUS_TONE[status.color] ?? 'neutral'} label={status.label} />
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    {errors.status?.message || "Le statut détermine si l'utilisateur peut se connecter"}
                  </FormHelperText>
                </FormControl>
              </div>
            </div>

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

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
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
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
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
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserForm;
