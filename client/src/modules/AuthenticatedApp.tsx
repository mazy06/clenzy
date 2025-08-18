import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayoutFull from './layout/MainLayoutFull';
import Dashboard from './dashboard/Dashboard';
import PropertiesList from './properties/PropertiesList';
import ServiceRequestsList from './service-requests/ServiceRequestsList';
import InterventionsList from './interventions/InterventionsList';
import TeamsList from './teams/TeamsList';
import Settings from './settings/Settings';

const AuthenticatedApp: React.FC = () => {
  return (
    <MainLayoutFull>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/properties" element={<PropertiesList />} />
        <Route path="/service-requests" element={<ServiceRequestsList />} />
        <Route path="/interventions" element={<InterventionsList />} />
        <Route path="/teams" element={<TeamsList />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayoutFull>
  );
};

export default AuthenticatedApp;
