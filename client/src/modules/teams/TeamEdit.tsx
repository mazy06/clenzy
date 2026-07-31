import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Box, Card, CardContent, Grid, TextField, Button, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemAvatar, ListItemText, Avatar } from '@mui/material';
import {
  Autocomplete,
  IconButton,
  Chip,
} from '@mui/material';
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
import { COVERAGE_COUNTRIES, getCitiesForCountry } from '../../data/coverageCountries';

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
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(`/teams/${id}`)}
              startIcon={<Cancel />}
              disabled={updateMutation.isPending}
              title="Annuler"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="small"
              startIcon={<Save />}
              disabled={updateMutation.isPending}
              onClick={handleSubmit}
              title="Mettre à jour"
            >
              {updateMutation.isPending ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
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
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <h6 className="cn-text-h6 mb-4 text-[var(--ink)]">
              Informations de base
            </h6>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Nom de l'équipe *"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  placeholder="Ex: Équipe Nettoyage Premium"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Type de service *</InputLabel>
                  <Select
                    value={formData.interventionType}
                    onChange={(e) => handleInputChange('interventionType', e.target.value)}
                    label="Type de service *"
                  >
                    {teamServiceCategories.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-1">
                          {cat.icon}
                          <p className="cn-text-body2">{cat.label}</p>
                        </div>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <h6 className="cn-text-h6 mb-3 text-[var(--ink)]">Description</h6>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description de l'équipe"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Décrivez votre équipe..."
                />
              </Grid>
            </Grid>

            {/* ─── Coverage Zones ─────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
              <h6 className="cn-text-h6 text-[var(--ink)] flex items-center gap-0.5">
                <MapIcon size={20} strokeWidth={1.75} />
                Zones de couverture
              </h6>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={addCoverageZone}
              >
                Ajouter une zone
              </Button>
            </div>

            {formData.coverageZones.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, mb: 4, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><MapIcon size={32} strokeWidth={1.75} /></span>
                <p className="cn-text-body2 text-muted-foreground">
                  Aucune zone de couverture definie
                </p>
              </Box>
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
                    <Grid container spacing={2} key={index} sx={{ mb: 1.5, alignItems: 'center' }}>
                      <Grid item xs={12} md={3}>
                        <Autocomplete
                          size="small"
                          options={COVERAGE_COUNTRIES}
                          getOptionLabel={(opt) => opt.name}
                          value={countryDef}
                          disableClearable
                          onChange={(_e, val) => {
                            updateCoverageZone(index, 'country', val?.code || 'FR');
                            updateCoverageZone(index, 'department', undefined);
                            updateCoverageZone(index, 'arrondissement', undefined);
                            updateCoverageZone(index, 'city', undefined);
                          }}
                          renderInput={(params) => (
                            <TextField {...params} label="Pays" />
                          )}
                        />
                      </Grid>
                      {isFr ? (
                        <>
                          <Grid item xs={12} md={showArr ? 4 : 7}>
                            <Autocomplete
                              size="small"
                              options={FRENCH_DEPARTMENTS}
                              getOptionLabel={(opt) => `${opt.code} - ${opt.name}`}
                              value={deptObj || null}
                              onChange={(_e, val) => {
                                updateCoverageZone(index, 'department', val?.code || '');
                                if (!val || !hasArrondissements(val.code)) {
                                  updateCoverageZone(index, 'arrondissement', undefined);
                                }
                              }}
                              renderInput={(params) => (
                                <TextField {...params} label="Departement" placeholder="Selectionner un departement" />
                              )}
                            />
                          </Grid>
                          {showArr && (
                            <Grid item xs={12} md={4}>
                              <Autocomplete
                                size="small"
                                options={arrOptions}
                                getOptionLabel={(opt) => opt.name}
                                value={arrOptions.find(a => a.code === zone.arrondissement) || null}
                                onChange={(_e, val) => {
                                  updateCoverageZone(index, 'arrondissement', val?.code || undefined);
                                }}
                                renderInput={(params) => (
                                  <TextField {...params} label="Arrondissement" placeholder="Tous les arrondissements" />
                                )}
                              />
                            </Grid>
                          )}
                        </>
                      ) : (
                        <Grid item xs={12} md={7}>
                          <Autocomplete
                            size="small"
                            options={cityOptions}
                            freeSolo
                            value={zone.city || ''}
                            onChange={(_e, val) => {
                              updateCoverageZone(index, 'city', typeof val === 'string' ? val : (val ?? undefined));
                            }}
                            onInputChange={(_e, val) => {
                              updateCoverageZone(index, 'city', val || undefined);
                            }}
                            renderInput={(params) => (
                              <TextField {...params} label="Ville" placeholder="Saisir ou selectionner une ville" />
                            )}
                          />
                        </Grid>
                      )}
                      <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isFr && deptObj && (
                          <Badge variant="secondary" className="text-[0.72rem]">{deptObj.code}</Badge>
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeCoverageZone(index)}
                        >
                          <DeleteOutlined size={18} strokeWidth={1.75} />
                        </IconButton>
                      </Grid>
                    </Grid>
                  );
                })}
              </div>
            )}

            <h6 className="cn-text-h6 mb-3 text-[var(--ink)]">Membres de l'équipe</h6>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Utilisateur</InputLabel>
                  <Select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    label="Utilisateur"
                  >
                    {availableUsers && availableUsers.length > 0 ? (
                      availableUsers
                        .flatMap((user) =>
                          (formData.members || []).some(m => m.userId === user.id)
                            ? []
                            : [
                                <MenuItem key={user.id} value={user.id.toString()}>
                                  {user.firstName} {user.lastName} ({user.email})
                                </MenuItem>,
                              ],
                        )
                    ) : (
                      <MenuItem disabled>Aucun utilisateur disponible</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Rôle</InputLabel>
                  <Select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    label="Rôle"
                  >
                    {roleOptions.map((role) => (
                      <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  variant="outlined"
                  onClick={addMember}
                  disabled={!selectedUser || !selectedRole}
                  sx={{ height: '56px' }}
                >
                  Ajouter
                </Button>
              </Grid>
            </Grid>

            {(formData.members || []).length > 0 && (
              <div className="mb-6">
                <h6 className="cn-text-subtitle1 mb-3">
                  Membres actuels ({(formData.members || []).length})
                </h6>
                <List>
                  {(formData.members || []).map((member) => (
                    <React.Fragment key={member.userId}>
                      <ListItem sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: '10px' }}>
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${member.firstName} ${member.lastName}`}
                          secondary={member.email}
                        />
                        <div className="flex items-center gap-3">
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={member.role}
                              onChange={(e) => updateMemberRole(member.userId, e.target.value)}
                            >
                              {roleOptions.map((role) => (
                                <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => removeMember(member.userId)}
                          >
                            Retirer
                          </Button>
                        </div>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamEdit;
