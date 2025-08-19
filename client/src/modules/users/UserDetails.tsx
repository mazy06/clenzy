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
import { API_CONFIG } from '../../config/api';

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

const userRoles = [
  { value: 'ADMIN', label: 'Administrateur', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'MANAGER', label: 'Manager', icon: <SupervisorAccount />, color: 'warning' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'HOST', label: 'Propriétaire', icon: <Home />, color: 'success' },
];

const userStatuses = [
  { value: 'ACTIVE', label: 'Actif', color: 'success' },
  { value: 'INACTIVE', label: 'Inactif', color: 'default' },
  { value: 'SUSPENDED', label: 'Suspendu', color: 'error' },
  { value: 'PENDING_VERIFICATION', label: 'En attente de vérification', color: 'warning' },
  { value: 'BLOCKED', label: 'Bloqué', color: 'error' },
];

const UserDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetailsData | null>(null);

  // Charger les données de l'utilisateur
  useEffect(() => {
    const loadUser = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('🔍 UserDetails - Utilisateur chargé:', userData);
          
          // Convertir les données du backend vers le format frontend
          const convertedUser: UserDetailsData = {
            id: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phoneNumber: userData.phoneNumber,
            role: userData.role?.toUpperCase() || 'HOST',
            status: userData.status?.toUpperCase() || 'ACTIVE',
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
            lastLoginAt: userData.lastLoginAt,
          };
          
          setUser(convertedUser);
        } else {
          setError('Erreur lors du chargement de l\'utilisateur');
        }
      } catch (err) {
        console.error('🔍 UserDetails - Erreur chargement:', err);
        setError('Erreur lors du chargement de l\'utilisateur');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id]);

  // Vérifier les permissions - accès uniquement aux admin
  if (!isAdmin()) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Accès refusé. Cette section est réservée aux administrateurs.
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
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Utilisateur non trouvé
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header avec bouton retour et bouton modifier */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate('/users')} 
            sx={{ mr: 2 }}
            size="large"
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight={700}>
            Détails de l'utilisateur
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={handleEdit}
        >
          Modifier
        </Button>
      </Box>

      {/* Carte principale avec résumé */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          {/* En-tête de l'utilisateur */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: '2rem' }}>
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight={600}>
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                icon={getRoleInfo(user.role).icon}
                label={getRoleInfo(user.role).label}
                color={getRoleInfo(user.role).color as any}
                size="medium"
              />
              <Chip
                label={getStatusInfo(user.status).label}
                color={getStatusInfo(user.status).color as any}
                size="medium"
                variant="outlined"
              />
            </Box>
          </Box>

          {/* Métriques principales */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Person sx={{ fontSize: 24, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" fontWeight={500}>
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Nom complet
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Email sx={{ fontSize: 24, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" fontWeight={500}>
                  {user.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Adresse email
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <CalendarToday sx={{ fontSize: 24, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" fontWeight={500}>
                  {formatDate(user.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Créé le
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Détails complets */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={4}>
            {/* Informations personnelles */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
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
                color={getRoleInfo(user.role).color as any}
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
                color={getStatusInfo(user.status).color as any}
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
