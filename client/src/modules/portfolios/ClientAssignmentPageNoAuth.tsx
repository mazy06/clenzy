import React from 'react';
import { Container, Typography, Box, Paper, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ClientAssignmentPageNoAuth: React.FC = () => {
  const navigate = useNavigate();

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
          Client Assignment - Version No Auth
        </Typography>
      </Box>

      {/* Contenu principal */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Test sans authentification
          </Typography>
          <Typography variant="body1" paragraph>
            Cette page n'utilise aucun hook d'authentification, aucun layout, et aucun système de permissions.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Si cette page fonctionne, le problème vient du système d'authentification global.
          </Typography>
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button 
              variant="contained" 
              onClick={() => navigate('/dashboard')}
            >
              Aller au Dashboard
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/portfolios')}
            >
              Aller aux Portfolios
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default ClientAssignmentPageNoAuth;


