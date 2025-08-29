import React from 'react';
import { Navigate } from 'react-router-dom';

const SmartRedirect: React.FC = () => {
  // Redirection simple vers le dashboard
  return <Navigate to="/dashboard" replace />;
};

export default SmartRedirect;
