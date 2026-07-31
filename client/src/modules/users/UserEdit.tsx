import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { Info, TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Box, TextField, Button, FormControl, InputLabel, Select, MenuItem, FormHelperText, IconButton, Autocomplete } from '@mui/material';
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
          <AlertDescription><h6 className="cn-text-subtitle1 mb-[0.35em] mb-1.5">
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
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(`/users/${id}`)}
              startIcon={<Cancel size={16} strokeWidth={1.75} />}
              disabled={saving}
              sx={{ fontSize: '0.8125rem', textTransform: 'none' }}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmit}
              startIcon={
                saving ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Save size={16} strokeWidth={1.75} />
                )
              }
              disabled={saving}
              sx={{ ml: 1, fontSize: '0.8125rem', textTransform: 'none', fontWeight: 600 }}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
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
            <TextField
              fullWidth
              size="small"
              label="Prénom"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              required
              placeholder="Ex: Jean"
            />
            <TextField
              fullWidth
              size="small"
              label="Nom"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              required
              placeholder="Ex: Dupont"
            />
          </DetailSection>

          {/* Contact — accent teal */}
          <DetailSection
            title="Informations de contact"
            accentColor="#4A9B8E"
            icon={<Email size={14} strokeWidth={1.75} />}
          >
            <TextField
              fullWidth
              size="small"
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              placeholder="Ex: jean.dupont@clenzy.fr"
              InputProps={{
                startAdornment: (
                  <span className="inline-flex text-muted-foreground opacity-60 me-1.5">
                    <Email size={16} strokeWidth={1.75} />
                  </span>
                ),
              }}
            />
            <TextField
              fullWidth
              size="small"
              label="Téléphone"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="Ex: +33 6 12 34 56 78"
              InputProps={{
                startAdornment: (
                  <span className="inline-flex text-muted-foreground opacity-60 me-1.5">
                    <Phone size={16} strokeWidth={1.75} />
                  </span>
                ),
              }}
            />
          </DetailSection>

          {/* Rôle et statut — accent purple */}
          <DetailSection
            title="Rôle et statut"
            accentColor="#7B68A8"
            icon={<AdminPanelSettings size={14} strokeWidth={1.75} />}
            disableGrid
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <FormControl fullWidth required size="small">
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  label="Rôle"
                  renderValue={(value) => {
                    const r = getRoleEntry(value as string);
                    if (!r) return null;
                    return (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <RoleIconBadge role={r.value} size={22} />
                        <p className="cn-text-body2 font-medium">{r.label}</p>
                      </div>
                    );
                  }}
                >
                  {USER_ROLES.map((role) => (
                    <MenuItem key={role.value} value={role.value} sx={{ py: 1 }}>
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
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText sx={{ fontSize: '0.7rem' }}>
                  Le rôle détermine les permissions de l'utilisateur
                </FormHelperText>
              </FormControl>

              <FormControl fullWidth required size="small">
                <InputLabel>Statut</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Statut"
                  renderValue={(value) => {
                    const s = userStatuses.find((x) => x.value === value);
                    if (!s) return null;
                    return (
                      <StatusChip tokens={semTokens(s.color)} label={s.label} />
                    );
                  }}
                >
                  {userStatuses.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      <StatusChip tokens={semTokens(status.color)} label={status.label} />
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText sx={{ fontSize: '0.7rem' }}>
                  Le statut détermine si l'utilisateur peut se connecter
                </FormHelperText>
              </FormControl>
            </Box>

            {/* Aperçu inline du rôle sélectionné — utilise le même badge que la liste */}
            {selectedRoleInfo && (
              <Box
                sx={{
                  mt: 2,
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: 'var(--accent-soft)',
                  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                }}
              >
                <RoleIconBadge role={selectedRoleInfo.value} size={32} />
                <div className="min-w-0">
                  <p className="cn-text-body1 text-[0.75rem] font-bold text-foreground mb-0">
                    Rôle sélectionné : {selectedRoleInfo.label}
                  </p>
                  <p className="cn-text-body1 text-[0.75rem] text-muted-foreground leading-[1.4]">
                    {selectedRoleInfo.description}
                  </p>
                </div>
              </Box>
            )}
          </DetailSection>

          {/* Organisation — accent warm */}
          <DetailSection
            title="Organisation"
            accentColor="#D4A574"
            icon={<Business size={14} strokeWidth={1.75} />}
            disableGrid
          >
            <Box sx={{ maxWidth: { xs: '100%', md: '50%' } }}>
              <Autocomplete
                size="small"
                options={organizations}
                value={selectedOrg}
                loading={orgsLoading}
                onChange={(_event, newValue) => setSelectedOrg(newValue)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  return (
                    <li key={key} {...optionProps}>
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="inline-flex text-muted-foreground opacity-60">
                          <Business size={16} strokeWidth={1.75} />
                        </span>
                        <p className="cn-text-body2 flex-1">
                          {option.name}
                        </p>
                        <span className="cn-text-caption text-muted-foreground">
                          {option.memberCount} membre{option.memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Organisation"
                    placeholder="Sélectionner une organisation"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {orgsLoading ? <Spinner className="size-4" /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                noOptionsText="Aucune organisation"
              />
              <FormHelperText sx={{ fontSize: '0.7rem', mt: 0.5 }}>
                Organisation à laquelle l'utilisateur est rattaché
              </FormHelperText>
            </Box>
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <TextField
                fullWidth
                size="small"
                label="Nouveau mot de passe"
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => handleInputChange('newPassword', e.target.value)}
                placeholder="Minimum 8 caractères"
                InputProps={{
                  startAdornment: (
                    <span className="inline-flex text-muted-foreground opacity-60 me-1.5">
                      <Lock size={16} strokeWidth={1.75} />
                    </span>
                  ),
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      edge="end"
                      size="small"
                      aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showNewPassword ? (
                        <VisibilityOff size={16} strokeWidth={1.75} />
                      ) : (
                        <Visibility size={16} strokeWidth={1.75} />
                      )}
                    </IconButton>
                  ),
                }}
              />
              <TextField
                fullWidth
                size="small"
                label="Confirmer le mot de passe"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Répétez le mot de passe"
                InputProps={{
                  startAdornment: (
                    <span className="inline-flex text-muted-foreground opacity-60 me-1.5">
                      <Lock size={16} strokeWidth={1.75} />
                    </span>
                  ),
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      size="small"
                      aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showConfirmPassword ? (
                        <VisibilityOff size={16} strokeWidth={1.75} />
                      ) : (
                        <Visibility size={16} strokeWidth={1.75} />
                      )}
                    </IconButton>
                  ),
                }}
              />
            </Box>
          </DetailSection>
        </div>
      </form>
    </div>
  );
};

export default UserEdit;
