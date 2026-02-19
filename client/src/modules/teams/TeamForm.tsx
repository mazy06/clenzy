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
  Avatar,
  FormHelperText,
  Divider,
} from '@mui/material';
import {
  Save,
  Add,
  Delete,
  Person,
  Group as GroupIcon,
  AutoAwesome,
  Build,
  Category,
  Map as MapIcon,
  DeleteOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi, usersApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { teamSchema, type TeamFormValues, type TeamFormInput } from '../../schemas';
import { teamsKeys } from './useTeamsList';
import { FRENCH_DEPARTMENTS, getArrondissementsForDepartment, hasArrondissements } from '../../data/frenchDepartments';

// Type pour les utilisateurs
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// Catégories de services — une équipe est spécialisée par catégorie (pas par sous-type)
const teamServiceCategories = [
  { value: 'CLEANING', label: 'Nettoyage', description: 'Nettoyage, entretien ménager, désinfection', roles: ['HOUSEKEEPER', 'SUPERVISOR'], color: '#5B9BD5', gradient: 'linear-gradient(135deg, #1a3a5c 0%, #234b73 50%, #1e3d63 100%)' },
  { value: 'MAINTENANCE', label: 'Maintenance', description: 'Réparations, maintenance préventive, travaux', roles: ['TECHNICIAN', 'SUPERVISOR'], color: '#E8A838', gradient: 'linear-gradient(135deg, #3d2e10 0%, #5c4520 50%, #4a3818 100%)' },
  { value: 'OTHER', label: 'Autre', description: 'Services divers, jardinage, remise en état', roles: ['HOUSEKEEPER', 'TECHNICIAN', 'SUPERVISOR', 'MANAGER'], color: '#6B8A9A', gradient: 'linear-gradient(135deg, #1e2a35 0%, #2a3a4a 50%, #243242 100%)' },
];

const getCategoryIcon = (value: string, size: number = 20) => {
  const iconProps = { sx: { fontSize: size } };
  switch (value) {
    case 'CLEANING': return <AutoAwesome {...iconProps} />;
    case 'MAINTENANCE': return <Build {...iconProps} />;
    default: return <Category {...iconProps} />;
  }
};

const TeamForm: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ─── Permissions (useEffect — NOT React Query) ──────────────────────────
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('teams:create');
      setCanCreate(canCreatePermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ─── Users query ────────────────────────────────────────────────────────
  const usersQuery = useQuery({
    queryKey: ['form-available-users'],
    queryFn: async () => {
      const data = await usersApi.getAll();
      const usersList = (data as any).content || data;
      return Array.isArray(usersList) ? usersList : [];
    },
    staleTime: 60_000,
  });

  const users: User[] = usersQuery.data ?? [];
  const loadingUsers = usersQuery.isLoading;

  // ─── Create mutation ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => teamsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.all });
      setSuccess(true);
      setTimeout(() => {
        navigate('/teams');
      }, 1500);
    },
    onError: (err: any) => {
      setError(t('teams.errors.createErrorDetails') + ': ' + (err?.message || t('teams.errors.createError')));
    },
  });

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
      coverageZones: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'members',
  });

  const { fields: zoneFields, append: appendZone, remove: removeZone } = useFieldArray({
    control,
    name: 'coverageZones',
  });

  const watchedInterventionType = watch('interventionType');

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

  // Filtrer les utilisateurs selon la catégorie de service sélectionnée
  const getFilteredUsers = () => {
    const selectedCategory = teamServiceCategories.find(cat => cat.value === watchedInterventionType);
    if (!selectedCategory) return users;
    return users.filter(user => selectedCategory.roles.includes(user.role?.toUpperCase()));
  };

  // Rôles disponibles dans l'équipe (en MAJUSCULES pour matcher le backend)
  const teamRoles = [
    { value: 'HOUSEKEEPER', label: t('teams.roles.housekeeper') },
    { value: 'TECHNICIAN', label: t('teams.roles.technician') },
    { value: 'SUPERVISOR', label: t('teams.roles.supervisor') },
    { value: 'MANAGER', label: t('teams.roles.manager') },
  ];

  const getAvailableRoles = () => {
    const selectedCategory = teamServiceCategories.find(cat => cat.value === watchedInterventionType);
    if (!selectedCategory) return teamRoles;
    return teamRoles.filter(role => selectedCategory.roles.includes(role.value));
  };

  const handleAddMember = () => {
    const availableRoles = getAvailableRoles();
    append({
      userId: 0,
      firstName: '',
      lastName: '',
      email: '',
      role: availableRoles[0]?.value || 'HOUSEKEEPER',
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
    setError(null);
    const backendData = {
      name: formData.name.trim(),
      description: (formData.description || '').trim(),
      interventionType: formData.interventionType,
      members: formData.members.map(member => ({
        userId: member.userId,
        role: member.role,
      })),
      coverageZones: (formData.coverageZones || []).map(zone => ({
        department: zone.department,
        arrondissement: zone.arrondissement || null,
      })),
    };
    createMutation.mutate(backendData);
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
  const selectedCategory = teamServiceCategories.find(cat => cat.value === watchedInterventionType);

  return (
    <Box>
      <PageHeader
        title={t('teams.createTitle')}
        subtitle={t('teams.createSubtitle')}
        backPath="/teams"
        backLabel={t('teams.backToList')}
        showBackButton={true}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => {
                const submitButton = document.querySelector('[data-submit-team]') as HTMLButtonElement;
                if (submitButton) submitButton.click();
              }}
              startIcon={createMutation.isPending ? <CircularProgress size={16} /> : <Save sx={{ fontSize: 16 }} />}
              disabled={createMutation.isPending || filteredUsers.length === 0}
              size="small"
              title={t('teams.createTeam')}
            >
              {createMutation.isPending ? t('teams.creating') : t('teams.createTeam')}
            </Button>
          </Box>
        }
      />

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

      {(errors.members?.root?.message || errors.members?.message) && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {errors.members?.root?.message || errors.members?.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={2}>

          {/* ─── Colonne gauche : Informations de l'équipe ─── */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  {t('teams.sections.teamInfo')}
                </Typography>

                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
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
                          multiline
                          rows={3}
                          size="small"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="interventionType"
                      control={control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth error={!!fieldState.error}>
                          <InputLabel>{t('teams.fields.interventionType')} *</InputLabel>
                          <Select {...field} label={`${t('teams.fields.interventionType')} *`} size="small">
                            {teamServiceCategories.map((cat) => (
                              <MenuItem key={cat.value} value={cat.value}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  {getCategoryIcon(cat.value, 18)}
                                  <Typography variant="body2">{cat.label}</Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                          {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                        </FormControl>
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Colonne droite : Aperçu catégorie ─── */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ p: 0 }}>
                {/* Mini banner gradient (style TeamCard) */}
                {selectedCategory && (
                  <Box
                    sx={{
                      position: 'relative',
                      height: 72,
                      background: selectedCategory.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden',
                      borderRadius: '8px 8px 0 0',
                    }}
                  >
                    {/* Dot pattern */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `radial-gradient(circle, ${selectedCategory.color} 1.5px, transparent 1.5px)`,
                        backgroundSize: '24px 24px',
                        opacity: 0.15,
                      }}
                    />
                    {/* Glow */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(ellipse at 30% 50%, ${selectedCategory.color}30 0%, transparent 70%)`,
                        opacity: 0.7,
                      }}
                    />
                    {/* Background icon */}
                    <Box sx={{ position: 'absolute', right: 12, bottom: 6, opacity: 1 }}>
                      {getCategoryIcon(selectedCategory.value, 40)}
                      <Box sx={{ position: 'absolute', inset: 0, color: 'rgba(255,255,255,0.18)' }}>
                        {getCategoryIcon(selectedCategory.value, 40)}
                      </Box>
                    </Box>
                    {/* Label */}
                    <Box sx={{ position: 'relative', px: 1.5, py: 1 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {selectedCategory.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.65rem', display: 'block', mt: 0.25 }}>
                        {selectedCategory.description}
                      </Typography>
                    </Box>
                  </Box>
                )}

                <Box sx={{ p: 1.5 }}>
                  {/* Rôles autorisés */}
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1, display: 'block' }}>
                    {t('teams.fields.authorizedRoles')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                    {availableRoles.map(role => (
                      <Chip
                        key={role.value}
                        label={role.label}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.68rem', fontWeight: 500, borderWidth: 1.5 }}
                      />
                    ))}
                  </Box>

                  <Divider sx={{ my: 1 }} />

                  {/* Compteur utilisateurs */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <GroupIcon sx={{ fontSize: 16, color: filteredUsers.length > 0 ? 'primary.main' : 'text.disabled' }} />
                    <Typography variant="caption" sx={{ fontSize: '0.72rem', color: filteredUsers.length > 0 ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>
                      {filteredUsers.length} {t('teams.fields.usersAvailable')}
                    </Typography>
                  </Box>
                  {filteredUsers.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, fontSize: '0.65rem' }}>
                      {t('teams.fields.noUserWithRoles')}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Zones de couverture ─── */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <MapIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    {t('teams.coverageZones')}
                    {zoneFields.length > 0 && (
                      <Chip
                        label={zoneFields.length}
                        size="small"
                        color="primary"
                        sx={{ ml: 0.5, height: 20, fontSize: '0.65rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                      />
                    )}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Add sx={{ fontSize: 16 }} />}
                    onClick={() => appendZone({ department: '', arrondissement: null })}
                    size="small"
                  >
                    {t('teams.addCoverageZone')}
                  </Button>
                </Box>

                {zoneFields.length === 0 ? (
                  <Box sx={{
                    textAlign: 'center',
                    py: 3,
                    border: '2px dashed',
                    borderColor: 'grey.200',
                    borderRadius: 1.5,
                    bgcolor: 'grey.50',
                  }}>
                    <MapIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                      {t('teams.noCoverageZones')}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {zoneFields.map((zoneField, index) => {
                      const watchedDept = watch(`coverageZones.${index}.department`);
                      const showArrondissement = watchedDept && hasArrondissements(watchedDept);
                      const arrondissements = showArrondissement ? getArrondissementsForDepartment(watchedDept) : [];

                      return (
                        <Box
                          key={zoneField.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 1.25,
                            border: '1px solid',
                            borderColor: 'grey.200',
                            borderRadius: 1.5,
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(107, 138, 154, 0.03)' },
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Controller
                              name={`coverageZones.${index}.department`}
                              control={control}
                              render={({ field: deptField, fieldState }) => (
                                <Autocomplete
                                  options={FRENCH_DEPARTMENTS}
                                  getOptionLabel={(opt) => `${opt.code} - ${opt.name}`}
                                  value={FRENCH_DEPARTMENTS.find(d => d.code === deptField.value) || null}
                                  onChange={(_, val) => {
                                    deptField.onChange(val?.code || '');
                                    // Reset arrondissement when department changes
                                    setValue(`coverageZones.${index}.arrondissement`, null);
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={`${t('teams.department')} *`}
                                      size="small"
                                      error={!!fieldState.error}
                                      helperText={fieldState.error?.message}
                                    />
                                  )}
                                  size="small"
                                />
                              )}
                            />
                          </Box>

                          {showArrondissement && (
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Controller
                                name={`coverageZones.${index}.arrondissement`}
                                control={control}
                                render={({ field: arrField }) => (
                                  <Autocomplete
                                    options={arrondissements}
                                    getOptionLabel={(opt) => opt.name}
                                    value={arrondissements.find(a => a.code === arrField.value) || null}
                                    onChange={(_, val) => arrField.onChange(val?.code || null)}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label={t('teams.arrondissement')}
                                        size="small"
                                        placeholder={t('teams.selectArrondissement')}
                                      />
                                    )}
                                    size="small"
                                  />
                                )}
                              />
                            </Box>
                          )}

                          <IconButton
                            onClick={() => removeZone(index)}
                            size="small"
                            sx={{ p: 0.5, color: 'grey.400', flexShrink: 0, '&:hover': { color: 'error.main', bgcolor: 'error.50' } }}
                          >
                            <DeleteOutlined sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Membres de l'équipe (pleine largeur) ─── */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('teams.sections.teamMembers')}
                    {fields.length > 0 && (
                      <Chip
                        label={fields.length}
                        size="small"
                        color="primary"
                        sx={{ ml: 1, height: 20, fontSize: '0.65rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                      />
                    )}
                  </Typography>
                  {filteredUsers.length > fields.length && (
                    <Button
                      variant="outlined"
                      startIcon={<Add sx={{ fontSize: 16 }} />}
                      onClick={handleAddMember}
                      size="small"
                    >
                      {t('teams.fields.addMember')}
                    </Button>
                  )}
                </Box>

                {fields.length === 0 ? (
                  <Box sx={{
                    textAlign: 'center',
                    py: 4,
                    border: '2px dashed',
                    borderColor: 'grey.200',
                    borderRadius: 1.5,
                    bgcolor: 'grey.50',
                  }}>
                    <GroupIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8125rem' }}>
                      {t('teams.fields.noMemberAdded')}
                    </Typography>
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
                ) : (
                  <Box>
                    {fields.map((field, index) => (
                      <Box
                        key={field.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.25,
                          mb: 1,
                          border: '1px solid',
                          borderColor: field.userId ? 'grey.200' : 'warning.light',
                          borderRadius: 1.5,
                          bgcolor: field.userId ? 'transparent' : 'rgba(255, 167, 38, 0.04)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'rgba(107, 138, 154, 0.03)',
                          },
                        }}
                      >
                        {/* Avatar */}
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.7rem',
                            bgcolor: field.userId ? 'primary.main' : 'grey.300',
                            flexShrink: 0,
                          }}
                        >
                          {field.firstName && field.lastName
                            ? `${field.firstName.charAt(0)}${field.lastName.charAt(0)}`
                            : <Person sx={{ fontSize: 18 }} />
                          }
                        </Avatar>

                        {/* User select */}
                        <Box sx={{ flex: 2, minWidth: 0 }}>
                          <Controller
                            name={`members.${index}.userId`}
                            control={control}
                            render={({ field: userIdField, fieldState }) => (
                              <Autocomplete
                                options={filteredUsers}
                                getOptionLabel={(user) => `${user.firstName} ${user.lastName}`}
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
                                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem', bgcolor: 'primary.main' }}>
                                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                                      </Avatar>
                                      <Box>
                                        <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{user.firstName} {user.lastName}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{user.email}</Typography>
                                      </Box>
                                    </Box>
                                  </li>
                                )}
                              />
                            )}
                          />
                        </Box>

                        {/* Role select */}
                        <Box sx={{ flex: 1, minWidth: 120 }}>
                          <Controller
                            name={`members.${index}.role`}
                            control={control}
                            render={({ field: roleField, fieldState }) => (
                              <FormControl fullWidth size="small" error={!!fieldState.error}>
                                <InputLabel>{t('teams.fields.roleInTeam')}</InputLabel>
                                <Select {...roleField} label={t('teams.fields.roleInTeam')}>
                                  {availableRoles.map((role) => (
                                    <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                                  ))}
                                </Select>
                                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                              </FormControl>
                            )}
                          />
                        </Box>

                        {/* Delete button */}
                        <IconButton
                          onClick={() => remove(index)}
                          size="small"
                          sx={{
                            p: 0.5,
                            color: 'grey.400',
                            flexShrink: 0,
                            '&:hover': { color: 'error.main', bgcolor: 'error.50' },
                          }}
                        >
                          <Delete sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Button type="submit" sx={{ display: 'none' }} data-submit-team>
          Soumettre
        </Button>
      </form>
    </Box>
  );
};

export default TeamForm;
