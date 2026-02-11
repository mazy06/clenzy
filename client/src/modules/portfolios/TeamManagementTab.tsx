import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import {
  MoreVert,
  Edit,
  Delete,
  Person,
  Group,
  Assignment,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../hooks/useTranslation';

interface TeamMember {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  teamName: string;
  teamId: number;
  roleInTeam: string;
  assignedAt: string;
  isActive: boolean;
}

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  isActive: boolean;
  createdAt: string;
}

const TeamManagementTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    loadTeams();
    loadTeamMembers();
  }, []);

  const loadTeams = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Pour les managers, récupérer les équipes assignées à leurs portefeuilles
      const data = await apiClient.get<Team[]>(`/teams/manager/${user.id}`);
      setTeams(data);
    } catch (err: any) {
      setError(err?.message || t('portfolios.teamManagement.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!user) return;

    try {
      const data = await apiClient.get<TeamMember[]>(`/team-members/manager/${user.id}`);
      setTeamMembers(data);
    } catch (err) {
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, team: Team) => {
    setAnchorEl(event.currentTarget);
    setSelectedTeam(team);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTeam(null);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'LEADER': return 'primary';
      case 'MEMBER': return 'default';
      default: return 'secondary';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'LEADER': return <Person />;
      case 'MEMBER': return <Group />;
      default: return <Person />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {t('portfolios.teamManagement.title')} ({teams.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portfolios.teamManagement.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Assignment />}
          onClick={() => window.location.href = '/portfolios/team-assignment'}
        >
          {t('portfolios.teamManagement.assignTeams')}
        </Button>
      </Box>

      {teams.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Group sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Aucune équipe assignée
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Vos équipes opérationnelles apparaîtront ici une fois assignées à vos portefeuilles.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Assignment />}
            onClick={() => window.location.href = '/portfolios/team-assignment'}
          >
            Assigner des Équipes
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom de l'équipe</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Type d'intervention</TableCell>
                <TableCell>Membres</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Créé le</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="medium">
                      {team.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {team.description || 'Aucune description'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={team.interventionType}
                      size="small"
                      color={team.interventionType === 'CLEANING' ? 'success' : 'info'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Group fontSize="small" color="action" />
                      <Typography variant="body2">
                        {team.memberCount} membre{team.memberCount > 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={team.isActive ? t('portfolios.teamManagement.active') : t('portfolios.teamManagement.inactive')}
                      size="small"
                      color={team.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(team.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, team)}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          Modifier l'équipe
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          Voir les membres
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          Supprimer l'équipe
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TeamManagementTab;
