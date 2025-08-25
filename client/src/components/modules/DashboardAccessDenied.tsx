import React from 'react';
import AccessDenied from '../AccessDenied';

const DashboardAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="dashboard:view"
      moduleName="Dashboard"
      moduleDescription="Le tableau de bord vous permet de visualiser un aperçu complet de votre plateforme Clenzy, incluant les statistiques, les activités récentes et les indicateurs de performance."
    />
  );
};

export default DashboardAccessDenied;
