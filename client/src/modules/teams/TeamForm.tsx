import React, { useState, useEffect } from 'react';
import { Badge, Button } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card, CardContent, TextField, FormControl, InputLabel, Select, MenuItem, IconButton, Autocomplete, Avatar, FormHelperText, Divider } from '@mui/material';
import StatusChip from '../../components/StatusChip';
import { cn } from '../../utils/cn';
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
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi } from '../../services/api/teamsApi';
import { usersApi } from '../../services/api/usersApi';
import type { TeamFormData as ApiTeamFormData } from '../../services/api/teamsApi';
import { extractApiList } from '../../types';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { teamSchema, type TeamFormValues, type TeamFormInput } from '../../schemas/teamSchema';
import { teamsKeys } from './useTeamsList';
import { FRENCH_DEPARTMENTS, getArrondissementsForDepartment, hasArrondissements } from '../../data/frenchDepartments';
import { COVERAGE_COUNTRIES, getCitiesForCountry } from '../../data/coverageCountries';

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
  { value: 'CLEANING', label: 'Nettoyage', description: 'Nettoyage, entretien ménager, désinfection', roles: ['HOUSEKEEPER', 'LAUNDRY', 'SUPERVISOR'], color: '#7BA3C2' },
  { value: 'MAINTENANCE', label: 'Maintenance', description: 'Réparations, maintenance préventive, travaux', roles: ['TECHNICIAN', 'EXTERIOR_TECH', 'SUPERVISOR'], color: '#D4A574' },
  { value: 'OTHER', label: 'Autre', description: 'Services divers, jardinage, remise en état', roles: ['HOUSEKEEPER', 'TECHNICIAN', 'LAUNDRY', 'EXTERIOR_TECH', 'SUPERVISOR', 'SUPER_MANAGER'], color: '#6B8A9A' },
];

const getCategoryIcon = (value: string, size: number = 20) => {
  const iconProps = { size, strokeWidth: 1.75 };
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
      return extractApiList<User>(data);
    },
    staleTime: 60_000,
  });

  const users: User[] = usersQuery.data ?? [];
  const loadingUsers = usersQuery.isLoading;

  // ─── Create mutation ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: ApiTeamFormData) => teamsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.all });
      setSuccess(true);
      setTimeout(() => {
        navigate('/teams');
      }, 1500);
    },
    onError: (err: Error) => {
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
      <div className="p-3">
        <Alert variant="destructive" className="py-1.5">
          <TriangleAlert />
          <AlertDescription>{t('teams.errors.noPermission')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Filtrer les utilisateurs selon la catégorie de service sélectionnée
  const getFilteredUsers = () => {
    const selectedCategory = teamServiceCategories.find(cat => cat.value === watchedInterventionType);
    if (!selectedCategory) return users;
    const roleSet = new Set(selectedCategory.roles);
    return users.filter(user => roleSet.has(user.role?.toUpperCase()));
  };

  // Rôles disponibles dans l'équipe (en MAJUSCULES pour matcher le backend)
  const teamRoles = [
    { value: 'HOUSEKEEPER', label: t('teams.roles.housekeeper') },
    { value: 'TECHNICIAN', label: t('teams.roles.technician') },
    { value: 'LAUNDRY', label: t('teams.roles.laundry', { defaultValue: 'Blanchisserie' }) },
    { value: 'EXTERIOR_TECH', label: t('teams.roles.exteriorTech', { defaultValue: 'Tech. extérieur' }) },
    { value: 'SUPERVISOR', label: t('teams.roles.supervisor') },
    { value: 'SUPER_MANAGER', label: t('teams.roles.superManager', { defaultValue: 'Super Manager' }) },
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
        country: zone.country || 'FR',
        department: zone.department || undefined,
        arrondissement: zone.arrondissement || undefined,
        city: zone.city || undefined,
      })),
    };
    createMutation.mutate(backendData);
  };

  if (loadingUsers) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();
  const availableRoles = getAvailableRoles();
  const selectedCategory = teamServiceCategories.find(cat => cat.value === watchedInterventionType);

  return (
    <div>
      <PageHeader
        title={t('teams.createTitle')}
        subtitle={t('teams.createSubtitle')}
        backPath="/teams"
        backLabel={t('teams.backToList')}
        showBackButton={true}
        actions={
          <div className="flex gap-1.5">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const submitButton = document.querySelector('[data-submit-team]') as HTMLButtonElement;
                if (submitButton) submitButton.click();
              }}
              disabled={createMutation.isPending || filteredUsers.length === 0}
              title={t('teams.createTeam')}
            >
              {createMutation.isPending ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
              {createMutation.isPending ? t('teams.creating') : t('teams.createTeam')}
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-3 py-1.5">
          <CircleCheck />
          <AlertDescription>{t('teams.createSuccess')}</AlertDescription>
        </Alert>
      )}

      {(errors.members?.root?.message || errors.members?.message) && (
        <Alert variant="destructive" className="mb-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{errors.members?.root?.message || errors.members?.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-12 gap-3">

          {/* ─── Colonne gauche : Informations de l'équipe ─── */}
          <div className="col-span-12 min-[900px]:col-span-8">
            <Card>
              <CardContent sx={{ p: 2 }}>
                <h6 className="cn-text-subtitle1 font-semibold mb-2">
                  {t('teams.sections.teamInfo')}
                </h6>

                <div className="grid grid-cols-12 gap-[9px]">
                  <div className="col-span-12">
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
                  </div>

                  <div className="col-span-12">
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
                  </div>

                  <div className="col-span-12">
                    <Controller
                      name="interventionType"
                      control={control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth error={!!fieldState.error}>
                          <InputLabel>{t('teams.fields.interventionType')} *</InputLabel>
                          <Select {...field} label={`${t('teams.fields.interventionType')} *`} size="small">
                            {teamServiceCategories.map((cat) => (
                              <MenuItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-1">
                                  {getCategoryIcon(cat.value, 18)}
                                  <p className="cn-text-body2">{cat.label}</p>
                                </div>
                              </MenuItem>
                            ))}
                          </Select>
                          {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                        </FormControl>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Colonne droite : Aperçu catégorie ─── */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <Card>
              <CardContent sx={{ p: 0 }}>
                {/* Bandeau catégorie : panneau plat -soft (badge icône + libellés) */}
                {selectedCategory && (
                  <div className="flex items-center gap-[7.5px] px-[9px] py-[7.5px]" style={{ backgroundColor: `${selectedCategory.color}18`, borderBottom: '1px solid var(--line)' }}>
                    <div className="w-[36px] h-[36px] rounded-[10px] inline-flex items-center justify-center bg-[var(--card)] shrink-0" style={{ color: selectedCategory.color }}>
                      {getCategoryIcon(selectedCategory.value, 20)}
                    </div>
                    <div className="min-w-0">
                      <span className="cn-text-caption text-[var(--ink)] font-bold text-[0.75rem] tracking-[0.5px] uppercase block">
                        {selectedCategory.label}
                      </span>
                      <span className="cn-text-caption text-[var(--muted)] text-[0.65rem] block mt-0.5">
                        {selectedCategory.description}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-2">
                  {/* Rôles autorisés */}
                  <span className="cn-text-caption text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)] mb-1.5 block">
                    {t('teams.fields.authorizedRoles')}
                  </span>
                  <div className="flex gap-0.5 flex-wrap mb-2">
                    {availableRoles.map(role => (
                      <StatusChip key={role.value} label={role.label} tone="neutral" />
                    ))}
                  </div>

                  <Divider sx={{ my: 1 }} />

                  {/* Compteur utilisateurs */}
                  <div className="flex items-center gap-1">
                    <span className={cn('inline-flex', filteredUsers.length > 0 ? 'text-[var(--accent)]' : 'text-[var(--faint)]')}><GroupIcon size={16} strokeWidth={1.75} /></span>
                    <span className={cn('cn-text-caption text-[0.72rem] font-medium', filteredUsers.length > 0 ? 'text-[var(--ink)]' : 'text-[var(--faint)]')}>
                      {filteredUsers.length} {t('teams.fields.usersAvailable')}
                    </span>
                  </div>
                  {filteredUsers.length === 0 && (
                    <span className="cn-text-caption text-destructive block mt-0.5 text-[0.65rem]">
                      {t('teams.fields.noUserWithRoles')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Zones de couverture ─── */}
          <div className="col-span-12">
            <Card>
              <CardContent sx={{ p: 2 }}>
                <div className="flex items-center justify-between mb-2">
                  <h6 className="cn-text-subtitle1 font-semibold flex items-center gap-1">
                    <span className="inline-flex text-[var(--accent)]"><MapIcon size={18} strokeWidth={1.75} /></span>
                    {t('teams.coverageZones')}
                    {zoneFields.length > 0 && (
                      <Badge variant="secondary" className="ms-0.5 h-[20px] text-[0.65rem] font-bold text-[var(--accent)] bg-[var(--accent-soft)] tabular-nums px-1">{zoneFields.length}</Badge>
                    )}
                  </h6>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => appendZone({ country: 'FR', department: '', arrondissement: null, city: null })}
                  >
                    <Add size={16} strokeWidth={1.75} />
                    {t('teams.addCoverageZone')}
                  </Button>
                </div>

                {zoneFields.length === 0 ? (
                  <div className="text-center py-[18px] border border-dashed border-[var(--line-2)] rounded-[12px] bg-[var(--field)]">
                    <span className="inline-flex text-muted-foreground opacity-60 mb-0.5"><MapIcon size={32} strokeWidth={1.75} /></span>
                    <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
                      {t('teams.noCoverageZones')}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {zoneFields.map((zoneField, index) => {
                      const watchedCountry = watch(`coverageZones.${index}.country`) || 'FR';
                      const countryDef = COVERAGE_COUNTRIES.find(c => c.code === watchedCountry) ?? COVERAGE_COUNTRIES[0];
                      const isFr = countryDef.matchMode === 'department';
                      const watchedDept = watch(`coverageZones.${index}.department`);
                      const showArrondissement = isFr && !!watchedDept && hasArrondissements(watchedDept);
                      const arrondissements = showArrondissement ? getArrondissementsForDepartment(watchedDept) : [];
                      const cityOptions = !isFr ? getCitiesForCountry(countryDef.code) : [];

                      return (
                        <div
                          key={zoneField.id}
                          className="flex items-center gap-[9px] p-[7.5px] border border-solid border-[var(--line)] rounded-[12px] transition-[border-color,background-color] duration-200 ease-[ease] motion-reduce:transition-none hover:border-[var(--line-2)] hover:bg-[var(--hover)]"
                        >
                          <div className="flex-[0_0_180px] min-w-0">
                            <Controller
                              name={`coverageZones.${index}.country`}
                              control={control}
                              render={({ field: countryField }) => (
                                <Autocomplete
                                  options={COVERAGE_COUNTRIES}
                                  getOptionLabel={(opt) => opt.name}
                                  value={COVERAGE_COUNTRIES.find(c => c.code === (countryField.value || 'FR')) ?? COVERAGE_COUNTRIES[0]}
                                  onChange={(_, val) => {
                                    const newCode = val?.code || 'FR';
                                    countryField.onChange(newCode);
                                    // Quand on change de pays, on remet a zero les champs incompatibles.
                                    setValue(`coverageZones.${index}.department`, '');
                                    setValue(`coverageZones.${index}.arrondissement`, null);
                                    setValue(`coverageZones.${index}.city`, null);
                                  }}
                                  disableClearable
                                  renderInput={(params) => (
                                    <TextField {...params} label={`${t('teams.country')} *`} size="small" />
                                  )}
                                  size="small"
                                />
                              )}
                            />
                          </div>

                          {isFr ? (
                            <>
                              <div className="flex-1 min-w-0">
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
                              </div>

                              {showArrondissement && (
                                <div className="flex-1 min-w-0">
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
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <Controller
                                name={`coverageZones.${index}.city`}
                                control={control}
                                render={({ field: cityField, fieldState }) => (
                                  <Autocomplete
                                    options={cityOptions}
                                    freeSolo
                                    value={cityField.value || ''}
                                    onChange={(_, val) => cityField.onChange(typeof val === 'string' ? val : (val ?? null))}
                                    onInputChange={(_, val) => cityField.onChange(val || null)}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label={`${t('teams.city')} *`}
                                        size="small"
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                      />
                                    )}
                                    size="small"
                                  />
                                )}
                              />
                            </div>
                          )}

                          <IconButton
                            onClick={() => removeZone(index)}
                            size="small"
                            sx={{ p: 0.5, color: 'var(--faint)', flexShrink: 0, '&:hover': { color: 'var(--err)', bgcolor: 'var(--err-soft)' } }}
                          >
                            <DeleteOutlined size={18} strokeWidth={1.75} />
                          </IconButton>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Membres de l'équipe (pleine largeur) ─── */}
          <div className="col-span-12">
            <Card>
              <CardContent sx={{ p: 2 }}>
                <div className="flex items-center justify-between mb-2">
                  <h6 className="cn-text-subtitle1 font-semibold">
                    {t('teams.sections.teamMembers')}
                    {fields.length > 0 && (
                      <Badge variant="secondary" className="ms-1.5 h-[20px] text-[0.65rem] font-bold text-[var(--accent)] bg-[var(--accent-soft)] tabular-nums px-1">{fields.length}</Badge>
                    )}
                  </h6>
                  {filteredUsers.length > fields.length && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddMember}
                    >
                      <Add size={16} strokeWidth={1.75} />
                      {t('teams.fields.addMember')}
                    </Button>
                  )}
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-[var(--line-2)] rounded-[12px] bg-[var(--field)]">
                    <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><GroupIcon size={36} strokeWidth={1.75} /></span>
                    <p className="cn-text-body2 text-muted-foreground mb-2 text-[0.8125rem]">
                      {t('teams.fields.noMemberAdded')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddMember}
                      disabled={filteredUsers.length === 0}
                    >
                      <Add size={16} strokeWidth={1.75} />
                      {filteredUsers.length === 0 ? t('teams.fields.noUserAvailable') : t('teams.fields.addFirstMember')}
                    </Button>
                  </div>
                ) : (
                  <div>
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className={cn(
                          'flex items-center gap-[9px] p-[7.5px] mb-1.5 border border-solid rounded-[12px]',
                          'transition-[border-color,background-color] duration-200 ease-[ease] motion-reduce:transition-none',
                          'hover:border-[var(--line-2)] hover:bg-[var(--hover)]',
                          field.userId ? 'border-[var(--line)] bg-transparent' : 'border-[var(--warn)] bg-[var(--warn-soft)]',
                        )}
                      >
                        {/* Avatar */}
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            color: 'var(--on-accent)',
                            bgcolor: field.userId ? 'var(--accent)' : 'var(--faint)',
                            flexShrink: 0,
                          }}
                        >
                          {field.firstName && field.lastName
                            ? `${field.firstName.charAt(0)}${field.lastName.charAt(0)}`
                            : <Person size={18} strokeWidth={1.75} />
                          }
                        </Avatar>

                        {/* User select */}
                        <div className="flex-[2] min-w-0">
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
                                    <div className="flex items-center gap-1">
                                      <Avatar sx={{ width: 24, height: 24, borderRadius: '8px', fontSize: '0.6rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--on-accent)', bgcolor: 'var(--accent)' }}>
                                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                                      </Avatar>
                                      <div>
                                        <p className="cn-text-body2 text-[0.8125rem]">{user.firstName} {user.lastName}</p>
                                        <span className="cn-text-caption text-muted-foreground text-[0.65rem]">{user.email}</span>
                                      </div>
                                    </div>
                                  </li>
                                )}
                              />
                            )}
                          />
                        </div>

                        {/* Role select */}
                        <div className="flex-1 min-w-[120px]">
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
                        </div>

                        {/* Delete button */}
                        <IconButton
                          onClick={() => remove(index)}
                          size="small"
                          sx={{
                            p: 0.5,
                            color: 'var(--faint)',
                            flexShrink: 0,
                            '&:hover': { color: 'var(--err)', bgcolor: 'var(--err-soft)' },
                          }}
                        >
                          <Delete size={18} strokeWidth={1.75} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Relais de soumission cible par `[data-submit-team]` depuis le PageHeader :
            jamais visible, d'ou l'absence de variante utile (hidden). */}
        <Button type="submit" className="hidden" data-submit-team>
          Soumettre
        </Button>
      </form>
    </div>
  );
};

export default TeamForm;
