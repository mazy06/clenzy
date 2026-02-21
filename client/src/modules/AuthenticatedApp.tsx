import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import SmartRedirect from '../components/SmartRedirect';

// Pages principales
import Dashboard from './dashboard/Dashboard';
import PropertiesList from './properties/PropertiesList';
import PropertyCreate from './properties/PropertyCreate';
import PropertyDetails from './properties/PropertyDetails';
import PropertyEdit from './properties/PropertyEdit';

// Service requests
import ServiceRequestsList from './service-requests/ServiceRequestsList';
import ServiceRequestCreate from './service-requests/ServiceRequestCreate';
import ServiceRequestDetails from './service-requests/ServiceRequestDetails';
import ServiceRequestEdit from './service-requests/ServiceRequestEdit';

// Interventions
import InterventionsList from './interventions/InterventionsList';
import InterventionForm from './interventions/InterventionForm';
import InterventionDetails from './interventions/InterventionDetails';
import InterventionEdit from './interventions/InterventionEdit';
import PaymentSuccess from './interventions/PaymentSuccess';
import PaymentCancel from './interventions/PaymentCancel';
import InterventionsPendingValidation from './interventions/InterventionsPendingValidation';
import InterventionsPendingPayment from './interventions/InterventionsPendingPayment';

// Teams
import TeamsList from './teams/TeamsList';
import TeamForm from './teams/TeamForm';
import TeamDetails from './teams/TeamDetails';
import TeamEdit from './teams/TeamEdit';

// Reports
import Reports from './reports/Reports';
import ReportDetails from './reports/ReportDetails';
import ErrorBoundary from '../components/ErrorBoundary';

// Users
import UsersAndOrganizations from './users/UsersAndOrganizations';
import UserForm from './users/UserForm';
import UserDetails from './users/UserDetails';
import UserEdit from './users/UserEdit';

// Settings
import Settings from './settings/Settings';

// Tarification
import Tarification from './tarification/Tarification';

// Permissions
import PermissionConfig from '../components/PermissionConfig';

// Contact
import ContactPage from './contact/ContactPage';
import ContactCreatePage from './contact/ContactCreatePage';

// Documents
import DocumentsPage from './documents/DocumentsPage';
import TemplateDetails from './documents/TemplateDetails';

// Profile
import UserProfilePage from './profile/UserProfilePage';

// Notifications
import NotificationsPage from './notifications/NotificationsPage';

// Calendar
import CalendarPage from './calendar/CalendarPage';

// Portfolios
import PortfoliosPage from './portfolios/PortfoliosPage';
import ClientPropertyAssignmentForm from './portfolios/ClientPropertyAssignmentForm';
import TeamUserAssignmentForm from './portfolios/TeamUserAssignmentForm';

// Payments
import PaymentHistoryPage from './payments/PaymentHistoryPage';

// Admin pages
import TokenMonitoringPage from './admin/TokenMonitoringPage';
import MonitoringPage from './admin/MonitoringPage';
import SyncAdminPage from './admin/SyncAdminPage';


const AuthenticatedApp: React.FC = () => {
  return (
    <Routes>
      <Route path="/dashboard" element={
        <Dashboard />
      } />
        
        <Route path="/properties" element={
          <ProtectedRoute requiredPermission="properties:view">
            <ErrorBoundary>
              <PropertiesList />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/properties/new" element={
          <ProtectedRoute requiredPermission="properties:create">
            <ErrorBoundary>
              <PropertyCreate />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/properties/:id" element={
          <ProtectedRoute requiredPermission="properties:view">
            <ErrorBoundary>
              <PropertyDetails />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/properties/:id/edit" element={
          <ProtectedRoute requiredPermission="properties:edit">
            <ErrorBoundary>
              <PropertyEdit />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        
        <Route path="/service-requests" element={
          <ProtectedRoute requiredPermission="service-requests:view">
            <ErrorBoundary>
              <ServiceRequestsList />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/service-requests/new" element={
          <ProtectedRoute requiredPermission="service-requests:create">
            <ErrorBoundary>
              <ServiceRequestCreate />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/service-requests/:id" element={
          <ProtectedRoute requiredPermission="service-requests:view">
            <ErrorBoundary>
              <ServiceRequestDetails />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/service-requests/:id/edit" element={
          <ProtectedRoute requiredPermission="service-requests:edit">
            <ErrorBoundary>
              <ServiceRequestEdit />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        
        <Route path="/interventions" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <ErrorBoundary>
              <InterventionsList />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/interventions/new" element={
          <ProtectedRoute requiredPermission="interventions:create">
            <ErrorBoundary>
              <InterventionForm />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/interventions/:id" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <ErrorBoundary>
              <InterventionDetails />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/interventions/:id/edit" element={
          <ProtectedRoute requiredPermission="interventions:edit">
            <ErrorBoundary>
              <InterventionEdit />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/interventions/payment/success" element={
          <PaymentSuccess />
        } />
        <Route path="/interventions/payment/cancel" element={
          <PaymentCancel />
        } />
        <Route path="/interventions/pending-validation" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <ErrorBoundary>
              <InterventionsPendingValidation />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/interventions/pending-payment" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <ErrorBoundary>
              <InterventionsPendingPayment />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/payments/history" element={
          <ProtectedRoute requiredPermission="payments:view">
            <PaymentHistoryPage />
          </ProtectedRoute>
        } />

        <Route path="/calendar" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <CalendarPage />
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
        <Route path="/reports/:type" element={
          <ProtectedRoute requiredPermission="reports:view">
            <ErrorBoundary>
              <ReportDetails />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        
        <Route path="/users" element={
          <ProtectedRoute requiredPermission="users:manage">
            <UsersAndOrganizations />
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

        <Route path="/tarification" element={
          <ProtectedRoute requiredPermission="tarification:view">
            <Tarification />
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

        <Route path="/documents" element={
          <ProtectedRoute requiredPermission="documents:view">
            <ErrorBoundary>
              <DocumentsPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/documents/templates/:id" element={
          <ProtectedRoute requiredPermission="documents:view">
            <ErrorBoundary>
              <TemplateDetails />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <UserProfilePage />
        } />

        <Route path="/notifications" element={
          <NotificationsPage />
        } />
        
        <Route path="/portfolios" element={
          <ProtectedRoute requiredPermission="portfolios:view">
            <PortfoliosPage />
          </ProtectedRoute>
        } />
        <Route path="/portfolios/client-assignment" element={
          <ProtectedRoute requiredPermission="portfolios:manage">
            <ClientPropertyAssignmentForm />
          </ProtectedRoute>
        } />
        <Route path="/portfolios/team-assignment" element={
          <ProtectedRoute requiredPermission="portfolios:manage">
            <TeamUserAssignmentForm />
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

        <Route path="/admin/sync" element={
          <ProtectedRoute requiredPermission="users:manage">
            <ErrorBoundary>
              <SyncAdminPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Redirection intelligente vers la première page accessible selon les permissions */}
        <Route path="/" element={<SmartRedirect />} />
      </Routes>
  );
};

export default AuthenticatedApp;
