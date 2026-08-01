import React from 'react';
import { Container } from '@mui/material';
import { Shield } from '../../icons';
import TokenMonitoring from '../../components/TokenMonitoring';
import PageHeader from '../../components/PageHeader';

const TokenMonitoringPage: React.FC = () => {
  return (
    <Container maxWidth="xl">
      <PageHeader
        title="Monitoring des Tokens"
        subtitle="Surveillance des tokens JWT et gestion des sessions"
        iconBadge={<Shield />}
        backPath="/admin"
        showBackButton={false}
      />
      
      <div className="mt-[18px]">
        <TokenMonitoring />
      </div>
    </Container>
  );
};

export default TokenMonitoringPage;
