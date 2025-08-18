import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRoles?: string[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRoles,
  fallbackPath = '/dashboard',
}) => {
  const { user, loading, hasPermission, hasAnyRole } = useAuth();

  console.log('🔍 ProtectedRoute - Rendu avec:', { 
    hasUser: !!user, 
    loading, 
    requiredPermission, 
    requiredRoles,
    userRoles: user?.roles 
  });

  if (loading) {
    console.log('🔍 ProtectedRoute - Affichage du chargement...');
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Vérification des permissions...
        </Typography>
      </Box>
    );
  }

  if (!user) {
    console.log('🔍 ProtectedRoute - Pas d\'utilisateur, redirection vers login');
    return <Navigate to="/login" replace />;
  }

  // Vérifier les permissions requises
  if (requiredPermission && !hasPermission(requiredPermission)) {
    console.log('🔍 ProtectedRoute - Permission manquante:', requiredPermission);
    return <Navigate to={fallbackPath} replace />;
  }

  // Vérifier les rôles requis
  if (requiredRoles && requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    console.log('🔍 ProtectedRoute - Rôle manquant:', requiredRoles);
    return <Navigate to={fallbackPath} replace />;
  }

  console.log('🔍 ProtectedRoute - Accès autorisé, rendu des enfants');
  return <>{children}</>;
};

export default ProtectedRoute;
