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
import {
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui';
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
import { useTranslation } from '../../hooks/useTranslation';
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
  { value: 'SUPER_ADMIN', labelKey: 'roles.platform.SUPER_ADMIN', label: 'Super Admin', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'SUPER_MANAGER', labelKey: 'roles.platform.SUPER_MANAGER', label: 'Super Manager', icon: <SupervisorAccount />, color: 'secondary' },
  { value: 'SUPERVISOR', labelKey: 'roles.platform.SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', labelKey: 'roles.platform.TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', labelKey: 'roles.platform.HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'LAUNDRY', labelKey: 'roles.platform.LAUNDRY', label: 'Blanchisserie', icon: <CleaningServices />, color: 'default' },
  { value: 'EXTERIOR_TECH', labelKey: 'roles.platform.EXTERIOR_TECH', label: 'Tech. Extérieur', icon: <Build />, color: 'primary' },
  { value: 'HOST', labelKey: 'roles.platform.HOST', label: 'Propriétaire', icon: <Home />, color: 'success' },
];

const orgMemberRoles = [
  { value: 'OWNER', labelKey: 'roles.org.OWNER', label: 'Propriétaire' },
  { value: 'ADMIN', labelKey: 'roles.org.ADMIN', label: 'Administrateur' },
  { value: 'MANAGER', labelKey: 'roles.org.MANAGER', label: 'Manager' },
  { value: 'SUPERVISOR', labelKey: 'roles.org.SUPERVISOR', label: 'Superviseur' },
  { value: 'HOUSEKEEPER', labelKey: 'roles.org.HOUSEKEEPER', label: 'Agent de ménage' },
  { value: 'TECHNICIAN', labelKey: 'roles.org.TECHNICIAN', label: 'Technicien' },
  { value: 'HOST', labelKey: 'roles.org.HOST', label: 'Hôte' },
  { value: 'MEMBER', labelKey: 'roles.org.MEMBER', label: 'Membre' },
];

// Utilisation des enums partagés pour les statuts utilisateur
const userStatuses = USER_STATUS_OPTIONS.map(option => ({
  value: option.value,
  labelKey: option.labelKey,
  label: option.label,
  color: option.color
}));

// La couleur portee par USER_STATUS_OPTIONS reste une cle de palette MUI ;
// on la lit comme un ton de la primitive.
// Radix Select interdit la chaine vide comme valeur d'item (elle est reservee a
// « aucune selection ») : on route l'option « Aucune » par un sentinel, tout en
// gardant '' dans le formulaire.
const NONE_OPTION = '__none__';

const STATUS_TONE: Record<string, StatusTone> = {
  success: 'ok',
  warning: 'warn',
  error: 'err',
  info: 'info',
  primary: 'accent',
};

const UserForm: React.FC = () => {
  const { t } = useTranslation();
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
          {/* `m-0` reprend ce que portait `cn-text-*` : sans preflight Tailwind,
              un <h6>/<p> natif recupere sinon les marges du navigateur. */}
          <AlertDescription><h6 className="m-0 mb-1.5 text-sm font-medium">
            {t('users.accessDenied.title')}
          </h6><p className="m-0 text-sm">
            {t('users.accessDenied.create')}
            <br />
            {t('users.accessDenied.contact')}
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
    <div>
      <PageHeader
        title={t('users.create')}
        subtitle={t('users.form.createSubtitle')}
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
              title={t('users.createUser')}
            >
              {saving ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
              {t(saving ? 'users.creating' : 'users.createUser')}
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
          <AlertDescription>{t('users.form.createSuccess')}</AlertDescription>
        </Alert>
      )}

      {/* Formulaire */}
      <Card className="gap-0 py-0">
        <CardContent className="p-3">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Informations personnelles */}
            <h6 className="m-0 mb-2 text-sm font-semibold text-primary">
              Informations personnelles
            </h6>

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-first-name">{t('users.firstName')} *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Person size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-first-name"
                      {...registerField('firstName')}
                      aria-invalid={!!errors.firstName}
                      placeholder={t('users.form.firstNamePlaceholder')}
                    />
                  </InputGroup>
                  {errors.firstName?.message && <FieldError>{errors.firstName.message}</FieldError>}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-last-name">{t('users.lastName')} *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Person size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-last-name"
                      {...registerField('lastName')}
                      aria-invalid={!!errors.lastName}
                      placeholder={t('users.form.lastNamePlaceholder')}
                    />
                  </InputGroup>
                  {errors.lastName?.message && <FieldError>{errors.lastName.message}</FieldError>}
                </Field>
              </div>
            </div>

            {/* Informations de contact */}
            <h6 className="m-0 mb-2 text-sm font-semibold text-primary">
              {t('users.form.contactInfo')}
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
                      placeholder={t('users.form.emailPlaceholder')}
                    />
                  </InputGroup>
                  {errors.email?.message && <FieldError>{errors.email.message}</FieldError>}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-4">
                <Field>
                  <FieldLabel htmlFor="user-phone-number">{t('common.phone')}</FieldLabel>
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
            <h6 className="m-0 mb-2 text-sm font-semibold text-primary">
              {t('users.form.security')}
            </h6>

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-password">{t('users.form.password')} *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Lock size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-password"
                      type="password"
                      {...registerField('password')}
                      aria-invalid={!!errors.password}
                      placeholder={t('users.form.passwordHint')}
                    />
                  </InputGroup>
                  {errors.password?.message ? (
                    <FieldError>{errors.password.message}</FieldError>
                  ) : (
                    <FieldDescription>{t('users.form.passwordTooShort')}</FieldDescription>
                  )}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-confirm-password">{t('users.form.passwordConfirm')} *</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <span className="inline-flex text-muted-foreground"><Lock size={18} strokeWidth={1.75} /></span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="user-confirm-password"
                      type="password"
                      {...registerField('confirmPassword')}
                      aria-invalid={!!errors.confirmPassword || passwordsMismatch}
                      placeholder={t('users.form.passwordRetype')}
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
            <h6 className="m-0 mb-2 text-sm font-semibold text-primary">
              {t('users.form.roleAndStatus')}
            </h6>

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-role">{t('users.role')} *</FieldLabel>
                  <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="user-role" className="w-full" aria-invalid={!!errors.role}>
                          <SelectValue placeholder={t('users.role')} />
                        </SelectTrigger>
                        <SelectContent>
                          {userRoles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-flex text-[18px]">{role.icon}</span>
                                {t(role.labelKey, role.label)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.role?.message ? (
                    <FieldError className="text-[0.7rem]">{errors.role.message}</FieldError>
                  ) : (
                    <FieldDescription className="text-[0.7rem]">
                      {t('users.form.roleHint')}
                    </FieldDescription>
                  )}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-status">Statut *</FieldLabel>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="user-status" className="w-full" aria-invalid={!!errors.status}>
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent>
                          {userStatuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <StatusChip tone={STATUS_TONE[status.color] ?? 'neutral'} label={t(status.labelKey, status.label)} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.status?.message ? (
                    <FieldError className="text-[0.7rem]">{errors.status.message}</FieldError>
                  ) : (
                    <FieldDescription className="text-[0.7rem]">
                      {t('users.form.statusHint')}
                    </FieldDescription>
                  )}
                </Field>
              </div>
            </div>

            {/* Aperçu du rôle sélectionné. Icone lucide et non un emoji (interdit
                produit) ; les deux lignes sont des blocs, sans quoi `mb-1` sur un
                <span> inline n'a aucun effet et les deux textes se suivent sur la
                meme ligne. */}
            {watchedRole && (
              <div className="mb-3 p-2 bg-field border border-solid border-field-line rounded-md">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <AdminPanelSettings size={14} strokeWidth={1.75} />
                  {t('users.form.selectedRole')} {(() => {
                    const r = userRoles.find((x) => x.value === watchedRole);
                    return r ? t(r.labelKey, r.label) : '';
                  })()}
                </span>
                <span className="block text-[0.7rem] text-muted-foreground">
                  {watchedRole && t('roles.platformDesc.' + watchedRole, '')}
                </span>
              </div>
            )}

            {/* Organisation */}
            <h6 className="m-0 mb-2 text-sm font-semibold text-primary">
              Organisation
            </h6>

            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-organization">{t('users.form.organization')}</FieldLabel>
                  <Controller
                    name="organizationId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || NONE_OPTION}
                        onValueChange={(value) => field.onChange(value === NONE_OPTION ? '' : value)}
                      >
                        <SelectTrigger id="user-organization" className="w-full" aria-invalid={!!errors.organizationId}>
                          <SelectValue placeholder={t('common.none')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_OPTION}>
                            <span className="text-muted-foreground">{t('common.none')}</span>
                          </SelectItem>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={String(org.id)}>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-flex text-muted-foreground"><Business size={18} strokeWidth={1.75} /></span>
                                {org.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.organizationId?.message ? (
                    <FieldError className="text-[0.7rem]">{errors.organizationId.message}</FieldError>
                  ) : (
                    <FieldDescription className="text-[0.7rem]">
                      {t('users.form.orgOptionalHint')}
                    </FieldDescription>
                  )}
                </Field>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="user-org-role">
                    {t('users.form.orgRoleLabel')} {watchedOrganizationId && watchedOrganizationId !== '' ? '*' : ''}
                  </FieldLabel>
                  <Controller
                    name="orgRole"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || NONE_OPTION}
                        onValueChange={(value) => field.onChange(value === NONE_OPTION ? '' : value)}
                        disabled={!watchedOrganizationId || watchedOrganizationId === ''}
                      >
                        <SelectTrigger id="user-org-role" className="w-full" aria-invalid={!!errors.orgRole}>
                          <SelectValue placeholder={t('common.noneMasc')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_OPTION}>
                            <span className="text-muted-foreground">{t('common.noneMasc')}</span>
                          </SelectItem>
                          {orgMemberRoles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-flex text-muted-foreground"><Group size={18} strokeWidth={1.75} /></span>
                                {t(role.labelKey, role.label)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.orgRole?.message ? (
                    <FieldError className="text-[0.7rem]">{errors.orgRole.message}</FieldError>
                  ) : (
                    <FieldDescription className="text-[0.7rem]">
                      {watchedOrganizationId && watchedOrganizationId !== ''
                        ? "Requis — rôle de l'utilisateur dans l'organisation"
                        : "Sélectionnez d'abord une organisation"}
                    </FieldDescription>
                  )}
                </Field>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserForm;
