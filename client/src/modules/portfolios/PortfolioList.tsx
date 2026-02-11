import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from '@mui/material';
import {
  MoreVert,
  People,
  Business,
  Edit,
  Delete,
  Add,
  Person,
  Group,
  Euro,
  TrendingUp,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { portfoliosApi } from '../../services/api';
import apiClient from '../../services/apiClient';

interface AvailableUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Portfolio {
  id: number;
  name: string;
  description: string;
  managerName: string;
  clientCount: number;
  teamMemberCount: number;
  isActive: boolean;
  createdAt: string;
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

const PortfolioList: React.FC = () => {
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({ clientId: '', notes: '' });
  const [newTeamMember, setNewTeamMember] = useState({ 
    teamMemberId: '', 
    roleInTeam: '', 
    notes: '' 
  });
  const [availableClients, setAvailableClients] = useState<AvailableUser[]>([]);
  const [availableTeamMembers, setAvailableTeamMembers] = useState<AvailableUser[]>([]);

  useEffect(() => {
    loadPortfolios();
    loadAvailableUsers();
  }, []);

  const loadPortfolios = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await portfoliosApi.getByManager(user.id);
      setPortfolios(data as Portfolio[]);
    } catch (err: any) {
      setError(err?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const data = await apiClient.get<any>('/users');
      const usersList = data.content || data;

      // Filtrer les HOSTs pour les clients
      const hosts = usersList.filter((u: AvailableUser) => u.role === 'HOST');
      setAvailableClients(hosts);

      // Filtrer les TECHNICIEN, HOUSEKEEPER, SUPERVISOR pour l'équipe
      const teamMembers = usersList.filter((u: AvailableUser) =>
        ['TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'].includes(u.role)
      );
      setAvailableTeamMembers(teamMembers);
    } catch (err) {
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, portfolio: Portfolio) => {
    setAnchorEl(event.currentTarget);
    setSelectedPortfolio(portfolio);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPortfolio(null);
  };

  const handleAddClient = () => {
    setIsClientDialogOpen(true);
  };

  const handleAddTeamMember = () => {
    setIsTeamDialogOpen(true);
  };

  const handleClientSubmit = async () => {
    if (!selectedPortfolio || !newClient.clientId) return;

    try {
      await portfoliosApi.assignClient(selectedPortfolio.id, {
        clientId: newClient.clientId,
        notes: newClient.notes || '',
      });
      setIsClientDialogOpen(false);
      setNewClient({ clientId: '', notes: '' });
      loadPortfolios(); // Rafraîchir la liste
    } catch (err) {
    }
  };

  const handleTeamMemberSubmit = async () => {
    if (!selectedPortfolio || !newTeamMember.teamMemberId || !newTeamMember.roleInTeam) return;

    try {
      await portfoliosApi.assignTeam(selectedPortfolio.id, {
        teamMemberId: newTeamMember.teamMemberId,
        roleInTeam: newTeamMember.roleInTeam,
        notes: newTeamMember.notes || '',
      });
      setIsTeamDialogOpen(false);
      setNewTeamMember({ teamMemberId: '', roleInTeam: '', notes: '' });
      loadPortfolios(); // Rafraîchir la liste
    } catch (err) {
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (portfolios.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Business sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Aucun portefeuille créé
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Commencez par créer votre premier portefeuille client
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Mes Portefeuilles ({portfolios.length})
      </Typography>

      <Grid container spacing={3}>
        {portfolios.map((portfolio) => (
          <Grid item xs={12} md={6} lg={4} key={portfolio.id}>
            <Card variant="outlined" sx={{ height: '100%' }}>
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
                      Créé le {formatDate(portfolio.createdAt)}
                    </Typography>
                  </Box>

                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, portfolio)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>

                {/* Statistiques */}
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

                {/* Statut */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={portfolio.isActive ? 'Actif' : 'Inactif'}
                    color={portfolio.isActive ? 'success' : 'default'}
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {portfolio.managerName}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleAddClient}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          Ajouter un client
        </MenuItem>
        <MenuItem onClick={handleAddTeamMember}>
          <ListItemIcon>
            <Group fontSize="small" />
          </ListItemIcon>
          Ajouter un membre d'équipe
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          Modifier
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          Supprimer
        </MenuItem>
      </Menu>

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
          <Button onClick={handleClientSubmit} variant="contained">
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
          <Button onClick={handleTeamMemberSubmit} variant="contained">
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PortfolioList;
