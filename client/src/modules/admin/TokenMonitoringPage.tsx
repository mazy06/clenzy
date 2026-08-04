import React from 'react';
import { Shield } from '../../icons';
import TokenMonitoring from '../../components/TokenMonitoring';
import PageHeader from '../../components/PageHeader';

const TokenMonitoringPage: React.FC = () => {
  return (
    // Report du `<Container maxWidth="xl">` : largeur bornee au breakpoint xl MUI
    // (1536 px) + gouttieres spacing(2)/spacing(3) — le theme fixe l'unite a 6 px.
    <div className="mx-auto w-full max-w-[1536px] px-3 min-[600px]:px-[18px]">
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
    </div>
  );
};

export default TokenMonitoringPage;
