import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';

const ClientAssignmentPageStandalone: React.FC = () => {
  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: 'background.default',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header simple */}
      <Box sx={{ 
        bgcolor: 'primary.main', 
        color: 'primary.contrastText',
        p: 2,
        textAlign: 'center'
      }}>
        <Typography variant="h5">
          Client Assignment - Version Standalone
        </Typography>
      </Box>

      {/* Contenu principal */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Test de composant standalone
          </Typography>
          <Typography variant="body1" paragraph>
            Cette page ne utilise aucun layout, aucun hook personnalisé, et aucun système de permissions.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Si cette page fonctionne, le problème vient du layout principal ou des hooks d'authentification.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default ClientAssignmentPageStandalone;






