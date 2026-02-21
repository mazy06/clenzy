import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
} from '@mui/material';
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
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi, usersApi } from '../../services/api';
import type { CoverageZone } from '../../services/api/teamsApi';
import PageHeader from '../../components/PageHeader';
import { teamsKeys } from './useTeamsList';
import {
  FRENCH_DEPARTMENTS,
  hasArrondissements,
  getArrondissementsForDepartment,
} from '../../data/frenchDepartments';

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
      return Array.isArray(data) ? data : (data as any).content || [];
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
        members: (teamData as any).members || [],
        coverageZones: teamData.coverageZones?.map((z) => ({
          id: z.id,
          department: z.department,
          arrondissement: z.arrondissement,
        })) || [],
      });
    }
  }, [teamQuery.data]);

  const availableUsers = usersQuery.data ?? [];
  const loading = teamQuery.isLoading || usersQuery.isLoading;

  // ─── Update mutation ──────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: TeamFormData) => teamsApi.update(Number(id), data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.all });
      setSuccess(true);
      setTimeout(() => {
        navigate(`/teams/${id}`);
      }, 1500);
    },
    onError: (err: any) => {
      setError(err?.message || 'Erreur lors de la mise à jour');
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof TeamFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addMember = () => {
    if (!selectedUser || !selectedRole) return;
    const user = (availableUsers as TeamMember[])?.find(u => u.userId?.toString() === selectedUser);
    if (!user) return;
    if ((formData.members || []).some(m => m.userId === user.userId)) {
      setError('Cet utilisateur est déjà dans l\'équipe');
      return;
    }
    const newMember: TeamMember = {
      userId: user.userId,
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
      coverageZones: [...prev.coverageZones, { department: '', arrondissement: undefined }],
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

  const teamServiceCategories = [
    { value: 'CLEANING', label: 'Nettoyage', icon: <AutoAwesome sx={{ fontSize: 18 }} /> },
    { value: 'MAINTENANCE', label: 'Maintenance', icon: <Build sx={{ fontSize: 18 }} /> },
    { value: 'OTHER', label: 'Autre', icon: <Category sx={{ fontSize: 18 }} /> },
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!canEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>Accès non autorisé</Typography>
          <Typography variant="body1">Vous n'avez pas les permissions nécessaires pour modifier des équipes.</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Modifier l'équipe"
        subtitle="Modifiez les détails de l'équipe"
        backPath={`/teams/${id}`}
        backLabel="Retour aux détails"
        showBackButton={true}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
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
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Équipe mise à jour avec succès ! Redirection en cours...
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Informations de base
            </Typography>

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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {cat.icon}
                          <Typography variant="body2">{cat.label}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Description</Typography>

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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MapIcon sx={{ fontSize: 20 }} />
                Zones de couverture
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={addCoverageZone}
              >
                Ajouter une zone
              </Button>
            </Box>

            {formData.coverageZones.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, mb: 4, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                <MapIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Aucune zone de couverture definie
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mb: 4 }}>
                {formData.coverageZones.map((zone, index) => {
                  const deptObj = FRENCH_DEPARTMENTS.find(d => d.code === zone.department);
                  const showArr = hasArrondissements(zone.department);
                  const arrOptions = showArr ? getArrondissementsForDepartment(zone.department) : [];

                  return (
                    <Grid container spacing={2} key={index} sx={{ mb: 1.5, alignItems: 'center' }}>
                      <Grid item xs={12} md={5}>
                        <Autocomplete
                          size="small"
                          options={FRENCH_DEPARTMENTS}
                          getOptionLabel={(opt) => `${opt.code} - ${opt.name}`}
                          value={deptObj || null}
                          onChange={(_e, val) => {
                            updateCoverageZone(index, 'department', val?.code || '');
                            // Reset arrondissement when department changes
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
                        <Grid item xs={12} md={5}>
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
                      <Grid item xs={12} md={showArr ? 2 : 7} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {deptObj && (
                          <Chip
                            size="small"
                            label={deptObj.code}
                            sx={{ fontSize: '0.72rem' }}
                          />
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeCoverageZone(index)}
                        >
                          <DeleteOutlined sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Grid>
                    </Grid>
                  );
                })}
              </Box>
            )}

            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Membres de l'équipe</Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Utilisateur</InputLabel>
                  <Select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    label="Utilisateur"
                  >
                    {availableUsers && (availableUsers as TeamMember[]).length > 0 ? (
                      (availableUsers as TeamMember[])
                        .filter((user: TeamMember) => !(formData.members || []).some(m => m.userId === user.userId))
                        .map((user: TeamMember) => (
                          <MenuItem key={user.userId} value={user.userId.toString()}>
                            {user.firstName} {user.lastName} ({user.email})
                          </MenuItem>
                        ))
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
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Membres actuels ({(formData.members || []).length})
                </Typography>
                <List>
                  {(formData.members || []).map((member) => (
                    <React.Fragment key={member.userId}>
                      <ListItem sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${member.firstName} ${member.lastName}`}
                          secondary={member.email}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                        </Box>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            )}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeamEdit;
