import React from 'react';
import { Box, alpha } from '@mui/material';
import {
  RoleSuperAdmin,
  RoleSuperManager,
  RoleSupervisor,
  RoleTechnician,
  RoleHousekeeper,
  RoleLaundry,
  RoleExteriorTech,
  RoleHost,
} from '../../../icons';
import { semanticToHex } from '../../../utils/statusUtils';
import type { ChipColor } from '../../../types';

/**
 * Single source of truth for the user-role catalog: label, icon, accent color, description.
 *
 * Why centralised:
 * <ul>
 *   <li>Stops icon duplication across the role selector (formerly Wrench appeared for both
 *       Technicien and Tech. Exterieur, Sparkles for both Agent de menage and Blanchisserie).</li>
 *   <li>SRP — the page components consume the catalog, they don't decide what each role looks like.</li>
 *   <li>OCP — adding a role is a one-line change here, no edit in callers.</li>
 * </ul>
 */
export interface UserRoleEntry {
  value: string;
  label: string;
  icon: React.ReactElement;
  /** MUI-style chip color used by status chips elsewhere. */
  color: ChipColor;
  /** Hex equivalent (derived from {@link ChipColor}) used by icon badges. */
  hex: string;
  description: string;
}

// We build the catalog at module init so the icon refs are stable across renders.
// `IconCmp` is typed loosely: Lucide's prop signature differs from MUI icons but both
// accept size + strokeWidth.
function entry(
  value: string,
  label: string,
  IconCmp: React.ComponentType<any>,
  color: ChipColor,
  description: string,
): UserRoleEntry {
  return {
    value,
    label,
    icon: <IconCmp size={16} strokeWidth={1.75} />,
    color,
    hex: semanticToHex(color),
    description,
  };
}

export const USER_ROLES: UserRoleEntry[] = [
  entry('SUPER_ADMIN',    'Super Admin',     RoleSuperAdmin,    'error',
        'Super administrateur avec acces complet multi-organisations'),
  entry('SUPER_MANAGER',  'Super Manager',   RoleSuperManager,  'secondary',
        'Super manager avec gestion etendue multi-equipes'),
  entry('SUPERVISOR',     'Superviseur',     RoleSupervisor,    'info',
        'Supervision des interventions et du personnel'),
  entry('TECHNICIAN',     'Technicien',      RoleTechnician,    'primary',
        'Execution des interventions techniques'),
  entry('HOUSEKEEPER',    'Agent de ménage', RoleHousekeeper,   'default',
        'Execution des interventions de nettoyage'),
  entry('LAUNDRY',        'Blanchisserie',   RoleLaundry,       'default',
        'Gestion du linge et de la blanchisserie'),
  entry('EXTERIOR_TECH',  'Tech. extérieur', RoleExteriorTech,  'primary',
        'Entretien des espaces exterieurs'),
  entry('HOST',           'Propriétaire',    RoleHost,          'success',
        'Gestion de ses propres proprietes'),
];

export function getRoleEntry(value: string | undefined | null): UserRoleEntry | undefined {
  if (!value) return undefined;
  return USER_ROLES.find((r) => r.value === value);
}

/**
 * Small colored square badge wrapping the role icon — gives a unique visual identity per role
 * in selectors, lists, and cards. Pattern aligned with the soft-chip palette used app-wide.
 */
export const RoleIconBadge: React.FC<{
  role: string;
  size?: number;
}> = ({ role, size = 24 }) => {
  const entry = getRoleEntry(role);
  if (!entry) return null;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 0.75,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(entry.hex, 0.14),
        color: entry.hex,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {entry.icon}
    </Box>
  );
};
