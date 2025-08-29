import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  People,
  Group,
  Person,
  Business,
  Add,
  Edit,
  Delete,
  Email,
  Phone,
  LocationOn,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface PortfolioCardProps {
  portfolio: {
    id: number;
    name: string;
    description: string;
    managerName: string;
    clientCount: number;
    teamMemberCount: number;
    isActive: boolean;
    createdAt: string;
  };
  onRefresh: () => void;
}

interface PortfolioClient {
  id: number;
  clientName: string;
  clientEmail: string;
  clientRole: string;
  assignedAt: string;
  notes?: string;
}

interface PortfolioTeam {
  id: number;
  teamMemberName: string;
  teamMemberEmail: string;
  roleInTeam: string;
  assignedAt: string;
  notes?: string;
}

const PortfolioCard: React.FC<PortfolioCardProps> = ({ portfolio, onRefresh }) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [clients, setClients] = useState<PortfolioClient[]>([]);
  const [teamMembers, setTeamMembers] = useState<PortfolioTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({ clientId: '', notes: '' });
  const [newTeamMember, setNewTeamMember] = useState({ 
    teamMemberId: '', 
    roleInTeam: '', 
    notes: '' 
  });
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableTeamMembers, setAvailableTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    if (expanded) {
      loadPortfolioDetails();
      loadAvailableUsers();
    }
  }, [expanded, portfolio.id]);

  const loadPortfolioDetails = async () => {
    setLoading(true);
    try {
      // Charger les clients
      const clientsResponse = await fetch(
        `${API_CONFIG.BASE_URL}/api/portfolios/${portfolio.id}/clients`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        setClients(clientsData);
      }

      // Charger les membres d'équipe
      const teamResponse = await fetch(
        `${API_CONFIG.BASE_URL}/api/portfolios/${portfolio.id}/team`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        setTeamMembers(teamData);
      }
    } catch (err) {
      console.error('Erreur chargement détails portefeuille:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/users`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const usersList = data.content || data;
        
        // Filtrer les HOSTs pour les clients
        const hosts = usersList.filter((u: any) => u.role === 'HOST');
        setAvailableClients(hosts);
        
        // Filtrer les TECHNICIEN, HOUSEKEEPER, SUPERVISOR pour l'équipe
        const teamMembers = usersList.filter((u: any) => 
          ['TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'].includes(u.role)
        );
        setAvailableTeamMembers(teamMembers);
      }
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.clientId) return;

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/portfolios/${portfolio.id}/clients`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            clientId: newClient.clientId,
            notes: newClient.notes || '',
          }),
        }
      );

      if (response.ok) {
        setIsClientDialogOpen(false);
        setNewClient({ clientId: '', notes: '' });
        loadPortfolioDetails();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur ajout client:', err);
    }
  };

  const handleAddTeamMember = async () => {
    if (!newTeamMember.teamMemberId || !newTeamMember.roleInTeam) return;

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/portfolios/${portfolio.id}/team`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            teamMemberId: newTeamMember.teamMemberId,
            roleInTeam: newTeamMember.roleInTeam,
            notes: newTeamMember.notes || '',
          }),
        }
      );

      if (response.ok) {
        setIsTeamDialogOpen(false);
        setNewTeamMember({ teamMemberId: '', roleInTeam: '', notes: '' });
        loadPortfolioDetails();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur ajout membre équipe:', err);
    }
  };

  const handleRemoveClient = async (clientId: number) => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/portfolios/${portfolio.id}/clients/${clientId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );

      if (response.ok) {
        loadPortfolioDetails();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur suppression client:', err);
    }
  };

  const handleRemoveTeamMember = async (teamMemberId: number) => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/portfolios/${portfolio.id}/team/${teamMemberId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );

      if (response.ok) {
        loadPortfolioDetails();
        onRefresh();
      }
    } catch (err) {
      console.error('Erreur suppression membre équipe:', err);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'TECHNICIAN': return 'primary';
      case 'HOUSEKEEPER': return 'secondary';
      case 'SUPERVISOR': return 'warning';
      case 'LEADER': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {/* En-tête du portefeuille */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" gutterBottom>
              {portfolio.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {portfolio.description || 'Aucune description'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Créé le {formatDate(portfolio.createdAt)} • Manager: {portfolio.managerName}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={portfolio.isActive ? 'Actif' : 'Inactif'}
              color={portfolio.isActive ? 'success' : 'default'}
              size="small"
            />
            <IconButton
              onClick={() => setExpanded(!expanded)}
              size="small"
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Statistiques rapides */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip
            icon={<People />}
            label={`${portfolio.clientCount} client${portfolio.clientCount > 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            color="primary"
          />
          <Chip
            icon={<Group />}
            label={`${portfolio.teamMemberCount} membre${portfolio.teamMemberCount > 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            color="secondary"
          />
        </Box>

        {/* Contenu détaillé */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box>
              {/* Section Clients */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" color="primary">
                    Clients du Portefeuille
                  </Typography>
                  <Button
                    startIcon={<Add />}
                    size="small"
                    onClick={() => setIsClientDialogOpen(true)}
                    disabled={!portfolio.isActive}
                  >
                    Ajouter un client
                  </Button>
                </Box>

                {clients.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Aucun client associé à ce portefeuille
                  </Typography>
                ) : (
                  <List dense>
                    {clients.map((client) => (
                      <ListItem key={client.id} sx={{ px: 0 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <Person />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={client.clientName}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {client.clientEmail}
                              </Typography>
                              {client.notes && (
                                <Typography variant="caption" color="text.secondary">
                                  {client.notes}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Ajouté le {formatDate(client.assignedAt)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveClient(client.id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>

              {/* Section Équipe */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" color="secondary">
                    Équipe Opérationnelle
                  </Typography>
                  <Button
                    startIcon={<Add />}
                    size="small"
                    onClick={() => setIsTeamDialogOpen(true)}
                    disabled={!portfolio.isActive}
                  >
                    Ajouter un membre
                  </Button>
                </Box>

                {teamMembers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Aucun membre d'équipe associé à ce portefeuille
                  </Typography>
                ) : (
                  <List dense>
                    {teamMembers.map((member) => (
                      <ListItem key={member.id} sx={{ px: 0 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            <Group />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.teamMemberName}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {member.teamMemberEmail}
                              </Typography>
                              {member.notes && (
                                <Typography variant="caption" color="text.secondary">
                                  {member.notes}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={member.roleInTeam}
                            size="small"
                            color={getRoleColor(member.roleInTeam) as any}
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            Ajouté le {formatDate(member.assignedAt)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveTeamMember(member.id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          )}
        </Collapse>
      </CardContent>

      {/* Dialog Ajout Client */}
      <Dialog open={isClientDialogOpen} onClose={() => setIsClientDialogOpen(false)}>
        <DialogTitle>Ajouter un client au portefeuille</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Client</InputLabel>
            <Select
              value={newClient.clientId}
              onChange={(e) => setNewClient({ ...newClient, clientId: e.target.value })}
              label="Client"
            >
              {availableClients.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.firstName} {client.lastName} ({client.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Notes (optionnel)"
            multiline
            rows={3}
            value={newClient.notes}
            onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsClientDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleAddClient} variant="contained">
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Ajout Membre Équipe */}
      <Dialog open={isTeamDialogOpen} onClose={() => setIsTeamDialogOpen(false)}>
        <DialogTitle>Ajouter un membre d'équipe</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Membre d'équipe</InputLabel>
            <Select
              value={newTeamMember.teamMemberId}
              onChange={(e) => setNewTeamMember({ ...newTeamMember, teamMemberId: e.target.value })}
              label="Membre d'équipe"
            >
              {availableTeamMembers.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.firstName} {member.lastName} ({member.role})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Rôle dans l'équipe</InputLabel>
            <Select
              value={newTeamMember.roleInTeam}
              onChange={(e) => setNewTeamMember({ ...newTeamMember, roleInTeam: e.target.value })}
              label="Rôle dans l'équipe"
            >
              <MenuItem value="TECHNICIAN">Technicien</MenuItem>
              <MenuItem value="HOUSEKEEPER">Agent de ménage</MenuItem>
              <MenuItem value="SUPERVISOR">Superviseur</MenuItem>
              <MenuItem value="LEADER">Chef d'équipe</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Notes (optionnel)"
            multiline
            rows={3}
            value={newTeamMember.notes}
            onChange={(e) => setNewTeamMember({ ...newTeamMember, notes: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsTeamDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleAddTeamMember} variant="contained">
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PortfolioCard;
