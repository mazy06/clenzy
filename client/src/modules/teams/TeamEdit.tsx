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
  FormHelperText,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
} from '@mui/material';
import {
  Group,
  Save,
  Cancel,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import PageHeader from '../../components/PageHeader';

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
}

const TeamEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    description: '',
    interventionType: 'CLEANING',
    members: []
  });
  
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('technician');

  // Charger les données de l'équipe et les utilisateurs disponibles
  useEffect(() => {
    const loadTeam = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const [teamResponse, usersResponse] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}/api/teams/${id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            },
          }),
          fetch(`${API_CONFIG.BASE_URL}/api/users`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            },
          })
        ]);

        if (teamResponse.ok && usersResponse.ok) {
          const [teamData, usersData] = await Promise.all([
            teamResponse.json(),
            usersResponse.json()
          ]);
          
          console.log('🔍 TeamEdit - Équipe chargée:', teamData);
          console.log('🔍 TeamEdit - Utilisateurs chargés:', usersData);
          
          setFormData({
            name: teamData.name || '',
            description: teamData.description || '',
            interventionType: teamData.interventionType || 'CLEANING',
            members: teamData.members || []
          });
          
          setAvailableUsers(usersData);
        } else {
          setError('Erreur lors du chargement des données');
        }
      } catch (err) {
        console.error('🔍 TeamEdit - Erreur chargement données:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [id]);

  // Gestionnaires de changement
  const handleInputChange = (field: keyof TeamFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Gestion des membres
  const addMember = () => {
    if (!selectedUser || !selectedRole) return;
    
    const user = availableUsers?.find(u => u.userId.toString() === selectedUser);
    if (!user) return;
    
    // Vérifier si l'utilisateur n'est pas déjà dans l'équipe
    if ((formData.members || []).some(m => m.userId === user.userId)) {
      setError('Cet utilisateur est déjà dans l\'équipe');
      return;
    }
    
    const newMember: TeamMember = {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: selectedRole
    };
    
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, newMember]
    }));
    
    // Réinitialiser les sélections
    setSelectedUser('');
    setSelectedRole('technician');
    setError(null);
  };

  const removeMember = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(m => m.userId !== userId)
    }));
  };

  const updateMemberRole = (userId: number, newRole: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map(m => 
        m.userId === userId ? { ...m, role: newRole } : m
      )
    }));
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSuccess(true);
        
        // Redirection après un délai
        setTimeout(() => {
          navigate(`/teams/${id}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error('🔍 TeamEdit - Erreur mise à jour:', err);
      setError('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // Constantes pour les options
  const interventionTypes = [
    { value: 'CLEANING', label: 'Nettoyage' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'REPAIR', label: 'Réparation' },
    { value: 'OTHER', label: 'Autre' }
  ];

  const roleOptions = [
    { value: 'technician', label: 'Technicien' },
    { value: 'housekeeper', label: 'Agent de ménage' },
    { value: 'supervisor', label: 'Superviseur' },
    { value: 'manager', label: 'Manager' }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Vérifier les permissions pour l'édition
  const [canEdit, setCanEdit] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('teams:edit');
      setCanEdit(canEditPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;

  if (!canEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour modifier des équipes.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* PageHeader avec titre, sous-titre, bouton retour et bouton modifier */}
      <PageHeader
        title="Modifier l'équipe"
        subtitle="Modifiez les détails de l'équipe"
        backPath={`/teams/${id}`}
        backLabel="Retour aux détails"
        showBackButton={true}
        actions={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/teams/${id}`)}
              startIcon={<Cancel />}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </Box>
        }
      />

      {/* Messages d'erreur/succès */}
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

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations de base */}
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
                  <InputLabel>Type d'intervention *</InputLabel>
                  <Select
                    value={formData.interventionType}
                    onChange={(e) => handleInputChange('interventionType', e.target.value)}
                    label="Type d'intervention *"
                  >
                    {interventionTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Description */}
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Description
            </Typography>

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

            {/* Gestion des membres */}
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Membres de l'équipe
            </Typography>

            {/* Ajouter un membre */}
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
                        .filter(user => !(formData.members || []).some(m => m.userId === user.userId))
                        .map((user) => (
                          <MenuItem key={user.userId} value={user.userId.toString()}>
                            {user.firstName} {user.lastName} ({user.email})
                          </MenuItem>
                        ))
                    ) : (
                      <MenuItem disabled>
                        Aucun utilisateur disponible
                      </MenuItem>
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
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
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

            {/* Liste des membres actuels */}
            {(formData.members || []).length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Membres actuels ({(formData.members || []).length})
                </Typography>
                <List>
                  {(formData.members || []).map((member, index) => (
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
                                <MenuItem key={role.value} value={role.value}>
                                  {role.label}
                                </MenuItem>
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
