import React from 'react';
import AccessDenied from '../AccessDenied';

const TeamsAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="teams:view"
      moduleName="Équipes"
      moduleDescription="Le module des équipes vous permet de gérer l'organisation de vos équipes de maintenance, incluant la planification des interventions, la gestion des compétences et l'évaluation des performances."
    />
  );
};

export default TeamsAccessDenied;
