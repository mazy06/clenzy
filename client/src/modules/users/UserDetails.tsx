import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Person,
  Email,
  Phone,
  AdminPanelSettings,
  SupervisorAccount,
  Build,
  CleaningServices,
  Home,
  CalendarToday,
  Security,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usersApi } from '../../services/api';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

interface UserDetailsData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

const userRoles: Array<{ value: string; label: string; icon: React.ReactElement; color: ChipColor }> = [
  { value: 'ADMIN', label: 'Administrateur', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'MANAGER', label: 'Manager', icon: <SupervisorAccount />, color: 'warning' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'HOST', label: 'Propriétaire', icon: <Home />, color: 'success' },
];

const userStatuses: Array<{ value: string; label: string; color: ChipColor }> = [
  { value: 'ACTIVE', label: 'Actif', color: 'success' },
  { value: 'INACTIVE', label: 'Inactif', color: 'default' },
  { value: 'SUSPENDED', label: 'Suspendu', color: 'error' },
  { value: 'PENDING_VERIFICATION', label: 'En attente de vérification', color: 'warning' },
  { value: 'BLOCKED', label: 'Bloqué', color: 'error' },
];

const UserDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  
  // Vérifier la permission de gestion des utilisateurs
  const [canManageUsers, setCanManageUsers] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canManageUsersPermission = await hasPermissionAsync('users:manage');
      setCanManageUsers(canManageUsersPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetailsData | null>(null);

  // Charger les données de l'utilisateur
  useEffect(() => {
    const loadUser = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const userData = await usersApi.getById(Number(id));
        // Convertir les données du backend vers le format frontend
        const convertedUser: UserDetailsData = {
          id: (userData as any).id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: (userData as any).phoneNumber,
          role: userData.role?.toUpperCase() || 'HOST',
          status: (userData as any).status?.toUpperCase() || 'ACTIVE',
          createdAt: (userData as any).createdAt,
          updatedAt: (userData as any).updatedAt,
          lastLoginAt: (userData as any).lastLoginAt,
        };

        setUser(convertedUser);
      } catch (err) {
        setError('Erreur lors du chargement de l\'utilisateur');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id]);

  // Vérifier les permissions - accès uniquement aux utilisateurs avec la permission users:manage
  if (!canManageUsers) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ p: 2, py: 1 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
            Accès non autorisé
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            Vous n'avez pas les permissions nécessaires pour visualiser les détails des utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleEdit = () => {
    if (user) {
      navigate(`/users/${user.id}/edit`);
    }
  };

  const getRoleInfo = (role: string) => {
    return userRoles.find(r => r.value === role) || userRoles[0];
  };

  const getStatusInfo = (status: string) => {
    return userStatuses.find(s => s.value === status) || userStatuses[0];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ p: 2, py: 1 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ p: 2, py: 1 }}>
          Utilisateur non trouvé
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header avec bouton retour et bouton modifier */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate('/users')} 
            sx={{ mr: 1.5 }}
            size="small"
          >
            <ArrowBack sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.25rem' }}>
            Détails de l'utilisateur
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          size="small"
          startIcon={<Edit sx={{ fontSize: 16 }} />}
          onClick={handleEdit}
          sx={{ fontSize: '0.8125rem' }}
        >
          Modifier
        </Button>
      </Box>

      {/* Carte principale avec résumé */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          {/* En-tête de l'utilisateur */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: '1.25rem' }}>
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={600} sx={{ fontSize: '1rem' }}>
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  {user.email}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                icon={<Box sx={{ fontSize: 18 }}>{getRoleInfo(user.role).icon}</Box>}
                label={getRoleInfo(user.role).label}
                color={getRoleInfo(user.role).color}
                size="small"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
              <Chip
                label={getStatusInfo(user.status).label}
                color={getStatusInfo(user.status).color}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            </Box>
          </Box>

          {/* Métriques principales */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Person sx={{ fontSize: 18, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Nom complet
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Email sx={{ fontSize: 18, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                  {user.email}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Adresse email
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <CalendarToday sx={{ fontSize: 18, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                  {formatDate(user.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Créé le
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Détails complets */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {/* Informations personnelles */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
                Informations personnelles
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Prénom
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {user.firstName}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Nom
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {user.lastName}
              </Typography>
            </Grid>

            {/* Informations de contact */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Informations de contact
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {user.email}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Téléphone
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {user.phoneNumber || 'Non renseigné'}
              </Typography>
            </Grid>

            {/* Rôle et statut */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Rôle et statut
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Rôle
              </Typography>
              <Chip
                icon={getRoleInfo(user.role).icon}
                label={getRoleInfo(user.role).label}
                color={getRoleInfo(user.role).color}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                {user.role === 'ADMIN' && 'Accès complet à toutes les fonctionnalités de la plateforme'}
                {user.role === 'MANAGER' && 'Gestion des équipes et des demandes de service'}
                {user.role === 'SUPERVISOR' && 'Supervision des interventions et du personnel'}
                {user.role === 'TECHNICIAN' && 'Exécution des interventions techniques'}
                {user.role === 'HOUSEKEEPER' && 'Exécution des interventions de nettoyage'}
                {user.role === 'HOST' && 'Gestion de ses propres propriétés'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Statut
              </Typography>
              <Chip
                label={getStatusInfo(user.status).label}
                color={getStatusInfo(user.status).color}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                {user.status === 'ACTIVE' && 'L\'utilisateur peut se connecter et utiliser la plateforme'}
                {user.status === 'INACTIVE' && 'L\'utilisateur ne peut pas se connecter temporairement'}
                {user.status === 'SUSPENDED' && 'L\'utilisateur est suspendu et ne peut pas se connecter'}
                {user.status === 'PENDING_VERIFICATION' && 'L\'utilisateur doit vérifier son compte'}
                {user.status === 'BLOCKED' && 'L\'utilisateur est bloqué pour violation des conditions'}
              </Typography>
            </Grid>

            {/* Métadonnées */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Informations système
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Créé le
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(user.createdAt)}
              </Typography>
            </Grid>

            {user.updatedAt && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Modifié le
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {formatDate(user.updatedAt)}
                </Typography>
              </Grid>
            )}

            {user.lastLoginAt && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Dernière connexion
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {formatDate(user.lastLoginAt)}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserDetails;
