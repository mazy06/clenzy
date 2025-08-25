import React from 'react';
import { Box, Card, CardContent, Typography, Button, Chip, Grid } from '@mui/material';
import { usePermissions } from '../hooks/usePermissions';

const PermissionDemo: React.FC = () => {
  const { hasPermission, isCustomMode } = usePermissions();

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🧪 Démonstration des Permissions
          </Typography>
          
          {isCustomMode && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              ⚠️ Mode personnalisé activé - Les permissions sont modifiées en temps réel !
            </Typography>
          )}

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
                    color={hasPermission('properties:view') ? 'success' : 'default'}
                    variant={hasPermission('properties:view') ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {hasPermission('properties:view') ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="Créer propriété"
                    size="small"
                    color={hasPermission('properties:create') ? 'success' : 'default'}
                    variant={hasPermission('properties:create') ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {hasPermission('properties:create') ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="Gérer utilisateurs"
                    size="small"
                    color={hasPermission('users:manage') ? 'success' : 'default'}
                    variant={hasPermission('users:manage') ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {hasPermission('users:manage') ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="Voir équipes"
                    size="small"
                    color={hasPermission('teams:view') ? 'success' : 'default'}
                    variant={hasPermission('teams:view') ? 'filled' : 'outlined'}
                  />
                  <Typography variant="body2">
                    {hasPermission('teams:view') ? '✅ Accessible' : '❌ Inaccessible'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Actions conditionnelles :
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {hasPermission('properties:create') && (
                  <Button variant="contained" color="primary" size="small">
                    ➕ Créer une propriété
                  </Button>
                )}
                
                {hasPermission('users:manage') && (
                  <Button variant="contained" color="secondary" size="small">
                    👥 Gérer les utilisateurs
                  </Button>
                )}
                
                {hasPermission('teams:view') && (
                  <Button variant="outlined" color="primary" size="small">
                    👥 Voir les équipes
                  </Button>
                )}
                
                {!hasPermission('properties:view') && (
                  <Typography variant="body2" color="error">
                    ⚠️ Vous n'avez pas accès aux propriétés
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            💡 Ce composant se met à jour automatiquement selon vos permissions actuelles !
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PermissionDemo;
