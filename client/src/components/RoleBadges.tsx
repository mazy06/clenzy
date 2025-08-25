import React, { useMemo } from 'react';
import { Box, Chip } from '@mui/material';

interface RoleBadgesProps {
  roles: string[];
}

export const RoleBadges: React.FC<RoleBadgesProps> = ({ roles }) => {
  // Optimisation : mémoriser les rôles uniques pour éviter les recalculs
  const uniqueRoles = useMemo(() => {
    if (!roles || roles.length === 0) return [];
    return Array.from(new Set(roles));
  }, [roles]);

  // Si aucun rôle, ne rien afficher
  if (!uniqueRoles || uniqueRoles.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {uniqueRoles.map((role) => (
        <Chip
          key={role} // Utiliser le rôle comme clé unique au lieu de role-index
          label={role}
          size="small"
          color="secondary"
          variant="outlined"
        />
      ))}
    </Box>
  );
};

export default RoleBadges;
