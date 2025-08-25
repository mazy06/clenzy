import React from 'react';
import AccessDenied from '../AccessDenied';

const InterventionsAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="interventions:view"
      moduleName="Interventions"
      moduleDescription="Le module des interventions vous permet de planifier, organiser et suivre les interventions techniques et de maintenance sur vos propriétés, incluant la gestion des équipes et le suivi de performance."
    />
  );
};

export default InterventionsAccessDenied;
