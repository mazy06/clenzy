import React from 'react';
import { Box, Typography } from '@mui/material';

const UltraSimpleAppWrapper: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Ultra Simple App Wrapper
      </Typography>
      <Typography variant="body1">
        Cette application évite complètement useAuth et tous les hooks complexes.
      </Typography>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Si vous voyez ce texte, le problème n'est PAS dans useAuth !
      </Typography>
    </Box>
  );
};

export default UltraSimpleAppWrapper;
