import React from 'react';
import AccessDenied from '../AccessDenied';

const ServiceRequestsAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="service-requests:view"
      moduleName="Demandes de Service"
      moduleDescription="Le module des demandes de service vous permet de créer, suivre et gérer les demandes d'intervention des propriétaires, incluant la planification, l'assignation aux équipes et le suivi de résolution."
    />
  );
};

export default ServiceRequestsAccessDenied;
