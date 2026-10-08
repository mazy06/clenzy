import React from 'react';
import { Alert, AlertDescription, Card, CardContent } from './ui';
import { Info } from '../icons/glyphs';
import { cn } from '../utils/cn';
import StatusChip from './StatusChip';
import { useTranslation } from '../hooks/useTranslation';
import {
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Assessment as AssessmentIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '../icons';

interface PermissionEffectsDemoProps {
  selectedRole?: string;
  rolePermissions?: {
    role: string;
    permissions: string[];
    isDefault: boolean;
  };
}

const PermissionEffectsDemo: React.FC<PermissionEffectsDemoProps> = ({ 
  selectedRole, 
  rolePermissions 
}) => {
  const { t } = useTranslation();

  // Si aucun rôle n'est sélectionné, afficher un message
  if (!selectedRole || !rolePermissions) {
    return (
      <div>
        <Alert variant="info">
          <Info />
          <AlertDescription>{t('permissions.selectRoleDemo')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fonction pour tester si une permission est active pour le rôle sélectionné
  const testPermission = (permission: string) => {
    return rolePermissions.permissions.includes(permission);
  };

  // Fonction pour obtenir l'état d'un menu selon les permissions
  const getMenuStatus = (requiredPermissions: string[]) => {
    const hasAccess = requiredPermissions.every(permission => testPermission(permission));
    return {
      accessible: hasAccess,
      status: hasAccess ? '✅ Accessible' : '❌ Inaccessible',
      color: hasAccess ? 'success' : 'error',
      reason: hasAccess
        ? t('permissionsDemo.allGranted')
        : t('permissionsDemo.missing', { list: requiredPermissions.filter(p => !testPermission(p)).join(', ') })
    };
  };

  const menuPermissions = [
    {
      id: 'dashboard',
      permissions: ['dashboard:view'],
      descriptionKey: 'permissionsDemo.modules.dashboard',
    },
    {
      id: 'properties',
      permissions: ['properties:view'],
      descriptionKey: 'permissionsDemo.modules.properties',
    },
    {
      id: 'service-requests',
      permissions: ['service-requests:view'],
      descriptionKey: 'permissionsDemo.modules.service-requests',
    },
    {
      id: 'interventions',
      permissions: ['interventions:view'],
      descriptionKey: 'permissionsDemo.modules.interventions',
    },
    {
      id: 'teams',
      permissions: ['teams:view'],
      descriptionKey: 'permissionsDemo.modules.teams',
    },
    {
      id: 'users',
      permissions: ['users:manage'],
      descriptionKey: 'permissionsDemo.modules.users',
    },
    {
      id: 'settings',
      permissions: ['settings:view'],
      descriptionKey: 'permissionsDemo.modules.settings',
    },
    {
      id: 'reports',
      permissions: ['reports:view'],
      descriptionKey: 'permissionsDemo.modules.reports',
    }
  ];

  // Helper function to get module icon
  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'dashboard':
        return <DashboardIcon size={20} strokeWidth={1.75} />;
      case 'properties':
        return <HomeIcon size={20} strokeWidth={1.75} />;
      case 'service-requests':
        return <AssignmentIcon size={20} strokeWidth={1.75} />;
      case 'interventions':
        return <BuildIcon size={20} strokeWidth={1.75} />;
      case 'teams':
        return <GroupIcon size={20} strokeWidth={1.75} />;
      case 'users':
        return <PersonIcon size={20} strokeWidth={1.75} />;
      case 'settings':
        return <SettingsIcon size={20} strokeWidth={1.75} />;
      case 'reports':
        return <AssessmentIcon size={20} strokeWidth={1.75} />;
      default:
        return <InfoIcon size={20} strokeWidth={1.75} />;
    }
  };

  return (
    <div>
      <div className="grid grid-cols-12 gap-3">
        {menuPermissions.map((menu) => {
          const status = getMenuStatus(menu.permissions);
          
          return (
            <div className="col-span-12 min-[1200px]:col-span-6" key={menu.id}>
              {/* Le liseré remplace l'anneau du primitif (`ring-0`) : c'est lui qui
                  porte l'etat accessible / inaccessible — teinte vive pour une
                  bordure, jamais l'encre `-ink`. */}
              <Card
                className={cn(
                  'h-full py-0 ring-0 border border-solid bg-card',
                  'transition-all duration-200 ease-out hover:-translate-y-[2px] hover:border-primary',
                  status.accessible ? 'border-success' : 'border-border',
                )}
              >
                <CardContent className="p-[15px]">
                  {/* En-tête avec icône et statut */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                      {getModuleIcon(menu.id)}
                    </div>
                    <div className="flex-1">
                      <h6 className="text-sm font-semibold mt-0 mb-0.5 text-foreground">
                        {t('permissionModules.' + menu.id)}
                      </h6>
                      <p className="text-xs m-0 text-muted-foreground leading-[1.4]">
                        {t(menu.descriptionKey)}
                      </p>
                    </div>
                    <StatusChip
                      tone={status.accessible ? 'ok' : 'err'}
                      label={status.accessible ? 'Accessible' : 'Inaccessible'}
                      className="min-w-20 shrink-0 justify-center"
                    />
                  </div>
                  
                  {/* Permissions requises */}
                  <div className="p-2 bg-card rounded-md mb-3 border border-solid border-border">
                    <span className="text-xs text-muted-foreground font-medium block mb-0.5">
                      Permissions requises
                    </span>
                    <p className="text-xs m-0 text-foreground font-medium font-mono">
                      {menu.permissions.join(', ')}
                    </p>
                  </div>
                  
                  {/* Raison du statut */}
                  {/* Bandeau -soft + hairline 30 % : le couple soft/ink du kit
                      remplace les nuances `.50` / `.200` / `.dark` de MUI. */}
                  <div
                    className={cn(
                      'p-[9px] rounded-md border border-solid',
                      status.accessible
                        ? 'bg-success-soft border-success/30'
                        : 'bg-destructive-soft border-destructive/30',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium',
                        status.accessible ? 'text-success-ink' : 'text-destructive-ink',
                      )}
                    >
                      {status.reason}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Résumé des accès */}
      <div className="mt-6">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 min-[900px]:col-span-6">
            <Card className="p-[15px] text-center ring-0 border-[1.5px] border-solid border-success bg-card">
              <h4 className="text-base font-bold tracking-tight mt-0 mb-1.5 text-success-ink tabular-nums">
                {rolePermissions.permissions.length}
              </h4>
              <p className="text-xs m-0 text-muted-foreground font-medium">
                Permissions actives
              </p>
            </Card>
          </div>

          <div className="col-span-12 min-[900px]:col-span-6">
            <Card
              className={cn(
                'p-[15px] text-center ring-0 border-[1.5px] border-solid bg-card',
                rolePermissions.isDefault ? 'border-success' : 'border-warning',
              )}
            >
              {/* Une icone lucide, jamais un emoji (interdit produit) : la teinte
                  vive est celle des icones, l'encre `-ink` restant au texte. */}
              <div
                className={cn(
                  'flex justify-center mb-1.5',
                  rolePermissions.isDefault ? 'text-success' : 'text-warning',
                )}
              >
                {rolePermissions.isDefault ? (
                  <CheckCircleIcon size={24} strokeWidth={1.75} aria-hidden />
                ) : (
                  <WarningIcon size={24} strokeWidth={1.75} aria-hidden />
                )}
              </div>
              <p className="text-xs m-0 text-muted-foreground font-medium">
                {rolePermissions.isDefault ? t('permissions.byDefault') : t('permissions.modified')}
              </p>
            </Card>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default PermissionEffectsDemo;
