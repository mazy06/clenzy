import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Avatar,
  AvatarGroup,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Group as GroupIcon,
  CleaningServices as CleaningIcon,
  Build as BuildIcon,
  SupervisorAccount as SupervisorIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'housekeeper' | 'technician' | 'supervisor' | 'manager' | 'admin';
  status: 'active' | 'inactive';
  portfolioId?: string;
  teamId?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  portfolioId?: string;
  members: User[];
}

interface Portfolio {
  id: string;
  name: string;
  description?: string;
}

const TeamAssignmentPage: React.FC = () => {
  const { user } = useAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);



  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // TODO: Remplacer par de vrais appels API
      // const usersData = await api.getUsers();
      // const teamsData = await api.getTeams();
      // const portfoliosData = await api.getPortfolios();
      
      // Données temporaires pour la démo
      const mockUsers: User[] = [
        { id: '1', firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@clenzy.com', role: 'housekeeper', status: 'active' },
        { id: '2', firstName: 'Marie', lastName: 'Martin', email: 'marie.martin@clenzy.com', role: 'housekeeper', status: 'active' },
        { id: '3', firstName: 'Pierre', lastName: 'Durand', email: 'pierre.durand@clenzy.com', role: 'technician', status: 'active' },
        { id: '4', firstName: 'Sophie', lastName: 'Leroy', email: 'sophie.leroy@clenzy.com', role: 'technician', status: 'active' },
        { id: '5', firstName: 'Luc', lastName: 'Moreau', email: 'luc.moreau@clenzy.com', role: 'supervisor', status: 'active' },
        { id: '6', firstName: 'Claire', lastName: 'Simon', email: 'claire.simon@clenzy.com', role: 'supervisor', status: 'active' },
      ];
      
      const mockTeams: Team[] = [
        { 
          id: '1', 
          name: 'Équipe Nord', 
          description: 'Équipe opérationnelle du nord',
          members: [mockUsers[0], mockUsers[2], mockUsers[4]]
        },
        { 
          id: '2', 
          name: 'Équipe Sud', 
          description: 'Équipe opérationnelle du sud',
          members: [mockUsers[1], mockUsers[3], mockUsers[5]]
        },
        { 
          id: '3', 
          name: 'Équipe Est', 
          description: 'Équipe opérationnelle de l\'est',
          members: []
        },
      ];
      
      const mockPortfolios: Portfolio[] = [
        { id: '1', name: 'Portefeuille Nord', description: 'Clients du nord de la France' },
        { id: '2', name: 'Portefeuille Sud', description: 'Clients du sud de la France' },
        { id: '3', name: 'Portefeuille Est', description: 'Clients de l\'est de la France' },
      ];
      
      setUsers(mockUsers);
      setTeams(mockTeams);
      setPortfolios(mockPortfolios);
    } catch (err) {
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleUserPortfolioChange = async (userId: string, portfolioId: string) => {
    try {
      // TODO: Appel API pour associer l'utilisateur au portefeuille
      // await api.assignUserToPortfolio(userId, portfolioId);
      
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, portfolioId } 
          : user
      ));
      
      setSuccess('Utilisateur associé au portefeuille avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de l\'association de l\'utilisateur');
    }
  };

  const handleTeamPortfolioChange = async (teamId: string, portfolioId: string) => {
    try {
      // TODO: Appel API pour associer l'équipe au portefeuille
      // await api.assignTeamToPortfolio(teamId, portfolioId);
      
      setTeams(prev => prev.map(team => 
        team.id === teamId 
          ? { ...team, portfolioId } 
          : team
      ));
      
      setSuccess('Équipe associée au portefeuille avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de l\'association de l\'équipe');
    }
  };

  const getPortfolioName = (portfolioId?: string) => {
    if (!portfolioId) return 'Non assigné';
    const portfolio = portfolios.find(p => p.id === portfolioId);
    return portfolio ? portfolio.name : 'Non assigné';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'housekeeper':
        return <CleaningIcon />;
      case 'technician':
        return <BuildIcon />;
      case 'supervisor':
        return <SupervisorIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'housekeeper':
        return 'success';
      case 'technician':
        return 'warning';
      case 'supervisor':
        return 'info';
      default:
        return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'housekeeper':
        return 'Agent de nettoyage';
      case 'technician':
        return 'Technicien';
      case 'supervisor':
        return 'Superviseur';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <Box>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Association Équipes & Utilisateurs"
        subtitle="Associez vos équipes et utilisateurs aux portefeuilles"
        backPath="/portfolios"
        showBackButton={true}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Section Utilisateurs */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Utilisateurs Opérationnels
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Associez vos utilisateurs (housekeeper, technician, supervisor) aux portefeuilles appropriés
          </Typography>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Utilisateur</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rôle</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Portefeuille actuel</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.filter(u => ['housekeeper', 'technician', 'supervisor'].includes(u.role)).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">
                        {user.firstName} {user.lastName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip 
                      icon={getRoleIcon(user.role)}
                      label={getRoleLabel(user.role)}
                      color={getRoleColor(user.role) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={user.status === 'active' ? 'Actif' : 'Inactif'} 
                      color={user.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {editingUser === user.id ? (
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select
                          value={user.portfolioId || ''}
                          onChange={(e) => handleUserPortfolioChange(user.id, e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Sélectionner un portefeuille</em>
                          </MenuItem>
                          {portfolios.map((portfolio) => (
                            <MenuItem key={portfolio.id} value={portfolio.id}>
                              {portfolio.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Chip 
                        label={getPortfolioName(user.portfolioId)} 
                        color={user.portfolioId ? 'primary' : 'default'}
                        variant={user.portfolioId ? 'filled' : 'outlined'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {editingUser === user.id ? (
                      <Box display="flex" gap={1}>
                        <IconButton size="small" color="primary">
                          <SaveIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => setEditingUser(null)}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <IconButton 
                        size="small" 
                        onClick={() => setEditingUser(user.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Section Équipes */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Équipes Opérationnelles
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Associez vos équipes aux portefeuilles appropriés
          </Typography>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom de l'équipe</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Membres</TableCell>
                <TableCell>Portefeuille actuel</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <GroupIcon color="primary" />
                      <Typography variant="body2" fontWeight="medium">
                        {team.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{team.description || '-'}</TableCell>
                  <TableCell>
                    <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }}>
                      {team.members.map((member) => (
                        <Tooltip key={member.id} title={`${member.firstName} ${member.lastName} (${getRoleLabel(member.role)})`}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </AvatarGroup>
                    <Typography variant="caption" color="text.secondary">
                      {team.members.length} membre(s)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {editingTeam === team.id ? (
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select
                          value={team.portfolioId || ''}
                          onChange={(e) => handleTeamPortfolioChange(team.id, e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Sélectionner un portefeuille</em>
                          </MenuItem>
                          {portfolios.map((portfolio) => (
                            <MenuItem key={portfolio.id} value={portfolio.id}>
                              {portfolio.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Chip 
                        label={getPortfolioName(team.portfolioId)} 
                        color={team.portfolioId ? 'primary' : 'default'}
                        variant={team.portfolioId ? 'filled' : 'outlined'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {editingTeam === team.id ? (
                      <Box display="flex" gap={1}>
                        <IconButton size="small" color="primary">
                          <SaveIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => setEditingTeam(null)}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <IconButton 
                        size="small" 
                        onClick={() => setEditingTeam(team.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default TeamAssignmentPage;
