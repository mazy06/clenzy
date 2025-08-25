import React from 'react';
import AccessDenied from '../AccessDenied';

const SettingsAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="settings:view"
      moduleName="Paramètres"
      moduleDescription="Le module des paramètres vous permet de configurer votre plateforme Clenzy, incluant les préférences d'affichage, les notifications, la sécurité et la configuration de votre entreprise."
    />
  );
};

export default SettingsAccessDenied;
