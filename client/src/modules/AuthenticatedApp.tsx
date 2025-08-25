import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayoutFull from './layout/MainLayoutFull';
import Dashboard from './dashboard/Dashboard';
import ActivitiesPage from './dashboard/ActivitiesPage';
import PropertiesList from './properties/PropertiesList';
import PropertyCreate from './properties/PropertyCreate';
import PropertyDetails from './properties/PropertyDetails';
import PropertyEdit from './properties/PropertyEdit';
import ServiceRequestsList from './service-requests/ServiceRequestsList';
import ServiceRequestCreate from './service-requests/ServiceRequestCreate';
import ServiceRequestDetails from './service-requests/ServiceRequestDetails';
import ServiceRequestEdit from './service-requests/ServiceRequestEdit';
import InterventionsList from './interventions/InterventionsList';
import InterventionCreate from './interventions/InterventionCreate';
import InterventionDetails from './interventions/InterventionDetails';
import InterventionEdit from './interventions/InterventionEdit';
import TeamsList from './teams/TeamsList';
import TeamForm from './teams/TeamForm';
import TeamDetails from './teams/TeamDetails';
import TeamEdit from './teams/TeamEdit';
import UsersList from './users/UsersList';
import UserForm from './users/UserForm';
import UserDetails from './users/UserDetails';
import UserEdit from './users/UserEdit';
import Settings from './settings/Settings';
import PermissionConfig from '../components/PermissionConfig';
import ProtectedRoute from '../components/ProtectedRoute';
import Reports from './reports/Reports';
import { useAuth } from '../hooks/useAuth';

// Composant de redirection intelligente
const SmartRedirect: React.FC = () => {
  const { hasPermissionSync } = useAuth();
  
  // Définir l'ordre de priorité des pages selon les permissions
  const priorityPages = [
    { path: '/dashboard', permission: 'dashboard:view' },
    { path: '/properties', permission: 'properties:view' },
    { path: '/service-requests', permission: 'service-requests:view' },
    { path: '/interventions', permission: 'interventions:view' },
    { path: '/teams', permission: 'teams:view' },
    { path: '/reports', permission: 'reports:view' },
    { path: '/settings', permission: 'settings:view' }
  ];
  
  // Trouver la première page accessible
  for (const page of priorityPages) {
    if (hasPermissionSync(page.permission)) {
      return <Navigate to={page.path} replace />;
    }
  }
  
  // Fallback vers la page d'accueil si aucune page n'est accessible
  return <Navigate to="/" replace />;
};

const AuthenticatedApp: React.FC = () => {
  return (
    <MainLayoutFull>
      <Routes>
        <Route path="/dashboard" element={
          <ProtectedRoute requiredPermission="dashboard:view">
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/activities" element={
          <ProtectedRoute requiredPermission="dashboard:view">
            <ActivitiesPage />
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
            <ServiceRequestCreate />
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
            <InterventionCreate />
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
        {/* Redirection intelligente vers la première page accessible selon les permissions */}
        <Route path="/" element={<SmartRedirect />} />
      </Routes>
    </MainLayoutFull>
  );
};

export default AuthenticatedApp;
