import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Chip, CircularProgress } from '@mui/material';
import { 
  Lock as LockIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  fallbackPath?: string;
  fallbackMessage?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  fallbackPath = '/',
  fallbackMessage
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Vérifier la permission de manière synchrone
  useEffect(() => {
    if (!requiredPermission) {
      setHasAccess(true);
      return;
    }

    if (!user) {
      setHasAccess(false);
      return;
    }

    console.log('🔍 ProtectedRoute - Vérification de permission:', {
      requiredPermission,
      user: user ? { id: user.id, roles: user.roles, permissions: user.permissions } : null,
      currentPath: location.pathname
    });

    // Vérification synchrone des permissions
    const hasPermission = user.permissions?.includes(requiredPermission) || false;
    
    console.log('🔍 ProtectedRoute - Résultat de la vérification:', {
      permission: requiredPermission,
      result: hasPermission,
      userPermissions: user?.permissions || []
    });
    
    setHasAccess(hasPermission);
  }, [requiredPermission, user?.id, user?.permissions, location.pathname]);

  // Si aucune permission n'est requise, afficher le composant
  if (!requiredPermission) {
    return <>{children}</>;
  }

  // Pendant la vérification, afficher un loader
  if (hasAccess === null) {
    return (
      <Box sx={{ 
        p: 4, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh'
      }}>
        <CircularProgress size={60} sx={{ mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Vérification des permissions...
        </Typography>
      </Box>
    );
  }

  // Vérifier la permission
  if (!hasAccess) {
    // Générer un message personnalisé selon la permission
    const getPermissionMessage = () => {
      if (fallbackMessage) return fallbackMessage;
      
      const permissionMap: { [key: string]: string } = {
        'dashboard:view': 'accéder au tableau de bord',
        'properties:view': 'consulter les propriétés',
        'properties:create': 'créer des propriétés',
        'properties:edit': 'modifier des propriétés',
        'properties:delete': 'supprimer des propriétés',
        'service-requests:view': 'consulter les demandes de service',
        'service-requests:create': 'créer des demandes de service',
        'service-requests:edit': 'modifier des demandes de service',
        'service-requests:delete': 'supprimer des demandes de service',
        'interventions:view': 'consulter les interventions',
        'interventions:create': 'créer des interventions',
        'interventions:edit': 'modifier des interventions',
        'interventions:delete': 'supprimer des interventions',
        'teams:view': 'consulter les équipes',
        'teams:create': 'créer des équipes',
        'teams:edit': 'modifier des équipes',
        'teams:delete': 'supprimer des équipes',
        'users:manage': 'gérer les utilisateurs',
        'settings:view': 'accéder aux paramètres',
        'settings:edit': 'modifier les paramètres',
        'reports:view': 'consulter les rapports'
      };
      
      return permissionMap[requiredPermission] || 'accéder à cette fonctionnalité';
    };

    // Déterminer la page de destination recommandée
    const getRecommendedPath = () => {
      if (fallbackPath !== '/') return fallbackPath;
      
      // Essayer de rediriger vers une page accessible selon les permissions de l'utilisateur
      const priorityPages = [
        { path: '/dashboard', permission: 'dashboard:view' },
        { path: '/properties', permission: 'properties:view' },
        { path: '/service-requests', permission: 'service-requests:view' },
        { path: '/interventions', permission: 'interventions:view' },
        { path: '/teams', permission: 'teams:view' },
        { path: '/reports', permission: 'reports:view' },
        { path: '/settings', permission: 'settings:view' }
      ];
      
      // Trouver la première page accessible
      for (const page of priorityPages) {
        if (user?.permissions?.includes(page.permission)) {
          return page.path;
        }
      }
      
      return '/'; // Fallback vers root si aucune page n'est accessible
    };

    const recommendedPath = getRecommendedPath();
    const permissionMessage = getPermissionMessage();

    return (
      <Box sx={{ 
        p: 4, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center'
      }}>
        {/* Icône de verrouillage */}
        <Box sx={{ 
          mb: 3,
          p: 2,
          borderRadius: '50%',
          bgcolor: 'grey.100',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <LockIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
        </Box>

        {/* Titre principal */}
        <Typography variant="h4" color="text.primary" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
          Accès restreint
        </Typography>

        {/* Message explicatif */}
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3, maxWidth: 500, fontWeight: 400 }}>
          Vous n'avez pas la permission de {permissionMessage}
        </Typography>

        {/* Détails techniques */}
        <Paper sx={{ 
          p: 3, 
          bgcolor: 'background.paper', 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          maxWidth: 500
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Permission requise : <strong>{requiredPermission}</strong>
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Page demandée : <strong>{location.pathname}</strong>
            </Typography>
          </Box>

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Votre rôle : 
              </Typography>
              {user.roles.map((role, index) => (
                <Chip 
                  key={index} 
                  label={role} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    );
  }

  // Permission accordée, afficher le composant
  return <>{children}</>;
};

export default ProtectedRoute;
