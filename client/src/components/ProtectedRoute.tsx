import React, { useMemo } from 'react';
import { Badge } from './ui';
import { Card } from '../components/ui';

import {
  Lock as LockIcon
} from '../icons';
import { useLocation } from 'react-router-dom';
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
  const { user, loading } = useAuth();
  const location = useLocation();

  // Vérification synchrone — pas de useEffect, pas de state intermédiaire
  const hasAccess = useMemo(() => {
    if (!requiredPermission) return true;
    if (!user) return false;
    return user.permissions?.includes(requiredPermission) || false;
  }, [requiredPermission, user]);

  // Si aucune permission n'est requise, afficher directement
  if (!requiredPermission) {
    return <>{children}</>;
  }

  // Si l'auth est encore en cours de chargement, ne rien afficher (évite le flash)
  if (loading) {
    return null;
  }

  // Permission accordée → afficher le composant immédiatement
  if (hasAccess) {
    return <>{children}</>;
  }

  // Accès refusé → afficher la page d'erreur
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
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        {/* Icône de verrouillage */}
        <div className="mb-4 p-3 rounded-[50%] bg-[var(--hover)] flex items-center justify-center">
          <span className="inline-flex text-muted-foreground"><LockIcon size={32} strokeWidth={1.5} /></span>
        </div>

        {/* Titre principal */}
        <h4 className="cn-text-h4 text-foreground mb-[0.35em] font-medium mb-3">
          Accès restreint
        </h4>

        {/* Message explicatif */}
        <h6 className="cn-text-h6 text-muted-foreground mb-4 max-w-[500px] font-normal">
          Vous n'avez pas la permission de {permissionMessage}
        </h6>

        {/* Détails techniques */}
        <Card className="gap-0 py-0 p-4 bg-card border-border max-w-[500px]">
          <div className="flex items-center gap-1.5 mb-3 justify-center">
            <p className="cn-text-body2 text-muted-foreground">
              Permission requise : <strong>{requiredPermission}</strong>
            </p>
          </div>
          
          <div className="flex items-center gap-1.5 mb-3 justify-center">
            <p className="cn-text-body2 text-muted-foreground">
              Page demandée : <strong>{location.pathname}</strong>
            </p>
          </div>

          {user && (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <p className="cn-text-body2 text-muted-foreground">
                Votre rôle : 
              </p>
              {user.roles.map((role, index) => (
                <Badge variant="default" className="text-[0.75rem]" key={role}>{role}</Badge>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return null;
};

export default ProtectedRoute;
