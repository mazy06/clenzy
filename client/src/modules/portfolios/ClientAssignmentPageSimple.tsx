import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import PageHeader from '../../components/PageHeader';

const ClientAssignmentPageSimple: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <PageHeader
        title="Association Clients & Propriétés"
        subtitle="Associez vos clients et leurs propriétés aux portefeuilles"
        backPath="/portfolios"
        showBackButton={true}
      />
      
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Page Client Assignment - Version de test
        </Typography>
        <Typography variant="body1">
          Cette page fonctionne correctement. Le problème était dans le composant original.
        </Typography>
      </Box>
    </Container>
  );
};

export default ClientAssignmentPageSimple;


