import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const ClientAssignmentPageMinimal: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 3 }}>
        <Typography variant="h4" gutterBottom>
          Client Assignment - Version Ultra Minimale
        </Typography>
        <Typography variant="body1">
          Cette page ne utilise aucun hook du tout - ni React Router, ni hooks personnalisés.
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Si cette page fonctionne, le problème vient des hooks utilisés dans les autres composants.
        </Typography>
      </Box>
    </Container>
  );
};

export default ClientAssignmentPageMinimal;
