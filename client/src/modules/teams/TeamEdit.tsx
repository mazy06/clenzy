import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Field, FieldLabel, Input, Textarea } from '../../components/ui';
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
} from '../../components/ui';
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
}

interface TeamFormData {
  name: string;
  description: string;
  interventionType: string;
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
    interventionType: 'CLEANING',
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
        interventionType: teamData.interventionType || 'CLEANING',
        members: (teamData.members || []).map(m => ({
          userId: m.userId ?? m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          role: m.roleInTeam ?? m.role,
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
      setError(err?.message || 'Erreur lors de la mise à jour');
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
      setError('Cet utilisateur est déjà dans l\'équipe');
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
          <AlertDescription><h6 className="cn-text-h6 mb-[0.35em]">Accès non autorisé</h6><p className="cn-text-body1">Vous n'avez pas les permissions nécessaires pour modifier des équipes.</p></AlertDescription>
        </BuiAlert>
      </div>
    );
  }

  return (
    <div className="p-4">
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
              Annuler
            </BuiButton>
            <BuiButton
              type="submit"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={handleSubmit}
              title="Mettre à jour"
            >
              <Save />
              {updateMutation.isPending ? 'Mise à jour...' : 'Mettre à jour'}
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
          <AlertDescription>Équipe mise à jour avec succès ! Redirection en cours...</AlertDescription>
        </BuiAlert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <h6 className="cn-text-h6 mb-4 text-[var(--ink)]">
              Informations de base
            </h6>

            <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-[18px] mb-6">
              <div className="min-[900px]:col-span-2">
                <Field>
                  <FieldLabel htmlFor="team-name">Nom de l'équipe *</FieldLabel>
                  <Input
                    id="team-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                    placeholder="Ex: Équipe Nettoyage Premium"
                  />
                </Field>
              </div>
              <div>
                {/* Liste riche (une icone par categorie) : le Select du kit, pas
                    le select natif qui ne sait rendre que du texte. */}
                <Field>
                  <FieldLabel htmlFor="team-intervention-type">Type de service *</FieldLabel>
                  <Select
                    value={formData.interventionType}
                    onValueChange={(value) => handleInputChange('interventionType', value)}
                  >
                    <SelectTrigger id="team-intervention-type" className="w-full">
                      <SelectValue placeholder="Choisir un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamServiceCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="flex items-center gap-1">
                            {cat.icon}
                            {cat.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <h6 className="cn-text-h6 mb-3 text-[var(--ink)]">Description</h6>

            <div className="mb-6">
              <Field>
                <FieldLabel htmlFor="team-description">Description de l'équipe</FieldLabel>
                {/* min-h en `lh` : le primitif pose field-sizing:content, qui neutralise `rows`. */}
                <Textarea
                  id="team-description"
                  className="min-h-[4lh]"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Décrivez votre équipe..."
                />
              </Field>
            </div>

            {/* ─── Coverage Zones ─────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
              <h6 className="cn-text-h6 text-[var(--ink)] flex items-center gap-0.5">
                <MapIcon size={20} strokeWidth={1.75} />
                Zones de couverture
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
                Ajouter une zone
              </BuiButton>
            </div>

            {formData.coverageZones.length === 0 ? (
              <div className="text-center py-[18px] mb-6 border border-dashed border-[var(--line)] rounded-[16px]">
                <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><MapIcon size={32} strokeWidth={1.75} /></span>
                <p className="cn-text-body2 text-muted-foreground">
                  Aucune zone de couverture definie
                </p>
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
                          <FieldLabel htmlFor={`zone-country-${index}`}>Pays</FieldLabel>
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
                            <ComboboxInput id={`zone-country-${index}`} placeholder="Selectionner un pays" />
                            <ComboboxContent>
                              <ComboboxEmpty>Aucun pays</ComboboxEmpty>
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
                              <FieldLabel htmlFor={`zone-department-${index}`}>Departement</FieldLabel>
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
                                <ComboboxInput id={`zone-department-${index}`} placeholder="Selectionner un departement" />
                                <ComboboxContent>
                                  <ComboboxEmpty>Aucun departement</ComboboxEmpty>
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
                                <FieldLabel htmlFor={`zone-arrondissement-${index}`}>Arrondissement</FieldLabel>
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
                                  <ComboboxInput id={`zone-arrondissement-${index}`} placeholder="Tous les arrondissements" />
                                  <ComboboxContent>
                                    <ComboboxEmpty>Aucun arrondissement</ComboboxEmpty>
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
                            <FieldLabel htmlFor={`zone-city-${index}`}>Ville</FieldLabel>
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
                              <ComboboxInput id={`zone-city-${index}`} placeholder="Saisir ou selectionner une ville" />
                              <ComboboxContent>
                                <ComboboxEmpty>Aucune ville proposee</ComboboxEmpty>
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
                          aria-label="Supprimer cette zone de couverture"
                          className="text-[var(--err)]"
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

            <h6 className="cn-text-h6 mb-3 text-[var(--ink)]">Membres de l'équipe</h6>

            <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-3 mb-[18px] items-end">
              <div>
                <Field>
                  <FieldLabel htmlFor="team-add-user">Utilisateur</FieldLabel>
                  {/* Option vide desactivee : sans elle le select natif afficherait
                      le premier utilisateur alors que l'etat vaut encore ''. */}
                  <NativeSelect
                    id="team-add-user"
                    className="w-full"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <NativeSelectOption value="" disabled>
                      {assignableUsers.length > 0 ? 'Choisir un utilisateur' : 'Aucun utilisateur disponible'}
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
                  <FieldLabel htmlFor="team-add-role">Rôle</FieldLabel>
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
                <h6 className="cn-text-subtitle1 mb-3">
                  Membres actuels ({(formData.members || []).length})
                </h6>
                <div className="flex flex-col gap-1.5">
                  {(formData.members || []).map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-2 border border-solid border-[var(--line)] rounded-[8px] px-2 py-1.5"
                    >
                      <Avatar className="rounded-[10px]">
                        <AvatarFallback className="rounded-[10px] bg-[var(--accent)] text-[var(--on-accent)] font-[family-name:var(--font-display)] font-semibold">
                          {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="cn-text-body1 truncate">{member.firstName} {member.lastName}</p>
                        <p className="cn-text-body2 text-muted-foreground truncate">{member.email}</p>
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
