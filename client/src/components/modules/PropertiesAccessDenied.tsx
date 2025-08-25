import React from 'react';
import AccessDenied from '../AccessDenied';

const PropertiesAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="properties:view"
      moduleName="Propriétés"
      moduleDescription="Le module des propriétés vous permet de gérer l'ensemble de vos biens immobiliers, incluant les informations détaillées, les photos, l'état de maintenance et les interventions associées."
    />
  );
};

export default PropertiesAccessDenied;
