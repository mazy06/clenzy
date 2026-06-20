import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import SmartRedirect from '../components/SmartRedirect';
import RouteFallback from '../components/RouteFallback';

// Pages : chargées en lazy (code-splitting par route). Chaque page + son sous-arbre devient un
// chunk séparé → sort le module booking-engine/studio et les dialogs paiements du bundle initial.
const Dashboard = lazy(() => import('./dashboard/Dashboard'));
const NotFoundPage = lazy(() => import('./NotFoundPage'));
const PropertiesPage = lazy(() => import('./properties/PropertiesPage'));
const PropertyCreate = lazy(() => import('./properties/PropertyCreate'));
const PropertyDetails = lazy(() => import('./properties/PropertyDetails'));
const PropertyEdit = lazy(() => import('./properties/PropertyEdit'));

// Service requests
const ServiceRequestCreate = lazy(() => import('./service-requests/ServiceRequestCreate'));
const ServiceRequestDetails = lazy(() => import('./service-requests/ServiceRequestDetails'));
const ServiceRequestEdit = lazy(() => import('./service-requests/ServiceRequestEdit'));

// Interventions & Work Orders (unified page with tabs)
const WorkOrdersPage = lazy(() => import('./work-orders/WorkOrdersPage'));
const InterventionForm = lazy(() => import('./interventions/InterventionForm'));
const InterventionDetails = lazy(() => import('./interventions/InterventionDetails'));
const InterventionEdit = lazy(() => import('./interventions/InterventionEdit'));
const PaymentSuccess = lazy(() => import('./interventions/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./interventions/PaymentCancel'));
const InterventionsPendingPayment = lazy(() => import('./interventions/InterventionsPendingPayment'));

// Teams
const TeamForm = lazy(() => import('./teams/TeamForm'));
const TeamDetails = lazy(() => import('./teams/TeamDetails'));
const TeamEdit = lazy(() => import('./teams/TeamEdit'));

// Directory (Annuaire — merged Teams + Portfolios + Guests)
const DirectoryPage = lazy(() => import('./directory/DirectoryPage'));

// Reports
const Reports = lazy(() => import('./reports/Reports'));
import ErrorBoundary from '../components/ErrorBoundary';

// Users
const UserForm = lazy(() => import('./users/UserForm'));
const UserDetails = lazy(() => import('./users/UserDetails'));
const UserEdit = lazy(() => import('./users/UserEdit'));

// Settings
const Settings = lazy(() => import('./settings/Settings'));

// Tarification
const Tarification = lazy(() => import('./tarification/Tarification'));

// Permissions
const PermissionConfig = lazy(() => import('../components/PermissionConfig'));

// Messagerie unifiée (hub : conversations · archives · formulaires reçus · OTA)
// — remplace l'ancienne ContactPage sur la route /contact (mêmes ?tab= legacy).
const MessagingHubPage = lazy(() => import('./messaging/MessagingHubPage'));
const ContactCreatePage = lazy(() => import('./contact/ContactCreatePage'));

// Documents
const DocumentsPage = lazy(() => import('./documents/DocumentsPage'));
// ConnectedObjectsHub : plus de route standalone — rendu comme onglet de PropertiesPage.
// /connected-objects redirige desormais vers /properties?tab=connected-objects.
const PropertyDevicesView = lazy(() => import('./connected-objects/PropertyDevicesView'));
const DeviceDetail = lazy(() => import('./connected-objects/DeviceDetail'));
const CamerasScreen = lazy(() => import('./connected-objects/cameras/CamerasScreen'));
const ThermostatsScreen = lazy(() => import('./connected-objects/thermostats/ThermostatsScreen'));
const TemplateDetails = lazy(() => import('./documents/TemplateDetails'));

// Notifications
const NotificationsPage = lazy(() => import('./notifications/NotificationsPage'));

// Calendar
const CalendarPage = lazy(() => import('./calendar/CalendarPage'));

// Portfolios (sub-routes only — main list is inside DirectoryPage)
const ClientPropertyAssignmentForm = lazy(() => import('./portfolios/ClientPropertyAssignmentForm'));
const TeamUserAssignmentForm = lazy(() => import('./portfolios/TeamUserAssignmentForm'));

// Billing (Payments + Invoices)
const BillingPage = lazy(() => import('./billing/BillingPage'));

// Reservations
const ReservationsList = lazy(() => import('./reservations/ReservationsList'));

// Planning
const PlanningPage = lazy(() => import('./planning/PlanningPage'));

// Guests (main list is inside DirectoryPage)

// Dynamic Pricing


// Admin pages
const TokenMonitoringPage = lazy(() => import('./admin/TokenMonitoringPage'));
const MonitoringPage = lazy(() => import('./admin/MonitoringPage'));
const SyncAdminPage = lazy(() => import('./admin/SyncAdminPage'));
const PromoCodesPage = lazy(() => import('./admin/PromoCodesPage'));
// VouchersPage est desormais monte comme tab dans PropertiesPage
// (cf. /properties?tab=vouchers). L'ancienne route /vouchers est conservee
// en redirection pour preserver les bookmarks.
const KpiReadinessPage = lazy(() => import('./admin/KpiReadinessPage'));
const DatabaseAdminPage = lazy(() => import('./admin/DatabaseAdminPage'));
const ExchangeRateHistoryPage = lazy(() => import('./admin/ExchangeRateHistoryPage'));

// Channels & Integrations
const ChannelsPage = lazy(() => import('./channels/ChannelsPage'));
const ReviewsPage = lazy(() => import('./channels/ReviewsPage'));
const GuestExperiencePage = lazy(() => import('./guest-experience/GuestExperiencePage'));
const StudioHome = lazy(() => import('./booking-engine/studio/StudioHome'));
const StudioPage = lazy(() => import('./booking-engine/studio/StudioPage'));

// Messaging — pages now merged into Documents module (redirected via Navigate)
// import MessageTemplatesPage from './messaging/MessageTemplatesPage';
// import MessageHistoryPage from './messaging/MessageHistoryPage';

// Channel Promotions
const ChannelPromotionsPage = lazy(() => import('./promotions/ChannelPromotionsPage'));

// AccountingPage import removed — tabs now embedded in BillingPage

// Owner Portal
const OwnerPortalPage = lazy(() => import('./owner-portal/OwnerPortalPage'));

// Automation Rules
const AutomationRulesPage = lazy(() => import('./automation/AutomationRulesPage'));

// Shop
const ShopPage = lazy(() => import('./shop/ShopPage'));

// Management Contracts
const ManagementContractsPage = lazy(() => import('./contracts/ManagementContractsPage'));

// InvoicesList import removed — now embedded in BillingPage


const AuthenticatedApp: React.FC = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/dashboard" element={
        <Dashboard />
      } />

        {/* Hub des objets connectés : integre comme onglet "connected-objects"
            dans Propriétés (conceptuellement lie aux biens). On garde un redirect
            pour les bookmarks et les "retour" des sous-ecrans (property/:id, noise,
            locks, keys, cameras, thermostats). */}
        <Route path="/connected-objects" element={<Navigate to="/properties?tab=connected-objects" replace />} />
        <Route path="/connected-objects/property/:id" element={
          <ErrorBoundary>
            <PropertyDevicesView />
          </ErrorBoundary>
        } />
        {/* Détail unifié d'un objet connecté (remplace les écrans de gestion par type). */}
        <Route path="/connected-objects/device/:kind/:id" element={
          <ErrorBoundary>
            <DeviceDetail />
          </ErrorBoundary>
        } />
        {/* Anciens écrans de gestion par type → remplacés par le détail unifié
            (/connected-objects/device/:kind/:id). Redirect des bookmarks. */}
        <Route path="/connected-objects/noise" element={<Navigate to="/properties?tab=connected-objects" replace />} />
        <Route path="/connected-objects/locks" element={<Navigate to="/properties?tab=connected-objects" replace />} />
        <Route path="/connected-objects/keys" element={<Navigate to="/properties?tab=connected-objects" replace />} />
        {/* Aperçus Phase 2 (UI-first — données simulées) */}
        <Route path="/connected-objects/cameras" element={
          <ErrorBoundary>
            <CamerasScreen />
          </ErrorBoundary>
        } />
        <Route path="/connected-objects/thermostats" element={
          <ErrorBoundary>
            <ThermostatsScreen />
          </ErrorBoundary>
        } />

        {/* Assistant : page dediee supprimee (remplacee par le widget bulle +
            plein ecran accessible partout). Redirects pour les anciens bookmarks
            et la typo courante. */}
        <Route path="/assistant" element={<Navigate to="/dashboard" replace />} />
        <Route path="/assitant" element={<Navigate to="/dashboard" replace />} />

        <Route path="/properties" element={
          <ErrorBoundary>
            <PropertiesPage />
          </ErrorBoundary>
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
        
        <Route path="/service-requests" element={<Navigate to="/interventions?tab=service-requests" replace />} />
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
          <ErrorBoundary>
            <WorkOrdersPage />
          </ErrorBoundary>
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
        <Route path="/interventions/pending-payment" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <ErrorBoundary>
              <InterventionsPendingPayment />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/reservations" element={
          <ProtectedRoute requiredPermission="reservations:view">
            <ErrorBoundary>
              <ReservationsList />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/planning" element={
          <ProtectedRoute requiredPermission="reservations:view">
            <ErrorBoundary>
              <PlanningPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Annuaire (Directory) — merged Teams + Portfolios + Guests */}
        <Route path="/directory" element={<DirectoryPage />} />
        {/* Backward-compat redirects for old URLs */}
        <Route path="/guests" element={<Navigate to="/directory?tab=guests" replace />} />

        <Route path="/dynamic-pricing" element={<Navigate to="/properties?tab=pricing" replace />} />

        <Route path="/billing" element={
          <ProtectedRoute requiredPermission="payments:view">
            <BillingPage />
          </ProtectedRoute>
        } />
        {/* Backward-compat redirects */}
        <Route path="/payments/history" element={<Navigate to="/billing" replace />} />

        <Route path="/calendar" element={
          <ProtectedRoute requiredPermission="interventions:view">
            <CalendarPage />
          </ProtectedRoute>
        } />

        <Route path="/teams" element={<Navigate to="/directory?tab=teams" replace />} />
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
        <Route path="/reports/:type" element={<Navigate to="/reports" replace />} />
        
        <Route path="/users" element={<Navigate to="/directory" replace />} />
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
          <MessagingHubPage />
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

        {/* /profile supprime — champs profil déplacés dans Settings > Général > Mon compte */}

        <Route path="/notifications" element={
          <NotificationsPage />
        } />
        
        <Route path="/portfolios" element={<Navigate to="/directory?tab=portfolios" replace />} />
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

        <Route path="/admin/kpi" element={
          <ProtectedRoute requiredPermission="users:manage">
            <ErrorBoundary>
              <KpiReadinessPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/admin/database" element={
          <ProtectedRoute requiredPermission="users:manage">
            <ErrorBoundary>
              <DatabaseAdminPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/admin/promo-codes" element={
          <ProtectedRoute requiredPermission="users:manage">
            <ErrorBoundary>
              <PromoCodesPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Vouchers : la page a ete integree comme tab #3 dans Propriétés
            (depuis qu'elle est conceptuellement liee aux biens). On garde
            un redirect pour les bookmarks existants. */}
        <Route path="/vouchers" element={<Navigate to="/properties?tab=vouchers" replace />} />

        <Route path="/admin/exchange-rates" element={
          <ProtectedRoute requiredPermission="users:manage">
            <ErrorBoundary>
              <ExchangeRateHistoryPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/channels" element={
          <ProtectedRoute requiredPermission="properties:view">
            <ErrorBoundary>
              <ChannelsPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/channels/reviews" element={
          <ProtectedRoute requiredPermission="properties:view">
            <ErrorBoundary>
              <ReviewsPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Réservation & accueil : Livret d'accueil + Booking Engine */}
        <Route path="/booking-engine" element={
          <ProtectedRoute requiredPermission="properties:view">
            <ErrorBoundary>
              <GuestExperiencePage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Baitly Studio (refonte frontend) — accueil (F1) + éditeur (F0/F2) */}
        <Route path="/booking-engine/studio" element={
          <ProtectedRoute requiredPermission="properties:view">
            <ErrorBoundary>
              <StudioHome />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/booking-engine/studio/:id" element={
          <ProtectedRoute requiredPermission="properties:view">
            <ErrorBoundary>
              <StudioPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Management Contracts */}
        <Route path="/contracts" element={
          <ProtectedRoute requiredPermission="payments:manage">
            <ErrorBoundary>
              <ManagementContractsPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Messaging routes — redirect to Documents unified page */}
        <Route path="/messaging/templates" element={<Navigate to="/documents?tab=message-templates" replace />} />
        <Route path="/messaging/history" element={<Navigate to="/documents?tab=history" replace />} />

        <Route path="/promotions" element={
          <ProtectedRoute requiredPermission="pricing:view">
            <ErrorBoundary>
              <ChannelPromotionsPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* Comptabilite fusionnee dans Facturation */}
        <Route path="/accounting" element={<Navigate to="/billing?tab=payouts" replace />} />

        {/* Backward-compat redirects — wallets merged into billing */}
        <Route path="/wallets" element={<Navigate to="/billing?tab=wallets" replace />} />
        <Route path="/invoices" element={<Navigate to="/billing?tab=invoices" replace />} />

        <Route path="/owner-portal" element={
          <ProtectedRoute requiredPermission="payments:view">
            <ErrorBoundary>
              <OwnerPortalPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/automation-rules" element={
          <ProtectedRoute requiredPermission="settings:view">
            <ErrorBoundary>
              <AutomationRulesPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/shop" element={
          <ErrorBoundary>
            <ShopPage />
          </ErrorBoundary>
        } />

        {/* Redirection intelligente vers la première page accessible selon les permissions */}
        <Route path="/" element={<SmartRedirect />} />

        {/* Catch-all 404 — toute route non matchee atterrit ici (au lieu d'un ecran blanc) */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default AuthenticatedApp;
