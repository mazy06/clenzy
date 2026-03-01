import React from 'react';
import { Navigate } from 'react-router-dom';

const SmartRedirect: React.FC = () => {
  // Redirection vers le planning (page d'accueil principale)
  return <Navigate to="/planning" replace />;
};

export default SmartRedirect;
