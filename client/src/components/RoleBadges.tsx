import React from 'react';
import { Box, Chip } from '@mui/material';

interface RoleBadgesProps {
  roles: string[];
}

export const RoleBadges: React.FC<RoleBadgesProps> = ({ roles }) => {
  // Log temporaire pour identifier le problème
  console.log('🔍 RoleBadges - Rendu avec roles:', roles);
  console.log('🔍 RoleBadges - Nombre de rôles:', roles.length);
  console.log('🔍 RoleBadges - Rôles individuels:', roles);
  
  // Déduplication simple et efficace
  const uniqueRoles = Array.from(new Set(roles));
  console.log('🔍 RoleBadges - Rôles uniques après Set:', uniqueRoles);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {uniqueRoles.map((role, index) => (
        <Chip
          key={`${role}-${index}`}
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
