import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Alert,
  Button,
  CircularProgress
} from '@mui/material';
import {
  Home,
  Person,
  Group,
  Build,
  Description,
  Visibility,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import { createSpacing } from '../../theme/spacing';

export default function ActivitiesPage() {
  const navigate = useNavigate();
  const { user, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  
  // Déterminer le rôle de l'utilisateur
  const userRole = (() => {
    if (user?.roles?.includes('ADMIN')) return 'ADMIN';
    if (user?.roles?.includes('MANAGER')) return 'MANAGER';
    if (user?.roles?.includes('SUPERVISOR')) return 'SUPERVISOR';
    if (user?.roles?.includes('TECHNICIAN')) return 'TECHNICIAN';
    if (user?.roles?.includes('HOUSEKEEPER')) return 'HOUSEKEEPER';
    if (user?.roles?.includes('HOST')) return 'HOST';
    return 'USER';
  })();
  
  const { activities, loading, error } = useDashboardStats(userRole, user, t, undefined); // Pas de limite pour la page des activités
  
  // TOUS les useState DOIVENT être déclarés AVANT tout autre code
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [canViewActivities, setCanViewActivities] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      // Permettre l'accès à tous les utilisateurs pour voir leurs propres activités
      // La permission reports:view n'est pas nécessaire pour voir les activités
      setCanViewActivities(true);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  console.log('🔍 ActivitiesPage - Rendu du composant avec hooks de base');
  console.log('🔍 ActivitiesPage - user:', user);
  console.log('🔍 ActivitiesPage - activities:', activities);
  console.log('🔍 ActivitiesPage - loading:', loading);
  console.log('🔍 ActivitiesPage - error:', error);
  console.log('🔍 ActivitiesPage - canViewActivities:', canViewActivities);

  // Fonctions utilitaires pour l'affichage des activités
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'urgent': return 'error';
      case 'scheduled': return 'info';
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'created': return 'primary';
      case 'started': return 'info';
      case 'finished': return 'success';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'urgent': return 'Urgent';
      case 'scheduled': return 'Planifié';
      case 'pending': return 'En attente';
      case 'approved': return 'Approuvé';
      case 'created': return 'Créé';
      case 'started': return 'Démarré';
      case 'finished': return 'Terminé';
      default: return status;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'property': return <Home />;
      case 'service-request': return <Description />;
      case 'intervention': return <Build />;
      case 'user': return <Person />;
      case 'team': return <Group />;
      default: return <Visibility />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'property': return 'Propriété';
      case 'service-request': return 'Demande de service';
      case 'intervention': return 'Intervention';
      case 'user': return 'Utilisateur';
      case 'team': return 'Équipe';
      default: return category;
    }
  };

  // Filtrage des activités
  const filteredActivities = activities?.filter(activity => {
    const matchesSearch = activity.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.property.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || activity.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || activity.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  }) || [];

  // Afficher un message de chargement
  if (loading) {
    return (
      <Box>
        <PageHeader
          title="Journal d'activités"
          subtitle="Suivi de toutes les activités de la plateforme"
          backPath="/dashboard"
          backLabel="Retour au Dashboard"
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  // Afficher un message d'erreur
  if (error) {
    return (
      <Box>
        <PageHeader
          title="Journal d'activités"
          subtitle="Suivi de toutes les activités de la plateforme"
          backPath="/dashboard"
          backLabel="Retour au Dashboard"
        />
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Journal d'activités"
        subtitle="Suivi de toutes les activités de la plateforme"
        backPath="/dashboard"
        backLabel="Retour au Dashboard"
      />
      
      {/* Filtres */}
      <Paper sx={{ ...createSpacing.card(), mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Rechercher une activité"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Catégorie"
              >
                <MenuItem value="all">Toutes</MenuItem>
                <MenuItem value="property">Propriétés</MenuItem>
                <MenuItem value="user">Utilisateurs</MenuItem>
                <MenuItem value="team">Équipes</MenuItem>
                <MenuItem value="intervention">Interventions</MenuItem>
                <MenuItem value="service-request">Demandes de service</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Statut</InputLabel>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                label="Statut"
              >
                <MenuItem value="all">Tous</MenuItem>
                <MenuItem value="created">Créé</MenuItem>
                <MenuItem value="pending">En attente</MenuItem>
                <MenuItem value="approved">Approuvé</MenuItem>
                <MenuItem value="in_progress">En cours</MenuItem>
                <MenuItem value="completed">Terminé</MenuItem>
                <MenuItem value="scheduled">Planifié</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Chip 
              label={`${filteredActivities.length} activité${filteredActivities.length > 1 ? 's' : ''}`}
              color="primary"
              variant="outlined"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Affichage des données */}
      <Box sx={{ mt: 3 }}>
        
        {/* Liste des activités */}
        {filteredActivities && filteredActivities.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredActivities.map((activity, index) => (
                <Card key={activity.id || index} sx={{ boxShadow: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={getCategoryLabel(activity.category)}>
                          <IconButton size="small" color="primary">
                            {getCategoryIcon(activity.category)}
                          </IconButton>
                        </Tooltip>
                        <Typography variant="h6" component="span">
                          {activity.type}
                        </Typography>
                      </Box>
                      <Chip 
                        label={getStatusLabel(activity.status)} 
                        color={getStatusColor(activity.status) as any}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {activity.property}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {activity.time}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(activity.timestamp).toLocaleString('fr-FR')}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Box sx={{ mt: 3, p: 2, border: '1px solid #ccc', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {activities && activities.length > 0 ? 'Aucun résultat trouvé' : 'Aucune activité trouvée'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {activities && activities.length > 0 
                  ? 'Aucune activité ne correspond à vos critères de recherche.' 
                  : 'Aucune activité n\'a été enregistrée pour le moment.'
                }
              </Typography>
            </Box>
          )}
      </Box>
    </Box>
  );
}
