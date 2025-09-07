import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, Chip, Grid, Divider } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { TokenHealthMonitor } from './TokenHealthMonitor';

const PermissionDemo: React.FC = () => {
  const { hasPermissionAsync } = useAuth();
  
  // États pour les permissions
  const [permissions, setPermissions] = useState({
    'properties:view': false,
    'properties:create': false,
    'users:manage': false,
    'teams:view': false
  });

  // Vérifier toutes les permissions au chargement
  useEffect(() => {
    const checkAllPermissions = async () => {
      const perms = await Promise.all([
        hasPermissionAsync('properties:view'),
        hasPermissionAsync('properties:create'),
        hasPermissionAsync('users:manage'),
        hasPermissionAsync('teams:view')
      ]);
      
      setPermissions({
        'properties:view': perms[0],
        'properties:create': perms[1],
        'users:manage': perms[2],
        'teams:view': perms[3]
      });
    };
    
    checkAllPermissions();
  }, [hasPermissionAsync]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Moniteur de santé des tokens */}
      <TokenHealthMonitor />
      
      <Divider sx={{ my: 3 }} />
      
      {/* Démonstration des permissions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🧪 Démonstration des Permissions
          </Typography>
          
          <Typography variant="body2" color="info" sx={{ mb: 2 }}>
            💡 Les permissions sont récupérées directement depuis Redis !
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Accès aux fonctionnalités :
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="Propriétés"
                    size="small"
                    color={permissions['properties:view'] ? 'success' : 'default'}
                    variant={permissions['properties:view'] ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {permissions['properties:view'] ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="Créer propriété"
                    size="small"
                    color={permissions['properties:create'] ? 'success' : 'default'}
                    variant={permissions['properties:create'] ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {permissions['properties:create'] ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="Gérer utilisateurs"
                    size="small"
                    color={permissions['users:manage'] ? 'success' : 'default'}
                    variant={permissions['users:manage'] ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {permissions['users:manage'] ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="Voir équipes"
                    size="small"
                    color={permissions['teams:view'] ? 'success' : 'default'}
                    variant={permissions['teams:view'] ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {permissions['teams:view'] ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Actions conditionnelles :
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {permissions['properties:create'] && (
                  <Button variant="contained" color="primary" size="small">
                    ➕ Créer une propriété
                  </Button>
                )}
                
                {permissions['users:manage'] && (
                  <Button variant="contained" color="secondary" size="small">
                    👥 Gérer les utilisateurs
                  </Button>
                )}
                
                {permissions['teams:view'] && (
                  <Button variant="outlined" color="primary" size="small">
                    👥 Voir les équipes
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
          
          {/* Note sur l'architecture */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="caption" color="success.contrastText">
              🚀 <strong>Architecture moderne :</strong> Cette page démontre l'utilisation 
              de Redis pour les permissions et d'un système d'événements réactif pour la santé des tokens !
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PermissionDemo;
