import React from 'react';
import { Alert, AlertDescription, Card, CardContent } from './ui';
import { Info } from 'lucide-react';
import { cn } from '../utils/cn';
import StatusChip from './StatusChip';
import {
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Assessment as AssessmentIcon,
  Info as InfoIcon
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

  // Si aucun rôle n'est sélectionné, afficher un message
  if (!selectedRole || !rolePermissions) {
    return (
      <div>
        <Alert variant="info">
          <Info />
          <AlertDescription>Veuillez sélectionner un rôle pour voir la démonstration des effets</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fonction pour tester si une permission est active pour le rôle sélectionné
  const testPermission = (permission: string) => {
    return rolePermissions.permissions.includes(permission);
  };

  // Fonction pour obtenir l'état d'un menu selon les permissions
  const getMenuStatus = (menuName: string, requiredPermissions: string[]) => {
    const hasAccess = requiredPermissions.every(permission => testPermission(permission));
    return {
      accessible: hasAccess,
      status: hasAccess ? '✅ Accessible' : '❌ Inaccessible',
      color: hasAccess ? 'success' : 'error',
      reason: hasAccess ? 'Toutes les permissions requises sont accordées' : `Permissions manquantes: ${requiredPermissions.filter(p => !testPermission(p)).join(', ')}`
    };
  };

  const menuPermissions = [
    {
      name: 'Tableau de Bord',
      permissions: ['dashboard:view'],
      description: 'Vue d\'ensemble de l\'activité'
    },
    {
      name: 'Propriétés',
      permissions: ['properties:view'],
      description: 'Gestion des propriétés'
    },
    {
      name: 'Demandes de Service',
      permissions: ['service-requests:view'],
      description: 'Gestion des demandes de service'
    },
    {
      name: 'Interventions',
      permissions: ['interventions:view'],
      description: 'Gestion des interventions'
    },
    {
      name: 'Équipes',
      permissions: ['teams:view'],
      description: 'Gestion des équipes'
    },
    {
      name: 'Utilisateurs',
      permissions: ['users:manage'],
      description: 'Gestion des utilisateurs (Admin uniquement)'
    },
    {
      name: 'Paramètres',
      permissions: ['settings:view'],
      description: 'Configuration du système'
    },
    {
      name: 'Rapports',
      permissions: ['reports:view'],
      description: 'Génération de rapports'
    }
  ];

  // Helper function to get module icon
  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'Tableau de Bord':
        return <DashboardIcon size={20} strokeWidth={1.75} />;
      case 'Propriétés':
        return <HomeIcon size={20} strokeWidth={1.75} />;
      case 'Demandes de Service':
        return <AssignmentIcon size={20} strokeWidth={1.75} />;
      case 'Interventions':
        return <BuildIcon size={20} strokeWidth={1.75} />;
      case 'Équipes':
        return <GroupIcon size={20} strokeWidth={1.75} />;
      case 'Utilisateurs':
        return <PersonIcon size={20} strokeWidth={1.75} />;
      case 'Paramètres':
        return <SettingsIcon size={20} strokeWidth={1.75} />;
      case 'Rapports':
        return <AssessmentIcon size={20} strokeWidth={1.75} />;
      default:
        return <InfoIcon size={20} strokeWidth={1.75} />;
    }
  };

  return (
    <div>
      <div className="grid grid-cols-12 gap-3">
        {menuPermissions.map((menu) => {
          const status = getMenuStatus(menu.name, menu.permissions);
          
          return (
            <div className="col-span-12 min-[1200px]:col-span-6" key={menu.name}>
              {/* Le liseré remplace l'anneau du primitif (`ring-0`) : c'est lui qui
                  porte l'etat accessible / inaccessible. `grey.300` n'ayant pas
                  d'equivalent direct, il devient la hairline forte --line-2. */}
              <Card
                className={cn(
                  'h-full py-0 ring-0 border border-solid bg-[var(--card)]',
                  'transition-all duration-200 ease-out hover:-translate-y-[2px] hover:border-[var(--mui-primary)]',
                  status.accessible ? 'border-[var(--ok)]' : 'border-[var(--line-2)]',
                )}
              >
                <CardContent className="p-[15px]">
                  {/* En-tête avec icône et statut */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-[var(--hover)] rounded-[8px] flex items-center justify-center text-muted-foreground">
                      {getModuleIcon(menu.name)}
                    </div>
                    <div className="flex-1">
                      <h6 className="cn-text-h6 font-semibold text-foreground mb-0.5">
                        {menu.name}
                      </h6>
                      <p className="cn-text-body2 text-muted-foreground leading-[1.4]">
                        {menu.description}
                      </p>
                    </div>
                    <StatusChip
                      tone={status.accessible ? 'ok' : 'err'}
                      label={status.accessible ? 'Accessible' : 'Inaccessible'}
                      className="min-w-20 shrink-0 justify-center"
                    />
                  </div>
                  
                  {/* Permissions requises */}
                  <div className="p-2 bg-[var(--surface-2)] rounded-[8px] mb-3 border border-[var(--line)]">
                    <span className="cn-text-caption text-muted-foreground font-medium block mb-0.5">
                      Permissions requises
                    </span>
                    <p className="cn-text-body2 text-foreground font-medium font-mono">
                      {menu.permissions.join(', ')}
                    </p>
                  </div>
                  
                  {/* Raison du statut */}
                  {/* Bandeau -soft + hairline 30 % : le couple soft/ink du kit
                      remplace les nuances `.50` / `.200` / `.dark` de MUI. */}
                  <div
                    className={cn(
                      'p-[9px] rounded-[8px] border border-solid',
                      status.accessible
                        ? 'bg-[var(--bui-success-soft)] border-[color-mix(in_srgb,var(--bui-success)_30%,transparent)]'
                        : 'bg-[var(--bui-destructive-soft)] border-[color-mix(in_srgb,var(--bui-destructive)_30%,transparent)]',
                    )}
                  >
                    <span
                      className={cn(
                        'cn-text-caption font-medium',
                        status.accessible
                          ? 'text-[var(--bui-success-ink)]'
                          : 'text-[var(--bui-destructive-ink)]',
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
            <Card className="p-[15px] text-center ring-0 border-[1.5px] border-solid border-[var(--ok)] bg-[var(--card)]">
              <h4 className="cn-text-h4 text-[var(--bui-success-ink)] font-bold mb-1.5">
                {rolePermissions.permissions.length}
              </h4>
              <p className="cn-text-body2 text-muted-foreground font-medium">
                Permissions actives
              </p>
            </Card>
          </div>
          
          <div className="col-span-12 min-[900px]:col-span-6">
            <Card
              className={cn(
                'p-[15px] text-center ring-0 border-[1.5px] border-solid bg-[var(--card)]',
                rolePermissions.isDefault ? 'border-[var(--ok)]' : 'border-[var(--warn)]',
              )}
            >
              <h4
                className={cn(
                  'cn-text-h4 font-bold mb-1.5',
                  rolePermissions.isDefault ? 'text-[var(--ok)]' : 'text-[var(--warn)]',
                )}
              >
                {rolePermissions.isDefault ? '✅' : '⚠️'}
              </h4>
              <p className="cn-text-body2 text-muted-foreground font-medium">
                {rolePermissions.isDefault ? 'Par défaut' : 'Modifié'}
              </p>
            </Card>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default PermissionEffectsDemo;
