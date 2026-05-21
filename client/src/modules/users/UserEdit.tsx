import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  alpha,
  useTheme,
} from '@mui/material';
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
import { usersApi, type User, type UserFormData } from '../../services/api';
import { organizationsApi, OrganizationDto } from '../../services/api/organizationsApi';
import PageHeader from '../../components/PageHeader';
import type { ChipColor } from '../../types';
import { semanticToHex, softChipSx } from '../../utils/statusUtils';
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
  const theme = useTheme();
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
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ p: 2, py: 1 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
            Acces non autorise
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            Vous n'avez pas les permissions necessaires pour modifier des utilisateurs.
          </Typography>
        </Alert>
      </Box>
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error && !user) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ p: 2, py: 1 }}>{error}</Alert>
      </Box>
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
    <Box sx={{ p: 2 }}>
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
                  <CircularProgress size={14} color="inherit" />
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
        <Alert severity="error" sx={{ mb: 2, py: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, py: 1 }}>
          Utilisateur modifie avec succes ! Redirection en cours...
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mr: 1 }}>
                    <Email size={16} strokeWidth={1.75} />
                  </Box>
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
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mr: 1 }}>
                    <Phone size={16} strokeWidth={1.75} />
                  </Box>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <RoleIconBadge role={r.value} size={22} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.label}</Typography>
                      </Box>
                    );
                  }}
                >
                  {USER_ROLES.map((role) => (
                    <MenuItem key={role.value} value={role.value} sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <RoleIconBadge role={role.value} size={26} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                            {role.label}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.6875rem',
                              color: 'text.secondary',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 320,
                            }}
                          >
                            {role.description}
                          </Typography>
                        </Box>
                      </Box>
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
                      <Chip
                        label={s.label}
                        size="small"
                        sx={softChipSx(semanticToHex(s.color))}
                      />
                    );
                  }}
                >
                  {userStatuses.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      <Chip
                        label={status.label}
                        size="small"
                        sx={softChipSx(semanticToHex(status.color))}
                      />
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
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                }}
              >
                <RoleIconBadge role={selectedRoleInfo.value} size={32} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'text.primary',
                      mb: 0.125,
                    }}
                  >
                    Rôle sélectionné : {selectedRoleInfo.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 }}>
                    {selectedRoleInfo.description}
                  </Typography>
                </Box>
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
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                        <Business size={16} strokeWidth={1.75} />
                      </Box>
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
                    placeholder="Sélectionner une organisation"
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
                <Chip
                  label="Les mots de passe correspondent"
                  size="small"
                  sx={softChipSx(semanticToHex('success'))}
                />
              ) : passwordsMismatch ? (
                <Chip
                  label="Les mots de passe ne correspondent pas"
                  size="small"
                  sx={softChipSx(semanticToHex('error'))}
                />
              ) : undefined
            }
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
              Laissez ces champs vides si vous ne souhaitez pas changer le mot de passe.
            </Typography>
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
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mr: 1 }}>
                      <Lock size={16} strokeWidth={1.75} />
                    </Box>
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
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mr: 1 }}>
                      <Lock size={16} strokeWidth={1.75} />
                    </Box>
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
        </Box>
      </form>
    </Box>
  );
};

export default UserEdit;
