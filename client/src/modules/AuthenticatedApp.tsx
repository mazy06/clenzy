import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayoutFull from './layout/MainLayoutFull';
import Dashboard from './dashboard/Dashboard';
import PropertiesList from './properties/PropertiesList';
import PropertyForm from './properties/PropertyForm';
import PropertyEdit from './properties/PropertyEdit';
import PropertyDetails from './properties/PropertyDetails';
import ServiceRequestsList from './service-requests/ServiceRequestsList';
import ServiceRequestForm from './service-requests/ServiceRequestForm';
import ServiceRequestEdit from './service-requests/ServiceRequestEdit';
import ServiceRequestDetails from './service-requests/ServiceRequestDetails';
import InterventionsList from './interventions/InterventionsList';
import InterventionForm from './interventions/InterventionForm';
import InterventionEdit from './interventions/InterventionEdit';
import InterventionDetails from './interventions/InterventionDetails';
import TeamsList from './teams/TeamsList';
import TeamForm from './teams/TeamForm';
import UsersList from './users/UsersList';
import UserForm from './users/UserForm';
import UserDetails from './users/UserDetails';
import UserEdit from './users/UserEdit';
import Settings from './settings/Settings';

const AuthenticatedApp: React.FC = () => {
  return (
    <MainLayoutFull>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/properties" element={<PropertiesList />} />
        <Route path="/properties/:id" element={<PropertyDetails />} />
        <Route path="/properties/:id/edit" element={<PropertyEdit />} />
        <Route path="/service-requests" element={<ServiceRequestsList />} />
        <Route path="/service-requests/new" element={<ServiceRequestForm />} />
        <Route path="/service-requests/:id" element={<ServiceRequestDetails />} />
        <Route path="/service-requests/:id/edit" element={<ServiceRequestEdit />} />
        <Route path="/interventions" element={<InterventionsList />} />
        <Route path="/interventions/new" element={<InterventionForm />} />
        <Route path="/interventions/:id" element={<InterventionDetails />} />
        <Route path="/interventions/:id/edit" element={<InterventionEdit />} />
        <Route path="/teams" element={<TeamsList />} />
        <Route path="/teams/new" element={<TeamForm />} />
        <Route path="/users" element={<UsersList />} />
        <Route path="/users/new" element={<UserForm />} />
        <Route path="/users/:id" element={<UserDetails />} />
        <Route path="/users/:id/edit" element={<UserEdit />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayoutFull>
  );
};

export default AuthenticatedApp;
