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
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormHelperText,
} from '@mui/material';
import {
  Save,
  Cancel,
  Add,
  Delete,
  Group,
  Person,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi, usersApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { teamSchema, type TeamFormValues, type TeamFormInput } from '../../schemas';

// Type pour les utilisateurs
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const interventionTypes = [
  { value: 'CLEANING', label: 'Nettoyage', icon: '🧹', roles: ['housekeeper'] },
  { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express', icon: '🧹', roles: ['housekeeper'] },
  { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur', icon: '🧹', roles: ['housekeeper'] },
  { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres', icon: '🧹', roles: ['housekeeper'] },
  { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols', icon: '🧹', roles: ['housekeeper'] },
  { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine', icon: '🧹', roles: ['housekeeper'] },
  { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires', icon: '🧹', roles: ['housekeeper'] },
  { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance Préventive', icon: '🔧', roles: ['technician', 'supervisor'] },
  { value: 'EMERGENCY_REPAIR', label: 'Réparation d\'Urgence', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'ELECTRICAL_REPAIR', label: 'Réparation Électrique', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'PLUMBING_REPAIR', label: 'Réparation Plomberie', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'HVAC_REPAIR', label: 'Réparation Climatisation', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'APPLIANCE_REPAIR', label: 'Réparation Électroménager', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'GARDENING', label: 'Jardinage', icon: '🌱', roles: ['technician'] },
  { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Extérieur', icon: '🧹', roles: ['housekeeper'] },
  { value: 'PEST_CONTROL', label: 'Désinsectisation', icon: '🐛', roles: ['technician'] },
  { value: 'DISINFECTION', label: 'Désinfection', icon: '🧪', roles: ['housekeeper', 'technician'] },
  { value: 'RESTORATION', label: 'Remise en État', icon: '🔨', roles: ['technician', 'supervisor'] },
  { value: 'OTHER', label: 'Autre', icon: '📋', roles: ['housekeeper', 'technician', 'supervisor', 'manager'] }
];

// teamRoles sera généré dynamiquement avec les traductions

const TeamForm: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // État pour les permissions
  const [canCreate, setCanCreate] = useState(false);

  // react-hook-form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeamFormInput, unknown, TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      description: '',
      interventionType: 'CLEANING',
      members: [],
    },
  });

  // useFieldArray for dynamic members
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'members',
  });

  // Watch interventionType to react to changes
  const watchedInterventionType = watch('interventionType');

  // Vérifier les permissions au chargement
  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('teams:create');
      setCanCreate(canCreatePermission);
    };

    checkPermissions();
  }, [hasPermissionAsync]);

  // Charger la liste des utilisateurs depuis l'API
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const data = await usersApi.getAll();
        const usersList = (data as any).content || data;
        setUsers(usersList);
      } catch (err) {
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  // Si le type d'intervention change, vider la liste des membres
  useEffect(() => {
    replace([]);
  }, [watchedInterventionType, replace]);

  // Vérifier les permissions APRÈS tous les hooks
  if (!canCreate) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ py: 1 }}>
          {t('teams.errors.noPermission')}
        </Alert>
      </Box>
    );
  }

  // Filtrer les utilisateurs selon le type d'intervention sélectionné
  const getFilteredUsers = () => {
    const selectedType = interventionTypes.find(type => type.value === watchedInterventionType);
    if (!selectedType) return users;

    return users.filter(user =>
      selectedType.roles.includes(user.role.toLowerCase())
    );
  };

  // Générer les rôles avec traductions
  const teamRoles = [
    { value: 'housekeeper', label: t('teams.roles.housekeeper') },
    { value: 'technician', label: t('teams.roles.technician') },
    { value: 'supervisor', label: t('teams.roles.supervisor') },
    { value: 'manager', label: t('teams.roles.manager') },
  ];

  // Obtenir les rôles disponibles pour le type d'intervention sélectionné
  const getAvailableRoles = () => {
    const selectedType = interventionTypes.find(type => type.value === watchedInterventionType);
    if (!selectedType) return teamRoles;

    return teamRoles.filter(role =>
      selectedType.roles.includes(role.value)
    );
  };

  const handleAddMember = () => {
    const availableRoles = getAvailableRoles();
    append({
      userId: 0,
      firstName: '',
      lastName: '',
      email: '',
      role: availableRoles[0]?.value || 'housekeeper',
    });
  };

  const handleUserSelection = (index: number, user: User | null) => {
    if (user) {
      setValue(`members.${index}.userId`, user.id);
      setValue(`members.${index}.firstName`, user.firstName);
      setValue(`members.${index}.lastName`, user.lastName);
      setValue(`members.${index}.email`, user.email);
      setValue(`members.${index}.role`, user.role);
    }
  };

  const onSubmit = async (formData: TeamFormValues) => {
    setSaving(true);
    setError(null);

    try {
      // Préparer les données pour le backend
      const backendData = {
        name: formData.name.trim(),
        description: (formData.description || '').trim(),
        interventionType: formData.interventionType,
        members: formData.members.map(member => ({
          userId: member.userId,
          role: member.role,
        })),
      };

      await teamsApi.create(backendData as any);
      setSuccess(true);
      setTimeout(() => {
        navigate('/teams');
      }, 1500);
    } catch (err: any) {
      setError(t('teams.errors.createErrorDetails') + ': ' + (err?.message || t('teams.errors.createError')));
    } finally {
      setSaving(false);
    }
  };

  if (loadingUsers) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const filteredUsers = getFilteredUsers();
  const availableRoles = getAvailableRoles();
  const selectedInterventionType = interventionTypes.find(type => type.value === watchedInterventionType);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header avec bouton retour et titre */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton
          onClick={() => navigate('/teams')}
          sx={{ mr: 1.5 }}
          size="small"
        >
          <ArrowBack sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography variant="h6" fontWeight={600}>
          {t('teams.createTitle')}
        </Typography>
      </Box>

      <PageHeader
        title={t('teams.createTitle')}
        subtitle={t('teams.createSubtitle')}
        backPath="/teams"
        showBackButton={false}
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => navigate('/teams')}
              startIcon={<Cancel />}
              disabled={saving}
              sx={{ mr: 1 }}
              size="small"
            >
              {t('teams.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                // Déclencher la soumission du formulaire
                const submitButton = document.querySelector('[data-submit-team]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              startIcon={saving ? <CircularProgress size={16} /> : <Save sx={{ fontSize: 16 }} />}
              disabled={saving || filteredUsers.length === 0}
              size="small"
            >
              {saving ? t('teams.creating') : t('teams.createTeam')}
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
          {t('teams.createSuccess')}
        </Alert>
      )}

      {/* Root-level members validation error */}
      {errors.members?.root?.message && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {errors.members.root.message}
        </Alert>
      )}
      {errors.members?.message && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {errors.members.message}
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Informations de base */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('teams.sections.teamInfo')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={`${t('teams.fields.teamName')} *`}
                      placeholder={t('teams.fields.teamNamePlaceholder')}
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="interventionType"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth error={!!fieldState.error}>
                      <InputLabel>{t('teams.fields.interventionType')} *</InputLabel>
                      <Select
                        {...field}
                        label={`${t('teams.fields.interventionType')} *`}
                        size="small"
                      >
                        {interventionTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <span style={{ fontSize: '1em' }}>{type.icon}</span>
                              <Typography variant="body2">{type.label}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>

            {/* Description */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      fullWidth
                      label={t('teams.fields.description')}
                      placeholder={t('teams.fields.descriptionPlaceholder')}
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>

            {/* Informations sur le type d'intervention */}
            {selectedInterventionType && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" fontWeight={600} color="primary" sx={{ mb: 0.75, fontSize: '0.75rem', display: 'block' }}>
                  📋 {t('teams.fields.interventionTypeInfo')} : {selectedInterventionType.icon} {selectedInterventionType.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                  {t('teams.fields.authorizedRoles')} : {selectedInterventionType.roles.map(role =>
                    teamRoles.find(r => r.value === role)?.label
                  ).join(', ')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.7rem', display: 'block' }}>
                  {filteredUsers.length} {t('teams.fields.usersAvailable')}
                </Typography>
              </Box>
            )}

            {/* Membres de l'équipe */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('teams.sections.teamMembers')}
            </Typography>

            {fields.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 2.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, display: 'block', fontSize: '0.85rem' }}>
                  {t('teams.fields.noMemberAdded')}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={<Add sx={{ fontSize: 16 }} />}
                    onClick={handleAddMember}
                    disabled={filteredUsers.length === 0}
                    size="small"
                  >
                    {filteredUsers.length === 0 ? t('teams.fields.noUserAvailable') : t('teams.fields.addFirstMember')}
                  </Button>
                </Box>
                {filteredUsers.length === 0 && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, fontSize: '0.7rem' }}>
                    {t('teams.fields.noUserWithRoles')}
                  </Typography>
                )}
              </Box>
            ) : (
              <List>
                {fields.map((field, index) => (
                  <React.Fragment key={field.id}>
                    <ListItem sx={{ px: 0, py: 0.75 }}>
                      <Grid container spacing={1.5} alignItems="center">
                        <Grid item xs={12} md={4}>
                          <Controller
                            name={`members.${index}.userId`}
                            control={control}
                            render={({ field: userIdField, fieldState }) => (
                              <Autocomplete
                                options={filteredUsers}
                                getOptionLabel={(user) => `${user.firstName} ${user.lastName} (${user.email})`}
                                value={filteredUsers.find(u => u.id === userIdField.value) || null}
                                onChange={(_, user) => handleUserSelection(index, user)}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label={`${t('teams.fields.selectUser')} *`}
                                    size="small"
                                    error={!!fieldState.error}
                                    helperText={fieldState.error?.message}
                                  />
                                )}
                                renderOption={(props, user) => (
                                  <li {...props}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                      <Person sx={{ fontSize: 18 }} />
                                      <Typography variant="body2">{user.firstName} {user.lastName} ({user.email})</Typography>
                                    </Box>
                                  </li>
                                )}
                              />
                            )}
                          />
                        </Grid>

                        <Grid item xs={12} md={3}>
                          <Controller
                            name={`members.${index}.role`}
                            control={control}
                            render={({ field: roleField, fieldState }) => (
                              <FormControl fullWidth size="small" error={!!fieldState.error}>
                                <InputLabel>{t('teams.fields.roleInTeam')}</InputLabel>
                                <Select
                                  {...roleField}
                                  label={t('teams.fields.roleInTeam')}
                                >
                                  {availableRoles.map((role) => (
                                    <MenuItem key={role.value} value={role.value}>
                                      {role.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {fieldState.error && (
                                  <FormHelperText>{fieldState.error.message}</FormHelperText>
                                )}
                              </FormControl>
                            )}
                          />
                        </Grid>

                        <Grid item xs={12} md={3}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                              label={field.firstName && field.lastName ? `${field.firstName} ${field.lastName}` : t('teams.fields.notSelected')}
                              color={field.userId ? 'primary' : 'default'}
                              size="small"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                            {field.role && (
                              <Chip
                                label={availableRoles.find(r => r.value === field.role)?.label || field.role}
                                variant="outlined"
                                size="small"
                                sx={{ height: 22, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={2}>
                          <IconButton
                            onClick={() => remove(index)}
                            color="error"
                            size="small"
                            sx={{ p: 0.5 }}
                          >
                            <Delete sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </ListItem>
                    {index < fields.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}

            {/* Bouton ajouter membre */}
            {fields.length > 0 && filteredUsers.length > fields.length && (
              <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                <Button
                  variant="outlined"
                  startIcon={<Add sx={{ fontSize: 16 }} />}
                  onClick={handleAddMember}
                  size="small"
                >
                  {t('teams.fields.addMember')}
                </Button>
              </Box>
            )}

            {/* Bouton de soumission caché pour le PageHeader */}
            <Button
              type="submit"
              sx={{ display: 'none' }}
              data-submit-team
            >
              Soumettre
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeamForm;
