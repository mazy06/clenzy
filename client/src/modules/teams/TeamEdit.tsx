import ServiceCapabilitySelect from '../../components/ServiceCapabilitySelect';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { resolveMediaUrl } from '../../config/api';
import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, CircleCheck } from '../../icons/glyphs';
import { Spinner } from '../../components/ui';
import { Field, FieldLabel, Input, Textarea } from '../../components/ui';
import { Avatar, AvatarImage, AvatarFallback, Card, CardContent, NativeSelect, NativeSelectOption, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '../../components/ui/combobox';
import {
  Save,
  Cancel,
  AutoAwesome,
  Build,
  Category,
  Map as MapIcon,
  DeleteOutlined,
  Add,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi } from '../../services/api/teamsApi';
import { usersApi } from '../../services/api/usersApi';
import type { CoverageZone, TeamFormData as ApiTeamFormData } from '../../services/api/teamsApi';
import type { User } from '../../services/api/usersApi';
import { extractApiList } from '../../types';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { teamsKeys } from './useTeamsList';
import {
  FRENCH_DEPARTMENTS,
  hasArrondissements,
  getArrondissementsForDepartment,
} from '../../data/frenchDepartments';
import type { Arrondissement, Department } from '../../data/frenchDepartments';
import { COVERAGE_COUNTRIES, getCitiesForCountry } from '../../data/coverageCountries';
import type { CoverageCountry } from '../../data/coverageCountries';

interface TeamMember {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  /** URL ticketee de la photo de profil, servie par le backend. */
  avatarUrl?: string | null;
}

interface TeamFormData {
  name: string;
  description: string;
  interventionType: string;
  serviceItemCodes: string[];
  members: TeamMember[];
  coverageZones: CoverageZone[];
}

const teamServiceCategories = [
  { value: 'CLEANING', label: 'Nettoyage', icon: <AutoAwesome size={18} strokeWidth={1.75} /> },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: <Build size={18} strokeWidth={1.75} /> },
  { value: 'OTHER', label: 'Autre', icon: <Category size={18} strokeWidth={1.75} /> },
];

const roleOptions = [
  { value: 'HOUSEKEEPER', label: 'Agent de ménage' },
  { value: 'TECHNICIAN', label: 'Technicien' },
  { value: 'LAUNDRY', label: 'Blanchisserie' },
  { value: 'EXTERIOR_TECH', label: 'Tech. extérieur' },
  { value: 'SUPERVISOR', label: 'Superviseur' },
  { value: 'SUPER_MANAGER', label: 'Super Manager' },
  { value: 'MANAGER', label: 'Manager' },
];

const TeamEdit: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const queryClient = useQueryClient();

  // ─── Permissions (useEffect — NOT React Query) ──────────────────────────
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('teams:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ─── Form state ─────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    description: '',
    interventionType: 'OTHER',
    serviceItemCodes: [],
    members: [],
    coverageZones: [],
  });
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('HOUSEKEEPER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ─── Team + Users queries ───────────────────────────────────────────────
  const teamQuery = useQuery({
    queryKey: teamsKeys.detail(id ?? ''),
    queryFn: async () => {
      const data = await teamsApi.getById(Number(id));
      return data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  const usersQuery = useQuery({
    queryKey: ['edit-available-users'],
    queryFn: async () => {
      const data = await usersApi.getAll();
      return extractApiList<User>(data);
    },
    staleTime: 60_000,
  });

  // Populate form when team data loads
  useEffect(() => {
    if (teamQuery.data) {
      const teamData = teamQuery.data;
      setFormData({
        name: teamData.name || '',
        description: teamData.description || '',
        interventionType: teamData.interventionType || 'OTHER',
        serviceItemCodes: teamData.serviceItemCodes ?? [],
        members: (teamData.members || []).map(m => ({
          userId: m.userId ?? m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          role: m.roleInTeam ?? m.role,
          avatarUrl: m.avatarUrl,
        })),
        coverageZones: teamData.coverageZones?.map((z) => ({
          id: z.id,
          country: z.country || 'FR',
          department: z.department ?? null,
          arrondissement: z.arrondissement ?? null,
          city: z.city ?? null,
        })) || [],
      });
    }
  }, [teamQuery.data]);

  const availableUsers = usersQuery.data ?? [];
  // Utilisateurs proposables = ceux qui ne sont pas deja membres de l'equipe.
  const assignableUsers = availableUsers.filter(
    (user) => !(formData.members || []).some((m) => m.userId === user.id),
  );
  const loading = teamQuery.isLoading || usersQuery.isLoading;

  // ─── Update mutation ──────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: TeamFormData) => {
      const apiData: ApiTeamFormData = {
        name: data.name,
        description: data.description,
        interventionType: data.interventionType,
        serviceItemCodes: data.serviceItemCodes,
        members: data.members.map(m => ({ userId: m.userId, role: m.role })),
        coverageZones: data.coverageZones,
      };
      return teamsApi.update(Number(id), apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.all });
      setSuccess(true);
      setTimeout(() => {
        navigate(`/teams/${id}`);
      }, 1500);
    },
    onError: (err: Error) => {
      setError(getErrorMessage(err, 'Erreur lors de la mise à jour'));
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof TeamFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addMember = () => {
    if (!selectedUser || !selectedRole) return;
    const user = availableUsers?.find(u => u.id?.toString() === selectedUser);
    if (!user) return;
    if ((formData.members || []).some(m => m.userId === user.id)) {
      setError(t('teams.errors.alreadyMember'));
      return;
    }
    const newMember: TeamMember = {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: selectedRole,
    };
    setFormData(prev => ({ ...prev, members: [...prev.members, newMember] }));
    setSelectedUser('');
    setSelectedRole('HOUSEKEEPER');
    setError(null);
  };

  const removeMember = (userId: number) => {
    setFormData(prev => ({ ...prev, members: prev.members.filter(m => m.userId !== userId) }));
  };

  const updateMemberRole = (userId: number, newRole: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map(m => m.userId === userId ? { ...m, role: newRole } : m),
    }));
  };

  // ─── Coverage zones handlers ───────────────────────────────────────────
  const addCoverageZone = () => {
    setFormData(prev => ({
      ...prev,
      coverageZones: [...prev.coverageZones, { country: 'FR', department: '', arrondissement: null, city: null }],
    }));
  };

  const removeCoverageZone = (index: number) => {
    setFormData(prev => ({
      ...prev,
      coverageZones: prev.coverageZones.filter((_, i) => i !== index),
    }));
  };

  const updateCoverageZone = (index: number, field: keyof CoverageZone, value: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      coverageZones: prev.coverageZones.map((z, i) =>
        i === index ? { ...z, [field]: value } : z
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    updateMutation.mutate(formData);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-4">
        <BuiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription><h6 className="text-sm font-semibold mb-[0.35em]">{t('teams.edit.accessDenied')}</h6><p className="text-sm">{t('teams.edit.noPermission')}</p></AlertDescription>
        </BuiAlert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Modifier l'équipe"
        subtitle="Modifiez les détails de l'équipe"
        backPath={`/teams/${id}`}
        backLabel="Retour aux détails"
        showBackButton={true}
        actions={
          <div className="flex gap-1.5">
            <BuiButton
              variant="outline"
              size="sm"
              onClick={() => navigate(`/teams/${id}`)}
              disabled={updateMutation.isPending}
              title="Annuler"
            >
              <Cancel />
              {t('teams.cancel')}
            </BuiButton>
            <BuiButton
              type="submit"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={handleSubmit}
              title={t('teams.edit.update')}
            >
              <Save />
              {updateMutation.isPending ? t('teams.edit.updating') : t('teams.edit.update')}
            </BuiButton>
          </div>
        }
      />

      {error && (
        <BuiAlert variant="destructive" className="mb-4">
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
        <BuiAlert variant="success" className="mb-4">
          <CircleCheck />
          <AlertDescription>{t('teams.edit.updateSuccess')}</AlertDescription>
        </BuiAlert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <h6 className="text-sm font-semibold mb-4 text-foreground">
              {t('teams.edit.basicInfo')}
            </h6>

            <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-[18px] mb-6">
              <div className="min-[900px]:col-span-2">
                <Field>
                  <FieldLabel htmlFor="team-name">{t('teams.edit.nameRequired')}</FieldLabel>
                  <Input
                    id="team-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                    placeholder={t('teams.edit.namePlaceholder')}
                  />
                </Field>
              </div>
              <div>
                {/* Liste riche (une icone par categorie) : le Select du kit, pas
                    le select natif qui ne sait rendre que du texte. */}
                <ServiceCapabilitySelect value={formData.serviceItemCodes}
                  onChange={(codes) => setFormData(previous => ({ ...previous, serviceItemCodes: codes }))} />
              </div>
            </div>

            <h6 className="text-sm font-semibold mb-3 text-foreground">Description</h6>

            <div className="mb-6">
              <Field>
                <FieldLabel htmlFor="team-description">{t('teams.edit.descriptionLabel')}</FieldLabel>
                {/* min-h en `lh` : le primitif pose field-sizing:content, qui neutralise `rows`. */}
                <Textarea
                  id="team-description"
                  className="min-h-[4lh]"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder={t('teams.edit.descriptionPlaceholder')}
                />
              </Field>
            </div>

            {/* ─── Coverage Zones ─────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
              <h6 className="text-sm font-semibold text-foreground flex items-center gap-0.5">
                <MapIcon size={20} strokeWidth={1.75} />
                {t('teams.coverageZones')}
              </h6>
              {/* type="button" explicite : le Button du kit est un <button> natif, qui
                  soumettrait le <form> parent au clic (MUI posait type="button" seul). */}
              <BuiButton
                type="button"
                size="sm"
                variant="outline"
                onClick={addCoverageZone}
              >
                <Add />
                {t('teams.addCoverageZone')}
              </BuiButton>
            </div>

            {formData.coverageZones.length === 0 ? (
              <div className="mb-6">
                <EmptyState icon={<MapIcon />} title={t('teams.noCoverageZones')} />
              </div>
            ) : (
              <div className="mb-6">
                {formData.coverageZones.map((zone, index) => {
                  const countryDef = COVERAGE_COUNTRIES.find(c => c.code === (zone.country || 'FR')) ?? COVERAGE_COUNTRIES[0];
                  const isFr = countryDef.matchMode === 'department';
                  const deptObj = isFr ? FRENCH_DEPARTMENTS.find(d => d.code === zone.department) : null;
                  const showArr = isFr && !!zone.department && hasArrondissements(zone.department);
                  const arrOptions = showArr ? getArrondissementsForDepartment(zone.department || '') : [];
                  const cityOptions = !isFr ? getCitiesForCountry(countryDef.code) : [];

                  return (
                    // `items-end` et non `items-center` : chaque champ porte desormais
                    // son libelle au-dessus, la corbeille s'aligne donc sur le bas.
                    <div key={index} className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-3 mb-[9px] items-end">
                      <div className="min-[900px]:col-span-3">
                        <Field>
                          <FieldLabel htmlFor={`zone-country-${index}`}>{t('teams.country')}</FieldLabel>
                          <Combobox
                            items={COVERAGE_COUNTRIES}
                            itemToStringLabel={(opt: CoverageCountry) => opt.name}
                            itemToStringValue={(opt: CoverageCountry) => opt.name}
                            isItemEqualToValue={(a: CoverageCountry, b: CoverageCountry) => a.code === b.code}
                            value={countryDef}
                            onValueChange={(val: CoverageCountry | null) => {
                              updateCoverageZone(index, 'country', val?.code || 'FR');
                              updateCoverageZone(index, 'department', undefined);
                              updateCoverageZone(index, 'arrondissement', undefined);
                              updateCoverageZone(index, 'city', undefined);
                            }}
                          >
                            <ComboboxInput id={`zone-country-${index}`} placeholder={t('teams.edit.selectCountry')} />
                            <ComboboxContent>
                              <ComboboxEmpty>{t('teams.noCountryFound')}</ComboboxEmpty>
                              <ComboboxList>
                                {(option: CoverageCountry) => (
                                  <ComboboxItem key={option.code} value={option}>
                                    {option.name}
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        </Field>
                      </div>
                      {isFr ? (
                        <>
                          <div className={showArr ? 'min-[900px]:col-span-4' : 'min-[900px]:col-span-7'}>
                            <Field>
                              <FieldLabel htmlFor={`zone-department-${index}`}>{t('teams.department')}</FieldLabel>
                              <Combobox
                                items={FRENCH_DEPARTMENTS}
                                itemToStringLabel={(opt: Department) => `${opt.code} - ${opt.name}`}
                                itemToStringValue={(opt: Department) => `${opt.code} - ${opt.name}`}
                                isItemEqualToValue={(a: Department, b: Department) => a.code === b.code}
                                value={deptObj || null}
                                onValueChange={(val: Department | null) => {
                                  updateCoverageZone(index, 'department', val?.code || '');
                                  if (!val || !hasArrondissements(val.code)) {
                                    updateCoverageZone(index, 'arrondissement', undefined);
                                  }
                                }}
                              >
                                <ComboboxInput id={`zone-department-${index}`} placeholder={t('teams.selectDepartment')} />
                                <ComboboxContent>
                                  <ComboboxEmpty>{t('teams.noDepartmentFound')}</ComboboxEmpty>
                                  <ComboboxList>
                                    {(option: Department) => (
                                      <ComboboxItem key={option.code} value={option}>
                                        {option.code} - {option.name}
                                      </ComboboxItem>
                                    )}
                                  </ComboboxList>
                                </ComboboxContent>
                              </Combobox>
                            </Field>
                          </div>
                          {showArr && (
                            <div className="min-[900px]:col-span-4">
                              <Field>
                                <FieldLabel htmlFor={`zone-arrondissement-${index}`}>{t('teams.arrondissement')}</FieldLabel>
                                <Combobox
                                  items={arrOptions}
                                  itemToStringLabel={(opt: Arrondissement) => opt.name}
                                  itemToStringValue={(opt: Arrondissement) => opt.name}
                                  isItemEqualToValue={(a: Arrondissement, b: Arrondissement) => a.code === b.code}
                                  value={arrOptions.find(a => a.code === zone.arrondissement) || null}
                                  onValueChange={(val: Arrondissement | null) => {
                                    updateCoverageZone(index, 'arrondissement', val?.code || undefined);
                                  }}
                                >
                                  <ComboboxInput id={`zone-arrondissement-${index}`} placeholder={t('teams.allArrondissements')} />
                                  <ComboboxContent>
                                    <ComboboxEmpty>{t('teams.noArrondissementFound')}</ComboboxEmpty>
                                    <ComboboxList>
                                      {(option: Arrondissement) => (
                                        <ComboboxItem key={option.code} value={option}>
                                          {option.name}
                                        </ComboboxItem>
                                      )}
                                    </ComboboxList>
                                  </ComboboxContent>
                                </Combobox>
                              </Field>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="min-[900px]:col-span-7">
                          <Field>
                            <FieldLabel htmlFor={`zone-city-${index}`}>{t('teams.city')}</FieldLabel>
                            {/* Report du `freeSolo` : seule la SAISIE est controlee, il n'y a
                                pas de `value` d'item — une ville hors liste reste donc valide. */}
                            <Combobox
                              items={cityOptions}
                              inputValue={zone.city ?? ''}
                              onInputValueChange={(next: string) => {
                                updateCoverageZone(index, 'city', next || undefined);
                              }}
                              onValueChange={(val: string | null) => {
                                updateCoverageZone(index, 'city', val || undefined);
                              }}
                            >
                              <ComboboxInput id={`zone-city-${index}`} placeholder={t('teams.edit.cityPlaceholder')} />
                              <ComboboxContent>
                                <ComboboxEmpty>{t('teams.edit.noCitySuggested')}</ComboboxEmpty>
                                <ComboboxList>
                                  {(option: string) => (
                                    <ComboboxItem key={option} value={option}>
                                      {option}
                                    </ComboboxItem>
                                  )}
                                </ComboboxList>
                              </ComboboxContent>
                            </Combobox>
                          </Field>
                        </div>
                      )}
                      <div className="min-[900px]:col-span-2 flex items-center gap-1.5">
                        {isFr && deptObj && (
                          <Badge variant="secondary" className="text-[0.72rem]">{deptObj.code}</Badge>
                        )}
                        <BuiButton
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('teams.edit.removeZone')}
                          className="text-destructive"
                          onClick={() => removeCoverageZone(index)}
                        >
                          <DeleteOutlined size={18} strokeWidth={1.75} />
                        </BuiButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <h6 className="text-sm font-semibold mb-3 text-foreground">{t('teams.edit.membersTitle')}</h6>

            <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-3 mb-[18px] items-end">
              <div>
                <Field>
                  <FieldLabel htmlFor="team-add-user">{t('teams.edit.user')}</FieldLabel>
                  {/* Option vide desactivee : sans elle le select natif afficherait
                      le premier utilisateur alors que l'etat vaut encore ''. */}
                  <NativeSelect
                    id="team-add-user"
                    className="w-full"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <NativeSelectOption value="" disabled>
                      {t(assignableUsers.length > 0
                        ? 'teams.pickUser'
                        : 'teams.noUserAvailable')}
                    </NativeSelectOption>
                    {assignableUsers.map((user) => (
                      <NativeSelectOption key={user.id} value={user.id.toString()}>
                        {`${user.firstName} ${user.lastName} (${user.email})`}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div>
                <Field>
                  <FieldLabel htmlFor="team-add-role">{t('users.role')}</FieldLabel>
                  <NativeSelect
                    id="team-add-role"
                    className="w-full"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                  >
                    {roleOptions.map((role) => (
                      <NativeSelectOption key={role.value} value={role.value}>{role.label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div>
                <BuiButton
                  type="button"
                  variant="outline"
                  onClick={addMember}
                  disabled={!selectedUser || !selectedRole}
                >
                  Ajouter
                </BuiButton>
              </div>
            </div>

            {(formData.members || []).length > 0 && (
              <div className="mb-6">
                <h6 className="text-sm font-medium mb-3">
                  {t('teams.edit.currentMembers', { count: (formData.members || []).length })}
                </h6>
                <div className="flex flex-col gap-1.5">
                  {(formData.members || []).map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-2 border border-solid border-border rounded-lg px-2 py-1.5"
                    >
                      <Avatar className="rounded-[10px]">
                        {resolveMediaUrl(member.avatarUrl) ? (
                          <AvatarImage src={resolveMediaUrl(member.avatarUrl)} alt="" />
                        ) : null}
                        <AvatarFallback className="rounded-[10px] bg-primary text-primary-foreground font-[family-name:var(--font-display)] font-semibold">
                          {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p dir="auto" className="text-sm truncate">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <NativeSelect
                          size="sm"
                          aria-label={`Rôle de ${member.firstName} ${member.lastName}`}
                          className="min-w-[120px]"
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.userId, e.target.value)}
                        >
                          {roleOptions.map((role) => (
                            <NativeSelectOption key={role.value} value={role.value}>{role.label}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                        <BuiButton
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removeMember(member.userId)}
                        >
                          Retirer
                        </BuiButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamEdit;
