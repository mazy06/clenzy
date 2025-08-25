import React from 'react';
import AccessDenied from '../AccessDenied';

const ReportsAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="reports:view"
      moduleName="Rapports"
      moduleDescription="Le module des rapports vous permet de générer et consulter des analyses détaillées de votre activité, incluant les statistiques financières, les performances des équipes et les indicateurs de qualité de service."
    />
  );
};

export default ReportsAccessDenied;
