import React from 'react';
import AccessDenied from '../AccessDenied';

const UsersAccessDenied: React.FC = () => {
  return (
    <AccessDenied
      requiredPermission="users:manage"
      moduleName="Utilisateurs"
      moduleDescription="Le module des utilisateurs vous permet de gérer l'ensemble des comptes utilisateurs de la plateforme, incluant la création, la modification des rôles et la gestion des permissions d'accès."
    />
  );
};

export default UsersAccessDenied;
