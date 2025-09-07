import React from 'react';
import { Box, Container } from '@mui/material';
import TokenMonitoring from '../../components/TokenMonitoring';
import PageHeader from '../../components/PageHeader';

const TokenMonitoringPage: React.FC = () => {
  return (
    <Container maxWidth="xl">
      <PageHeader
        title="Monitoring des Tokens"
        subtitle="Surveillance des tokens JWT et gestion des sessions"
        backPath="/admin"
        showBackButton={false}
      />
      
      <Box mt={3}>
        <TokenMonitoring />
      </Box>
    </Container>
  );
};

export default TokenMonitoringPage;
