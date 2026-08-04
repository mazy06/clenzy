import React, { useState, useEffect } from 'react';
import { Badge, Button, Field, FieldLabel, FieldError, Input, Textarea } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  NativeSelect,
  NativeSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '../../components/ui';
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

/**
 * Option de Combobox. La forme `{ value, label }` est celle que Base UI sait
 * exploiter seul : il en deduit le libelle affiche et la valeur soumise, sans
 * qu'on ait a fournir `itemToStringLabel` / `itemToStringValue`.
 */
interface ComboOption {
  value: string;
  label: string;
}

const COUNTRY_OPTIONS: ComboOption[] = COVERAGE_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const DEPARTMENT_OPTIONS: ComboOption[] = FRENCH_DEPARTMENTS.map((d) => ({
  value: d.code,
  label: `${d.code} - ${d.name}`,
}));

// Les options sont reconstruites a chaque rendu pour les arrondissements : on
// compare donc sur la valeur, jamais sur l'identite de l'objet.
const sameOption = (a?: ComboOption | null, b?: ComboOption | null) => a?.value === b?.value;

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
            <Card className="[--card-spacing:12px]">
              <CardContent>
                <h6 className="cn-text-subtitle1 font-semibold mb-2">
                  {t('teams.sections.teamInfo')}
                </h6>

                <div className="grid grid-cols-12 gap-[9px]">
                  <div className="col-span-12">
                    <Controller
                      name="name"
                      control={control}
                      // Le `ref` de react-hook-form est ecarte : Input/Textarea du kit
                      // sont des composants fonction sans forwardRef (React 18 avertirait).
                      render={({ field: { ref: _nameRef, ...field }, fieldState }) => (
                        <Field>
                          <FieldLabel htmlFor="team-name">{`${t('teams.fields.teamName')} *`}</FieldLabel>
                          <Input
                            {...field}
                            id="team-name"
                            className="w-full"
                            placeholder={t('teams.fields.teamNamePlaceholder')}
                            aria-invalid={!!fieldState.error}
                          />
                          {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                        </Field>
                      )}
                    />
                  </div>

                  <div className="col-span-12">
                    <Controller
                      name="description"
                      control={control}
                      render={({ field: { ref: _descRef, ...field }, fieldState }) => (
                        <Field>
                          <FieldLabel htmlFor="team-description">{t('teams.fields.description')}</FieldLabel>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            id="team-description"
                            className="w-full"
                            rows={3}
                            placeholder={t('teams.fields.descriptionPlaceholder')}
                            aria-invalid={!!fieldState.error}
                          />
                          {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                        </Field>
                      )}
                    />
                  </div>

                  <div className="col-span-12">
                    <Controller
                      name="interventionType"
                      control={control}
                      // Liste riche (icone par categorie) -> Select du kit : une
                      // <option> native ne peut porter aucun balisage.
                      render={({ field, fieldState }) => (
                        <Field>
                          <FieldLabel htmlFor="team-intervention-type">{`${t('teams.fields.interventionType')} *`}</FieldLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger
                              id="team-intervention-type"
                              size="sm"
                              className="w-full"
                              aria-invalid={!!fieldState.error}
                              onBlur={field.onBlur}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {teamServiceCategories.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {getCategoryIcon(cat.value, 18)}
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                        </Field>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Colonne droite : Aperçu catégorie ─── */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <Card className="[--card-spacing:0px]">
              <CardContent>
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

                  <Separator className="my-1.5" />

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
            <Card className="[--card-spacing:12px]">
              <CardContent>
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
                      const arrondissementOptions: ComboOption[] = arrondissements.map((a) => ({ value: a.code, label: a.name }));
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
                                <Field>
                                  <FieldLabel htmlFor={`zone-country-${index}`}>{`${t('teams.country')} *`}</FieldLabel>
                                  <Combobox
                                    items={COUNTRY_OPTIONS}
                                    isItemEqualToValue={sameOption}
                                    value={COUNTRY_OPTIONS.find((c) => c.value === (countryField.value || 'FR')) ?? COUNTRY_OPTIONS[0]}
                                    onValueChange={(val: ComboOption | null | undefined) => {
                                      const newCode = val?.value || 'FR';
                                      countryField.onChange(newCode);
                                      // Quand on change de pays, on remet a zero les champs incompatibles.
                                      setValue(`coverageZones.${index}.department`, '');
                                      setValue(`coverageZones.${index}.arrondissement`, null);
                                      setValue(`coverageZones.${index}.city`, null);
                                    }}
                                  >
                                    <ComboboxInput id={`zone-country-${index}`} className="w-full" />
                                    <ComboboxContent>
                                      <ComboboxEmpty>{t('teams.noCountryFound', { defaultValue: 'Aucun pays' })}</ComboboxEmpty>
                                      <ComboboxList>
                                        {(country: ComboOption) => (
                                          <ComboboxItem key={country.value} value={country}>
                                            {country.label}
                                          </ComboboxItem>
                                        )}
                                      </ComboboxList>
                                    </ComboboxContent>
                                  </Combobox>
                                </Field>
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
                                    <Field>
                                      <FieldLabel htmlFor={`zone-department-${index}`}>{`${t('teams.department')} *`}</FieldLabel>
                                      <Combobox
                                        items={DEPARTMENT_OPTIONS}
                                        isItemEqualToValue={sameOption}
                                        value={DEPARTMENT_OPTIONS.find((d) => d.value === deptField.value) ?? null}
                                        onValueChange={(val: ComboOption | null | undefined) => {
                                          deptField.onChange(val?.value || '');
                                          setValue(`coverageZones.${index}.arrondissement`, null);
                                        }}
                                      >
                                        <ComboboxInput
                                          id={`zone-department-${index}`}
                                          className="w-full"
                                          aria-invalid={!!fieldState.error}
                                        />
                                        <ComboboxContent>
                                          <ComboboxEmpty>{t('teams.noDepartmentFound', { defaultValue: 'Aucun departement' })}</ComboboxEmpty>
                                          <ComboboxList>
                                            {(dept: ComboOption) => (
                                              <ComboboxItem key={dept.value} value={dept}>
                                                {dept.label}
                                              </ComboboxItem>
                                            )}
                                          </ComboboxList>
                                        </ComboboxContent>
                                      </Combobox>
                                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                  )}
                                />
                              </div>

                              {showArrondissement && (
                                <div className="flex-1 min-w-0">
                                  <Controller
                                    name={`coverageZones.${index}.arrondissement`}
                                    control={control}
                                    render={({ field: arrField }) => (
                                      <Field>
                                        <FieldLabel htmlFor={`zone-arrondissement-${index}`}>{t('teams.arrondissement')}</FieldLabel>
                                        <Combobox
                                          items={arrondissementOptions}
                                          isItemEqualToValue={sameOption}
                                          value={arrondissementOptions.find((a) => a.value === arrField.value) ?? null}
                                          onValueChange={(val: ComboOption | null | undefined) => arrField.onChange(val?.value || null)}
                                        >
                                          <ComboboxInput
                                            id={`zone-arrondissement-${index}`}
                                            className="w-full"
                                            placeholder={t('teams.selectArrondissement')}
                                          />
                                          <ComboboxContent>
                                            <ComboboxEmpty>{t('teams.noArrondissementFound', { defaultValue: 'Aucun arrondissement' })}</ComboboxEmpty>
                                            <ComboboxList>
                                              {(arr: ComboOption) => (
                                                <ComboboxItem key={arr.value} value={arr}>
                                                  {arr.label}
                                                </ComboboxItem>
                                              )}
                                            </ComboboxList>
                                          </ComboboxContent>
                                        </Combobox>
                                      </Field>
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
                                render={({ field: cityField, fieldState }) => {
                                  // Saisie libre : la ville tapee est ajoutee aux propositions et
                                  // devient la valeur selectionnee. Sans cela, la fermeture du
                                  // popup remettrait le champ au libelle de la valeur courante et
                                  // effacerait silencieusement une ville hors liste.
                                  const rawCity = cityField.value ?? '';
                                  const typedCity = rawCity.trim();
                                  const cityItems = typedCity && !cityOptions.includes(typedCity)
                                    ? [typedCity, ...cityOptions]
                                    : cityOptions;
                                  return (
                                    <Field>
                                      <FieldLabel htmlFor={`zone-city-${index}`}>{`${t('teams.city')} *`}</FieldLabel>
                                      <Combobox
                                        items={cityItems}
                                        value={rawCity || null}
                                        onValueChange={(val: string | null) => cityField.onChange(val || null)}
                                        inputValue={rawCity}
                                        onInputValueChange={(val: string) => cityField.onChange(val || null)}
                                      >
                                        <ComboboxInput
                                          id={`zone-city-${index}`}
                                          className="w-full"
                                          aria-invalid={!!fieldState.error}
                                        />
                                        <ComboboxContent>
                                          <ComboboxEmpty>{t('teams.noCityFound', { defaultValue: 'Aucune ville' })}</ComboboxEmpty>
                                          <ComboboxList>
                                            {(city: string) => (
                                              <ComboboxItem key={city} value={city}>
                                                {city}
                                              </ComboboxItem>
                                            )}
                                          </ComboboxList>
                                        </ComboboxContent>
                                      </Combobox>
                                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                  );
                                }}
                              />
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('teams.removeCoverageZone', { defaultValue: 'Supprimer la zone' })}
                            onClick={() => removeZone(index)}
                            className="shrink-0 text-[var(--faint)] hover:bg-[var(--err-soft)] hover:text-[var(--err)]"
                          >
                            <DeleteOutlined size={18} strokeWidth={1.75} />
                          </Button>
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
            <Card className="[--card-spacing:12px]">
              <CardContent>
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
                        <Avatar className="size-8 shrink-0 rounded-[10px] after:rounded-[10px]">
                          <AvatarFallback
                            className={cn(
                              'rounded-[10px] font-[family-name:var(--font-display)] text-[0.7rem] font-semibold text-[var(--on-accent)]',
                              field.userId ? 'bg-[var(--accent)]' : 'bg-[var(--faint)]',
                            )}
                          >
                            {field.firstName && field.lastName
                              ? `${field.firstName.charAt(0)}${field.lastName.charAt(0)}`
                              : <Person size={18} strokeWidth={1.75} />
                            }
                          </AvatarFallback>
                        </Avatar>

                        {/* User select */}
                        <div className="flex-[2] min-w-0">
                          <Controller
                            name={`members.${index}.userId`}
                            control={control}
                            render={({ field: userIdField, fieldState }) => (
                              <Field>
                                <FieldLabel htmlFor={`member-user-${index}`}>{`${t('teams.fields.selectUser')} *`}</FieldLabel>
                                <Combobox
                                  items={filteredUsers}
                                  itemToStringLabel={(user: User) => `${user.firstName} ${user.lastName}`}
                                  itemToStringValue={(user: User) => String(user.id)}
                                  isItemEqualToValue={(a?: User | null, b?: User | null) => a?.id === b?.id}
                                  value={filteredUsers.find((u) => u.id === userIdField.value) ?? null}
                                  onValueChange={(user: User | null) => handleUserSelection(index, user)}
                                >
                                  <ComboboxInput
                                    id={`member-user-${index}`}
                                    className="w-full"
                                    aria-invalid={!!fieldState.error}
                                  />
                                  <ComboboxContent>
                                    <ComboboxEmpty>{t('teams.fields.noUserAvailable')}</ComboboxEmpty>
                                    <ComboboxList>
                                      {(user: User) => (
                                        <ComboboxItem key={user.id} value={user}>
                                          <div className="flex items-center gap-1">
                                            <Avatar className="size-6 shrink-0 rounded-[8px] after:rounded-[8px]">
                                              <AvatarFallback className="rounded-[8px] bg-[var(--accent)] font-[family-name:var(--font-display)] text-[0.6rem] font-semibold text-[var(--on-accent)]">
                                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div>
                                              <p className="cn-text-body2 text-[0.8125rem]">{user.firstName} {user.lastName}</p>
                                              <span className="cn-text-caption text-muted-foreground text-[0.65rem]">{user.email}</span>
                                            </div>
                                          </div>
                                        </ComboboxItem>
                                      )}
                                    </ComboboxList>
                                  </ComboboxContent>
                                </Combobox>
                                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                              </Field>
                            )}
                          />
                        </div>

                        {/* Role select */}
                        <div className="flex-1 min-w-[120px]">
                          <Controller
                            name={`members.${index}.role`}
                            control={control}
                            // Le `ref` de react-hook-form est ecarte : NativeSelect du
                            // kit est un composant fonction sans forwardRef (React 18).
                            render={({ field: { ref: _roleRef, ...roleField }, fieldState }) => (
                              <Field>
                                <FieldLabel htmlFor={`member-role-${index}`}>{t('teams.fields.roleInTeam')}</FieldLabel>
                                <NativeSelect
                                  {...roleField}
                                  id={`member-role-${index}`}
                                  className="w-full"
                                  value={roleField.value ?? ''}
                                  aria-invalid={!!fieldState.error}
                                >
                                  {availableRoles.map((role) => (
                                    <NativeSelectOption key={role.value} value={role.value}>{role.label}</NativeSelectOption>
                                  ))}
                                </NativeSelect>
                                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                              </Field>
                            )}
                          />
                        </div>

                        {/* Delete button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('teams.fields.removeMember', { defaultValue: 'Retirer le membre' })}
                          onClick={() => remove(index)}
                          className="shrink-0 text-[var(--faint)] hover:bg-[var(--err-soft)] hover:text-[var(--err)]"
                        >
                          <Delete size={18} strokeWidth={1.75} />
                        </Button>
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
