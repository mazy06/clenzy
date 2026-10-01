import React, { useState, useEffect } from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { Info, TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Field, FieldDescription, FieldLabel, Input, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '../../components/ui/combobox';
import {
  Save,
  Cancel,
  Email,
  Phone,
  Lock,
  Visibility,
  VisibilityOff,
  Business,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usersApi, type User, type UserFormData } from '../../services/api/usersApi';
import { organizationsApi, OrganizationDto } from '../../services/api/organizationsApi';
import PageHeader from '../../components/PageHeader';
import type { ChipColor } from '../../types';

// Couleur semantique → ton de la primitive StatusChip, qui porte deja le couple
// Baitly UI conforme AA (encre `-ink` sur fond `-soft`).
const SEM_TONE: Partial<Record<ChipColor, StatusTone>> = {
  success: 'ok',
  warning: 'warn',
  error: 'err',
  info: 'info',
  primary: 'accent',
  secondary: 'accent',
};
/** Ton de la primitive pour une couleur semantique. */
const semTone = (color: ChipColor): StatusTone => SEM_TONE[color] ?? 'neutral';
import DetailSection from './components/DetailSection';
import { useTranslation } from '../../hooks/useTranslation';
import AvatarUploader from './components/AvatarUploader';
import { USER_ROLES, getRoleEntry, RoleIconBadge } from './components/userRoleCatalog';

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

const userStatuses: Array<{ value: string; label: string; color: ChipColor }> = [
  { value: 'ACTIVE', label: 'Actif', color: 'success' },
  { value: 'INACTIVE', label: 'Inactif', color: 'default' },
  { value: 'SUSPENDED', label: 'Suspendu', color: 'error' },
  { value: 'PENDING_VERIFICATION', label: 'En attente de verification', color: 'warning' },
  { value: 'BLOCKED', label: 'Bloque', color: 'error' },
];

const UserEdit: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();

  const [canManageUsers, setCanManageUsers] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const canManageUsersPermission = await hasPermissionAsync('users:manage');
      setCanManageUsers(canManageUsersPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  useEffect(() => {
    const loadUser = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const userData = await usersApi.getById(Number(id));
        setUser(userData);

        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phoneNumber: userData.phoneNumber || '',
          role: userData.role?.toUpperCase() || 'HOUSEKEEPER',
          status: userData.status?.toUpperCase() || 'ACTIVE',
        });

        if (userData.organizationId && organizations.length > 0) {
          const userOrg = organizations.find((o) => o.id === userData.organizationId);
          if (userOrg) setSelectedOrg(userOrg);
        }
      } catch (err) {
        setError("Erreur lors du chargement de l'utilisateur");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id, organizations]);

  if (!canManageUsers) {
    return (
      <div className="p-3">
        <BuiAlert variant="info" className="p-3 py-1.5">
          <Info />
          {/* `m-0` reprend ce que portait `cn-text-*` : sans preflight Tailwind,
              un <h6>/<p> natif recupere sinon les marges du navigateur. */}
          <AlertDescription><h6 className="m-0 mb-1.5 text-sm font-medium">
            {t('users.accessDenied.title')}
          </h6><p className="m-0 text-sm">
            {t('users.accessDenied.edit')}
          </p></AlertDescription>
        </BuiAlert>
      </div>
    );
  }

  const handleInputChange = (field: keyof UserEditData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return t('validation.firstNameRequired');
    if (!formData.lastName.trim()) return 'Le nom est obligatoire';
    if (!formData.email.trim()) return "L'email est obligatoire";
    if (!formData.email.includes('@')) return "L'email doit etre valide";
    if (!formData.role) return t('validation.roleRequired');
    if (!formData.status) return t('validation.statusRequired');

    if (formData.newPassword && !formData.confirmPassword) {
      return t('users.confirmNewPassword');
    }
    if (!formData.newPassword && formData.confirmPassword) {
      return t('users.enterNewPassword');
    }
    if (formData.newPassword && formData.confirmPassword) {
      if (formData.newPassword.length < 8) {
        return 'Le mot de passe doit contenir au moins 8 caracteres';
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
      const backendData: Partial<UserFormData> & { newPassword?: string } = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber?.trim() || undefined,
        role: formData.role,
        status: formData.status,
      };

      if (selectedOrg) {
        backendData.organizationId = selectedOrg.id;
      }

      if (formData.newPassword && formData.confirmPassword) {
        backendData.newPassword = formData.newPassword;
      }

      await usersApi.update(Number(id), backendData);
      setSuccess(true);

      setFormData((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }));

      setTimeout(() => {
        navigate(`/users/${id}`);
      }, 1500);
    } catch (err: unknown) {
      setError(
        'Erreur lors de la mise a jour: '
          + (err instanceof Error ? err.message : 'Erreur inconnue'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="p-3">
        <BuiAlert variant="destructive" className="p-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </BuiAlert>
      </div>
    );
  }

  const selectedRoleInfo = getRoleEntry(formData.role);
  const selectedStatusInfo = userStatuses.find((s) => s.value === formData.status);
  const passwordsMatch
    = formData.newPassword
      && formData.confirmPassword
      && formData.newPassword === formData.confirmPassword;
  const passwordsMismatch
    = formData.newPassword
      && formData.confirmPassword
      && formData.newPassword !== formData.confirmPassword;

  return (
    <div>
      <PageHeader
        title="Modifier l'utilisateur"
        subtitle={`${user?.firstName || ''} ${user?.lastName || ''}`}
        backPath={`/users/${id}`}
        showBackButton={false}
        actions={
          <>
            <BuiButton
              variant="outline"
              size="sm"
              onClick={() => navigate(`/users/${id}`)}
              disabled={saving}
            >
              <Cancel strokeWidth={1.75} />
              Annuler
            </BuiButton>
            <BuiButton
              size="sm"
              onClick={handleSubmit}
              disabled={saving}
              className="ms-1.5"
            >
              {saving ? <Spinner className="size-3.5" /> : <Save strokeWidth={1.75} />}
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </BuiButton>
          </>
        }
      />

      {/* Messages d'erreur / succès */}
      {error && (
        <BuiAlert variant="destructive" className="mb-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {success && (
        <BuiAlert variant="success" className="mb-3 py-1.5">
          <CircleCheck />
          <AlertDescription>{t('users.form.updateSuccess')}</AlertDescription>
        </BuiAlert>
      )}

      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl rounded-lg border border-solid border-border bg-card text-foreground">
        <div>
          {user && (
            <DetailSection
              title={t('users.form.photo')}
              disableGrid
            >
              <AvatarUploader
                user={user}
                onChange={(next) => setUser(next)}
              />
            </DetailSection>
          )}

          <DetailSection
            title={t('users.form.personalInfo')}
          >
            <Field>
              <FieldLabel htmlFor="user-first-name">{t('users.firstName')}</FieldLabel>
              <Input
                id="user-first-name"
                autoComplete="given-name"
                className="h-11 motion-reduce:transition-none"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
                placeholder={t('users.form.firstNamePlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-last-name">{t('users.lastName')}</FieldLabel>
              <Input
                id="user-last-name"
                autoComplete="family-name"
                className="h-11 motion-reduce:transition-none"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
                placeholder="Ex: Dupont"
              />
            </Field>
          </DetailSection>

          <DetailSection
            title={t('users.form.contactInfo')}
          >
            <Field>
              <FieldLabel htmlFor="user-email">{t('users.email')}</FieldLabel>
              <InputGroup className="h-11 motion-reduce:transition-none">
                <InputGroupAddon>
                  <span className="inline-flex text-muted-foreground">
                    <Email size={16} strokeWidth={1.75} />
                  </span>
                </InputGroupAddon>
                <InputGroupInput
                  id="user-email"
                  autoComplete="email"
                  className="h-full"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  placeholder={t('users.form.emailPlaceholder')}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="user-phone">{t('common.phone')}</FieldLabel>
              <InputGroup className="h-11 motion-reduce:transition-none">
                <InputGroupAddon>
                  <span className="inline-flex text-muted-foreground">
                    <Phone size={16} strokeWidth={1.75} />
                  </span>
                </InputGroupAddon>
                <InputGroupInput
                  id="user-phone"
                  type="tel"
                  autoComplete="tel"
                  className="h-full tabular-nums"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  placeholder="Ex: +33 6 12 34 56 78"
                />
              </InputGroup>
            </Field>
          </DetailSection>

          <DetailSection
            title={t('users.form.roleAndStatus')}
            disableGrid
          >
            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="user-role">{t('users.role')}</FieldLabel>
                {/* The selected role stays compact; the menu includes its description. */}
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                >
                  <SelectTrigger id="user-role" className="w-full min-h-11 cursor-pointer motion-reduce:transition-none">
                    <SelectValue placeholder={t('users.form.selectRole')}>
                      {selectedRoleInfo && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <RoleIconBadge role={selectedRoleInfo.value} size={22} />
                          <p className="m-0 text-xs font-medium">{selectedRoleInfo.label}</p>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value} textValue={role.label} className="py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <RoleIconBadge role={role.value} size={26} />
                          <div className="min-w-0">
                            <p className="m-0 text-xs font-medium leading-[1.2]">
                              {role.label}
                            </p>
                            <p className="m-0 text-xs text-muted-foreground leading-relaxed whitespace-normal max-w-[320px]">
                              {role.description}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription className="text-xs">
                  {selectedRoleInfo?.description || t('users.form.roleHint')}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="user-status">Statut</FieldLabel>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)}
                >
                  <SelectTrigger id="user-status" className="w-full min-h-11 cursor-pointer motion-reduce:transition-none">
                    <SelectValue placeholder={t('users.form.selectStatus')}>
                      {selectedStatusInfo && (
                        <StatusChip tone={semTone(selectedStatusInfo.color)} label={selectedStatusInfo.label} />
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {userStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value} textValue={status.label}>
                        <StatusChip tone={semTone(status.color)} label={status.label} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription className="text-xs">
                  {t('users.form.statusHint')}
                </FieldDescription>
              </Field>
            </div>
          </DetailSection>

          <DetailSection
            title={t('users.form.organization')}
            disableGrid
          >
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="user-organization">{t('users.form.linkedOrganization')}</FieldLabel>
                <Combobox
                  items={organizations}
                  itemToStringLabel={(o: OrganizationDto) => o.name}
                  itemToStringValue={(o: OrganizationDto) => o.name}
                  isItemEqualToValue={(a: OrganizationDto, b: OrganizationDto) => a.id === b.id}
                  value={selectedOrg}
                  onValueChange={(next: OrganizationDto | null) => setSelectedOrg(next)}
                >
                  <ComboboxInput
                    id="user-organization"
                    className="h-11 motion-reduce:transition-none"
                    placeholder={t('users.form.selectOrganization')}
                  >
                    {/* Report de l'`endAdornment` : la roue tourne tant que la
                        liste des organisations n'est pas chargée. */}
                    {orgsLoading ? (
                      <InputGroupAddon align="inline-end">
                        <Spinner className="size-4" />
                      </InputGroupAddon>
                    ) : null}
                  </ComboboxInput>
                  <ComboboxContent>
                    <ComboboxEmpty>{t('users.form.noOrganization')}</ComboboxEmpty>
                    <ComboboxList>
                      {(option: OrganizationDto) => (
                        <ComboboxItem key={option.id} value={option}>
                          <span className="flex items-center gap-1.5 w-full">
                            <span className="inline-flex text-muted-foreground">
                              <Business size={16} strokeWidth={1.75} />
                            </span>
                            <span className="flex-1 text-xs">{option.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {option.memberCount} membre{option.memberCount !== 1 ? 's' : ''}
                            </span>
                          </span>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <FieldDescription className="text-xs mt-[3px]">
                  {t('users.form.orgHint')}
                </FieldDescription>
              </Field>
            </div>
          </DetailSection>

          <DetailSection
            title={t('users.form.passwordChange')}
            description={t('users.form.passwordOptional')}
            disableGrid
            action={
              passwordsMatch ? (
                <StatusChip tone={semTone('success')} label={t('users.form.passwordsMatch')} />
              ) : passwordsMismatch ? (
                <StatusChip tone={semTone('error')} label={t('users.form.passwordsMismatch')} />
              ) : undefined
            }
          >
            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="user-new-password">{t('users.form.newPassword')}</FieldLabel>
                <InputGroup className="h-11 motion-reduce:transition-none">
                  <InputGroupAddon>
                    <span className="inline-flex text-muted-foreground">
                      <Lock size={16} strokeWidth={1.75} />
                    </span>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="user-new-password"
                    autoComplete="new-password"
                    className="h-full"
                    type={showNewPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    placeholder={t('users.form.passwordHint')}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-sm"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? t('users.form.hidePassword') : t('users.form.showPassword')}
                    >
                      {showNewPassword ? (
                        <VisibilityOff size={16} strokeWidth={1.75} />
                      ) : (
                        <Visibility size={16} strokeWidth={1.75} />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="user-confirm-password">{t('users.form.passwordConfirm')}</FieldLabel>
                <InputGroup className="h-11 motion-reduce:transition-none">
                  <InputGroupAddon>
                    <span className="inline-flex text-muted-foreground">
                      <Lock size={16} strokeWidth={1.75} />
                    </span>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="user-confirm-password"
                    autoComplete="new-password"
                    className="h-full"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder={t('users.form.passwordRetype')}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-sm"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? t('users.form.hidePassword') : t('users.form.showPassword')}
                    >
                      {showConfirmPassword ? (
                        <VisibilityOff size={16} strokeWidth={1.75} />
                      ) : (
                        <Visibility size={16} strokeWidth={1.75} />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
          </DetailSection>
        </div>
      </form>
    </div>
  );
};

export default UserEdit;
