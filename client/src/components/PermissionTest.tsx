import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Button,
  Divider
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';

const PermissionTest: React.FC = () => {
  const { user, hasPermission, hasRole } = useAuth();

  console.log('🔍 PermissionTest - Rendu du composant');
  console.log('🔍 PermissionTest - User:', user);
  console.log('🔍 PermissionTest - hasPermission function:', typeof hasPermission);
  console.log('🔍 PermissionTest - hasRole function:', typeof hasRole);

  // Toutes les permissions disponibles
  const allPermissions = [
    'dashboard:view',
    'properties:view', 'properties:create', 'properties:edit', 'properties:delete',
    'service-requests:view', 'service-requests:create', 'service-requests:edit', 'service-requests:delete',
    'interventions:view', 'interventions:create', 'interventions:edit', 'interventions:delete',
    'teams:view', 'teams:create', 'teams:edit', 'teams:delete',
    'settings:view', 'settings:edit',
    'users:manage',
    'reports:view',
  ];

  // Tous les rôles disponibles
  const allRoles = ['ADMIN', 'MANAGER', 'HOST', 'TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'];

  // Tester chaque permission
  const testPermission = (permission: string) => {
    try {
      return hasPermission(permission);
    } catch (error) {
      console.error(`🔍 PermissionTest - Erreur lors du test de la permission ${permission}:`, error);
      return false;
    }
  };

  // Tester chaque rôle
  const testRole = (role: string) => {
    try {
      return hasRole(role);
    } catch (error) {
      console.error(`🔍 PermissionTest - Erreur lors du test du rôle ${role}:`, error);
      return false;
    }
  };

  // Grouper les permissions par module
  const permissionsByModule = {
    'Dashboard': ['dashboard:view'],
    'Propriétés': ['properties:view', 'properties:create', 'properties:edit', 'properties:delete'],
    'Demandes de Service': ['service-requests:view', 'service-requests:create', 'service-requests:edit', 'service-requests:delete'],
    'Interventions': ['interventions:view', 'interventions:create', 'interventions:edit', 'interventions:delete'],
    'Équipes': ['teams:view', 'teams:create', 'teams:edit', 'teams:delete'],
    'Paramètres': ['settings:view', 'settings:edit'],
    'Utilisateurs': ['users:manage'],
    'Rapports': ['reports:view'],
  };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Aucun utilisateur connecté
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Test simple pour vérifier que le composant se rend */}
      <Alert severity="info" sx={{ mb: 3 }}>
        🎉 Le composant PermissionTest se rend correctement !
      </Alert>

      <Typography variant="h4" gutterBottom>
        🧪 Test des Permissions
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Utilisateur: {user.username} ({user.email})
      </Typography>

      {/* Informations utilisateur */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Informations Utilisateur
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                <strong>Rôles:</strong> {user.roles ? user.roles.join(', ') : 'Aucun rôle'}
              </Typography>
              <Typography variant="body2">
                <strong>Permissions:</strong> {user.permissions ? user.permissions.length : 0} permissions
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                <strong>ID:</strong> {user.id || 'Non défini'}
              </Typography>
              <Typography variant="body2">
                <strong>Nom d'utilisateur:</strong> {user.username || 'Non défini'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Test des rôles */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Test des Rôles
          </Typography>
          <Grid container spacing={1}>
            {allRoles.map((role) => (
              <Grid item key={role}>
                <Chip
                  label={role}
                  color={testRole(role) ? 'success' : 'default'}
                  variant={testRole(role) ? 'filled' : 'outlined'}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Test des permissions par module */}
      <Grid container spacing={3}>
        {Object.entries(permissionsByModule).map(([moduleName, permissions]) => (
          <Grid item xs={12} md={6} key={moduleName}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {moduleName}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {permissions.map((permission) => (
                    <Box key={permission} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={permission}
                        size="small"
                        color={testPermission(permission) ? 'success' : 'default'}
                        variant={testPermission(permission) ? 'filled' : 'outlined'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {testPermission(permission) ? '✅' : '❌'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Résumé des permissions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Résumé des Permissions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="body2">
                <strong>Total des permissions:</strong> {allPermissions.length}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2">
                <strong>Permissions accordées:</strong> {allPermissions.filter(testPermission).length}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2">
                <strong>Permissions refusées:</strong> {allPermissions.filter(p => !testPermission(p)).length}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PermissionTest;
