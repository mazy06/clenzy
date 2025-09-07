import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';

interface CustomPermissionsContextType {
  customPermissions: Record<string, string[]>;
  isCustomMode: boolean;
  togglePermission: (role: string, permission: string) => void;
  resetRolePermissions: (role: string) => void;
  enableCustomMode: () => void;
  disableCustomMode: () => void;
  hasCustomPermission: (role: string, permission: string) => boolean;
}

export const CustomPermissionsContext = createContext<CustomPermissionsContextType | undefined>(undefined);

export const useCustomPermissions = () => {
  const context = useContext(CustomPermissionsContext);
  if (!context) {
    throw new Error('useCustomPermissions must be used within a CustomPermissionsProvider');
  }
  return context;
};

interface CustomPermissionsProviderProps {
  children: ReactNode;
}

export const CustomPermissionsProvider: React.FC<CustomPermissionsProviderProps> = ({ children }) => {
  const [customPermissions, setCustomPermissions] = useState<Record<string, string[]>>({});
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  const defaultRolePermissions: Record<string, string[]> = {
    ADMIN: [
      'dashboard:view',
      'properties:view', 'properties:create', 'properties:edit', 'properties:delete',
      'service-requests:view', 'service-requests:create', 'service-requests:edit', 'service-requests:delete',
      'interventions:view', 'interventions:create', 'interventions:edit', 'interventions:delete',
      'teams:view', 'teams:create', 'teams:edit', 'teams:delete',
      'portfolios:view', 'portfolios:manage',
      'settings:view', 'settings:edit',
      'users:manage',
      'reports:view',
    ],
    MANAGER: [
      'dashboard:view',
      'properties:view', 'properties:create', 'properties:edit',
      'service-requests:view', 'service-requests:create', 'service-requests:edit',
      'interventions:view', 'interventions:create', 'interventions:edit',
      'teams:view', 'teams:create', 'teams:edit',
      'portfolios:view', 'portfolios:manage',
      'settings:view',
      'users:view',
      'reports:view',
    ],
    HOST: [
      'dashboard:view',
      'properties:view', 'properties:create', 'properties:edit',
      'service-requests:view', 'service-requests:create',
      'interventions:view',
    ],
    TECHNICIAN: [
      'dashboard:view',
      'interventions:view', 'interventions:edit',
      'teams:view',
    ],
    HOUSEKEEPER: [
      'dashboard:view',
      'interventions:view', 'interventions:edit',
      'teams:view',
    ],
    SUPERVISOR: [
      'dashboard:view',
      'interventions:view', 'interventions:edit',
      'teams:view', 'teams:edit',
    ],
  };

  const togglePermission = useCallback((role: string, permission: string) => {
    setCustomPermissions(prev => {
      if (!prev[role]) {
        prev[role] = [...(defaultRolePermissions[role] || [])];
      }
      
      const currentPermissions = prev[role];
      if (currentPermissions.includes(permission)) {
        return {
          ...prev,
          [role]: currentPermissions.filter(p => p !== permission)
        };
      } else {
        return {
          ...prev,
          [role]: [...currentPermissions, permission]
        };
      }
    });
  }, []);

  const resetRolePermissions = useCallback((role: string) => {
    setCustomPermissions(prev => {
      const newPermissions = { ...prev };
      delete newPermissions[role];
      return newPermissions;
    });
  }, []);

  const enableCustomMode = useCallback(() => {
    setIsCustomMode(true);
    // Initialiser les permissions personnalisées avec les permissions par défaut du rôle de l'utilisateur
    // Pour l'instant, on utilise ADMIN par défaut
    const initialCustomPermissions: Record<string, string[]> = {};
    initialCustomPermissions['ADMIN'] = [...defaultRolePermissions['ADMIN']];
    setCustomPermissions(initialCustomPermissions);
  }, []);

  const disableCustomMode = useCallback(() => {
    setIsCustomMode(false);
    setCustomPermissions({});
  }, []);

  const hasCustomPermission = useCallback((role: string, permission: string) => {
    if (!isCustomMode || !customPermissions[role]) {
      return defaultRolePermissions[role]?.includes(permission) || false;
    }
    return customPermissions[role].includes(permission);
  }, [isCustomMode, customPermissions]);

  const value: CustomPermissionsContextType = {
    customPermissions,
    isCustomMode,
    togglePermission,
    resetRolePermissions,
    enableCustomMode,
    disableCustomMode,
    hasCustomPermission,
  };

  return React.createElement(
    CustomPermissionsContext.Provider,
    { value },
    children
  );
};
