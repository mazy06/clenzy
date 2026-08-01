import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { Info, TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
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
  AdminPanelSettings,
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

// Couleur semantique → tokens (chips -soft : texte couleur + fond -soft)
const SEM_TOKEN: Partial<Record<ChipColor, { fg: string; bg: string }>> = {
  success: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  warning: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  error: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  info: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  primary: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
};
const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };
/** Tokens de la primitive pour une couleur semantique. */
const semTokens = (color: ChipColor) => {
  const tk = SEM_TOKEN[color] ?? NEUTRAL_TOKEN;
  return { color: tk.fg, bg: tk.bg };
};
import DetailSection from './components/DetailSection';
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
          <AlertDescription><h6 className="cn-text-subtitle1 mb-1.5">
            Acces non autorise
          </h6><p className="cn-text-body2 text-[0.85rem]">
            Vous n'avez pas les permissions necessaires pour modifier des utilisateurs.
          </p></AlertDescription>
        </BuiAlert>
      </div>
    );
  }

  const handleInputChange = (field: keyof UserEditData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'Le prenom est obligatoire';
    if (!formData.lastName.trim()) return 'Le nom est obligatoire';
    if (!formData.email.trim()) return "L'email est obligatoire";
    if (!formData.email.includes('@')) return "L'email doit etre valide";
    if (!formData.role) return 'Le role est obligatoire';
    if (!formData.status) return 'Le statut est obligatoire';

    if (formData.newPassword && !formData.confirmPassword) {
      return 'Veuillez confirmer le nouveau mot de passe';
    }
    if (!formData.newPassword && formData.confirmPassword) {
      return 'Veuillez saisir le nouveau mot de passe';
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
    <div className="p-3">
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
          <AlertDescription>Utilisateur modifie avec succes ! Redirection en cours...</AlertDescription>
        </BuiAlert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          {/* Photo de profil — first section, OTA-aware */}
          {user && (
            <DetailSection
              title="Photo de profil"
              accentColor="#7BA3C2"
              icon={<Person size={14} strokeWidth={1.75} />}
              disableGrid
            >
              <AvatarUploader
                user={user}
                onChange={(next) => setUser(next)}
              />
            </DetailSection>
          )}

          {/* Personnel — accent slate */}
          <DetailSection
            title="Informations personnelles"
            accentColor="#6B8A9A"
            icon={<Person size={14} strokeWidth={1.75} />}
          >
            <Field>
              <FieldLabel htmlFor="user-first-name">Prénom</FieldLabel>
              <Input
                id="user-first-name"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
                placeholder="Ex: Jean"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-last-name">Nom</FieldLabel>
              <Input
                id="user-last-name"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
                placeholder="Ex: Dupont"
              />
            </Field>
          </DetailSection>

          {/* Contact — accent teal */}
          <DetailSection
            title="Informations de contact"
            accentColor="#4A9B8E"
            icon={<Email size={14} strokeWidth={1.75} />}
          >
            <Field>
              <FieldLabel htmlFor="user-email">Email</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <span className="inline-flex text-muted-foreground opacity-60">
                    <Email size={16} strokeWidth={1.75} />
                  </span>
                </InputGroupAddon>
                <InputGroupInput
                  id="user-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  placeholder="Ex: jean.dupont@baitly.fr"
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="user-phone">Téléphone</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <span className="inline-flex text-muted-foreground opacity-60">
                    <Phone size={16} strokeWidth={1.75} />
                  </span>
                </InputGroupAddon>
                <InputGroupInput
                  id="user-phone"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  placeholder="Ex: +33 6 12 34 56 78"
                />
              </InputGroup>
            </Field>
          </DetailSection>

          {/* Rôle et statut — accent purple */}
          <DetailSection
            title="Rôle et statut"
            accentColor="#7B68A8"
            icon={<AdminPanelSettings size={14} strokeWidth={1.75} />}
            disableGrid
          >
            <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3">
              <Field>
                <FieldLabel htmlFor="user-role">Rôle</FieldLabel>
                {/* SelectValue avec enfants = report du `renderValue` MUI : la
                    pastille reste compacte dans le declencheur alors que l'option
                    deroulee porte en plus sa description. `h-auto` car la pastille
                    (22px) depasse la hauteur fixe du declencheur. */}
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                >
                  <SelectTrigger id="user-role" className="w-full h-auto min-h-9">
                    <SelectValue placeholder="Sélectionner un rôle">
                      {selectedRoleInfo && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <RoleIconBadge role={selectedRoleInfo.value} size={22} />
                          <p className="cn-text-body2 font-medium">{selectedRoleInfo.label}</p>
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
                            <p className="cn-text-body2 font-medium leading-[1.2]">
                              {role.label}
                            </p>
                            <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap max-w-[320px]">
                              {role.description}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription className="text-[0.7rem]">
                  Le rôle détermine les permissions de l'utilisateur
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="user-status">Statut</FieldLabel>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)}
                >
                  <SelectTrigger id="user-status" className="w-full h-auto min-h-9">
                    <SelectValue placeholder="Sélectionner un statut">
                      {selectedStatusInfo && (
                        <StatusChip tokens={semTokens(selectedStatusInfo.color)} label={selectedStatusInfo.label} />
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {userStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value} textValue={status.label}>
                        <StatusChip tokens={semTokens(status.color)} label={status.label} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription className="text-[0.7rem]">
                  Le statut détermine si l'utilisateur peut se connecter
                </FieldDescription>
              </Field>
            </div>

            {/* Aperçu inline du rôle sélectionné — utilise le même badge que la liste */}
            {selectedRoleInfo && (
              <div className="mt-3 p-[9px] rounded-[12px] bg-[var(--accent-soft)] border border-solid border-[color-mix(in_srgb,_var(--accent)_30%,_transparent)] flex items-center gap-[7.5px]">
                <RoleIconBadge role={selectedRoleInfo.value} size={32} />
                <div className="min-w-0">
                  <p className="cn-text-body1 text-[0.75rem] font-bold text-foreground mb-0">
                    Rôle sélectionné : {selectedRoleInfo.label}
                  </p>
                  <p className="cn-text-body1 text-[0.75rem] text-muted-foreground leading-[1.4]">
                    {selectedRoleInfo.description}
                  </p>
                </div>
              </div>
            )}
          </DetailSection>

          {/* Organisation — accent warm */}
          <DetailSection
            title="Organisation"
            accentColor="#D4A574"
            icon={<Business size={14} strokeWidth={1.75} />}
            disableGrid
          >
            <div className="max-w-full min-[900px]:max-w-[50%]">
              <Field>
                <FieldLabel htmlFor="user-organization">Organisation</FieldLabel>
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
                    placeholder="Sélectionner une organisation"
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
                    <ComboboxEmpty>Aucune organisation</ComboboxEmpty>
                    <ComboboxList>
                      {(option: OrganizationDto) => (
                        <ComboboxItem key={option.id} value={option}>
                          <span className="flex items-center gap-1.5 w-full">
                            <span className="inline-flex text-muted-foreground opacity-60">
                              <Business size={16} strokeWidth={1.75} />
                            </span>
                            <span className="cn-text-body2 flex-1">{option.name}</span>
                            <span className="cn-text-caption text-muted-foreground">
                              {option.memberCount} membre{option.memberCount !== 1 ? 's' : ''}
                            </span>
                          </span>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <FieldDescription className="text-[0.7rem] mt-[3px]">
                  Organisation à laquelle l'utilisateur est rattaché
                </FieldDescription>
              </Field>
            </div>
          </DetailSection>

          {/* Changement de mot de passe — accent muted red (security cue) */}
          <DetailSection
            title="Changement de mot de passe"
            accentColor="#C97A7A"
            icon={<Lock size={14} strokeWidth={1.75} />}
            disableGrid
            action={
              passwordsMatch ? (
                <StatusChip tokens={semTokens('success')} label="Les mots de passe correspondent" />
              ) : passwordsMismatch ? (
                <StatusChip tokens={semTokens('error')} label="Les mots de passe ne correspondent pas" />
              ) : undefined
            }
          >
            <p className="cn-text-body2 text-muted-foreground mb-3 text-[0.75rem]">
              Laissez ces champs vides si vous ne souhaitez pas changer le mot de passe.
            </p>
            <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3">
              <Field>
                <FieldLabel htmlFor="user-new-password">Nouveau mot de passe</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <span className="inline-flex text-muted-foreground opacity-60">
                      <Lock size={16} strokeWidth={1.75} />
                    </span>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="user-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    placeholder="Minimum 8 caractères"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
                <FieldLabel htmlFor="user-confirm-password">Confirmer le mot de passe</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <span className="inline-flex text-muted-foreground opacity-60">
                      <Lock size={16} strokeWidth={1.75} />
                    </span>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="user-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Répétez le mot de passe"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
