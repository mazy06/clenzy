import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayoutFull from './layout/MainLayoutFull';
import ProtectedRoute from '../components/ProtectedRoute';
import SmartRedirect from '../components/SmartRedirect';

// Pages principales
import Dashboard from './dashboard/Dashboard';
import PropertiesList from './properties/PropertiesList';
import PropertyCreate from './properties/PropertyCreate';
import PropertyForm from './properties/PropertyForm';
import PropertyDetails from './properties/PropertyDetails';
import PropertyEdit from './properties/PropertyEdit';

// Service requests
import ServiceRequestsList from './service-requests/ServiceRequestsList';
import ServiceRequestForm from './service-requests/ServiceRequestForm';
import ServiceRequestDetails from './service-requests/ServiceRequestDetails';
import ServiceRequestEdit from './service-requests/ServiceRequestEdit';

// Interventions
import InterventionsList from './interventions/InterventionsList';
import InterventionForm from './interventions/InterventionForm';
import InterventionDetails from './interventions/InterventionDetails';
import InterventionEdit from './interventions/InterventionEdit';

// Teams
import TeamsList from './teams/TeamsList';
import TeamForm from './teams/TeamForm';
import TeamDetails from './teams/TeamDetails';
import TeamEdit from './teams/TeamEdit';

// Reports
import Reports from './reports/Reports';

// Users
import UsersList from './users/UsersList';
import UserForm from './users/UserForm';
import UserDetails from './users/UserDetails';
import UserEdit from './users/UserEdit';

// Settings
import Settings from './settings/Settings';

// Permissions
import PermissionConfig from '../components/PermissionConfig';

// Contact
import ContactPage from './contact/ContactPage';
import ContactCreatePage from './contact/ContactCreatePage';

// Portfolios
import PortfoliosPage from './portfolios/PortfoliosPage';

// Admin pages
import TokenMonitoringPage from './admin/TokenMonitoringPage';
import MonitoringPage from './admin/MonitoringPage';

const AuthenticatedApp: React.FC = () => {
  return (
    <MainLayoutFull>
      <Routes>
        <Route path="/dashboard" element={
          <ProtectedRoute requiredPermission="dashboard:view">
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/properties" element={
          <ProtectedRoute requiredPermission="properties:view">
            <PropertiesList />
          </ProtectedRoute>
        } />
        <Route path="/properties/new" element={
          <ProtectedRoute requiredPermission="properties:create">
            <PropertyCreate />
          </ProtectedRoute>
        } />
        <Route path="/properties/:id" element={
          <ProtectedRoute requiredPermission="properties:view">
            <PropertyDetails />
          </ProtectedRoute>
        } />
        <Route path="/properties/:id/edit" element={
          <ProtectedRoute requiredPermission="properties:edit">
            <PropertyEdit />
          </ProtectedRoute>
        } />
        
        <Route path="/service-requests" element={
          <ProtectedRoute requiredPermission="service-requests:view">
            <ServiceRequestsList />
          </ProtectedRoute>
        } />
        <Route path="/service-requests/new" element={
          <ProtectedRoute requiredPermission="service-requests:create">
            <ServiceRequestForm />
          </ProtectedRoute>
        } />
        <Route path="/service-requests/:id" element={
          <ProtectedRoute requiredPermission="service-requests:view">
            <ServiceRequestDetails />
          </ProtectedRoute>
        } />
        <Route path="/service-requests/:id/edit" element={
          <ProtectedRoute requiredPermission="service-requests:edit">
            <ServiceRequestEdit />
          </ProtectedRoute>
        } />
        
        <Route path="/interventions" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <InterventionsList />
          </ProtectedRoute>
        } />
        <Route path="/interventions/new" element={
          <ProtectedRoute requiredPermission="interventions:create">
            <InterventionForm />
          </ProtectedRoute>
        } />
        <Route path="/interventions/:id" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <InterventionDetails />
          </ProtectedRoute>
        } />
        <Route path="/interventions/:id/edit" element={
          <ProtectedRoute requiredPermission="interventions:edit">
            <InterventionEdit />
          </ProtectedRoute>
        } />
        
        <Route path="/teams" element={
          <ProtectedRoute requiredPermission="teams:view">
            <TeamsList />
          </ProtectedRoute>
        } />
        <Route path="/teams/new" element={
          <ProtectedRoute requiredPermission="teams:create">
            <TeamForm />
          </ProtectedRoute>
        } />
        <Route path="/teams/:id" element={
          <ProtectedRoute requiredPermission="teams:view">
            <TeamDetails />
          </ProtectedRoute>
        } />
        <Route path="/teams/:id/edit" element={
          <ProtectedRoute requiredPermission="teams:edit">
            <TeamEdit />
          </ProtectedRoute>
        } />
        
        <Route path="/reports" element={
          <ProtectedRoute requiredPermission="reports:view">
            <Reports />
          </ProtectedRoute>
        } />
        
        <Route path="/users" element={
          <ProtectedRoute requiredPermission="users:manage">
            <UsersList />
          </ProtectedRoute>
        } />
        <Route path="/users/new" element={
          <ProtectedRoute requiredPermission="users:manage">
            <UserForm />
          </ProtectedRoute>
        } />
        <Route path="/users/:id" element={
          <ProtectedRoute requiredPermission="users:manage">
            <UserDetails />
          </ProtectedRoute>
        } />
        <Route path="/users/:id/edit" element={
          <ProtectedRoute requiredPermission="users:manage">
            <UserEdit />
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute requiredPermission="settings:view">
            <Settings />
          </ProtectedRoute>
        } />
        
        <Route path="/permissions-test" element={
          <ProtectedRoute requiredPermission="users:manage">
            <PermissionConfig />
          </ProtectedRoute>
        } />
        
        <Route path="/contact" element={
          <ContactPage />
        } />
        <Route path="/contact/create" element={
          <ContactCreatePage />
        } />
        
        <Route path="/portfolios" element={
          <ProtectedRoute requiredPermission="portfolios:view">
            <PortfoliosPage />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/token-monitoring" element={
          <ProtectedRoute requiredPermission="users:manage">
            <TokenMonitoringPage />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/monitoring" element={
          <ProtectedRoute requiredPermission="users:manage">
            <MonitoringPage />
          </ProtectedRoute>
        } />
        
        {/* Redirection intelligente vers la première page accessible selon les permissions */}
        <Route path="/" element={<SmartRedirect />} />
      </Routes>
    </MainLayoutFull>
  );
};

export default AuthenticatedApp;
