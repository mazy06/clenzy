import React, { useState } from 'react';
import { Box } from '@mui/material';
import {
  Assignment,
  Build,
} from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import ServiceRequestsList from '../service-requests/ServiceRequestsList';
import InterventionsList from '../interventions/InterventionsList';

// ─── Portal container for child actions in PageHeader ────────────────────────
const PORTAL_STYLE = { display: 'contents' } as const;

// ─── Tab indices ────────────────────────────────────────────────────────────

const TAB_SERVICE_REQUESTS = 0;
const TAB_INTERVENTIONS = 1;

// ─── Component ──────────────────────────────────────────────────────────────

const WorkOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Permission checks
  // Operational roles (HOUSEKEEPER, TECHNICIAN, etc.) can view service requests assigned to them
  const isOperational = user?.roles?.some((r: string) =>
    ['TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH', 'SUPERVISOR'].includes(r)
  ) ?? false;
  const canViewServiceRequests = (user?.permissions?.includes('service-requests:view') || isOperational) ?? false;
  const canViewInterventions = (user?.permissions?.includes('interventions:view') || canViewServiceRequests) ?? false;
  const showBothTabs = canViewServiceRequests && canViewInterventions;

  // Source de verite des tabs : `key` stable pour l'URL (?tab=<key>). Definie AVANT useTabKeyParam
  // et AVANT l'early return (Rules of Hooks).
  const tabs = [
    { value: TAB_SERVICE_REQUESTS, key: 'service-requests', label: t('workOrders.tabs.serviceRequests'), icon: <Assignment /> },
    { value: TAB_INTERVENTIONS,    key: 'interventions',    label: t('workOrders.tabs.interventions'),  icon: <Build /> },
  ];
  // Roles operationnels : onglet Interventions par defaut (URL sans param). Sinon Demandes.
  const [activeTab, setActiveTab] = useTabKeyParam(tabs, isOperational ? { defaultKey: 'interventions' } : undefined);
  const handleTabChange = setActiveTab;

  // Portal containers: child components render their actions/filters into these DOM elements
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const [filtersContainer, setFiltersContainer] = useState<HTMLDivElement | null>(null);

  // ── Single-view: user can only see one module → render directly (no tabs) ──
  if (!showBothTabs) {
    if (canViewServiceRequests) return <ServiceRequestsList />;
    return <InterventionsList />;
  }

  // ── Both tabs visible ─────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          /* Titre = libellé de l'onglet actif (Demandes de service / Interventions)
             pour lever l'ambiguïté : le header indique clairement où l'on se trouve. */
          title={tabs.find((tb) => tb.value === activeTab)?.label ?? t('workOrders.title')}
          subtitle={t('workOrders.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
          actions={<div ref={setActionsContainer} style={PORTAL_STYLE} />}
          filters={<div ref={setFiltersContainer} style={PORTAL_STYLE} />}
        />
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={handleTabChange}
        />
      </Box>

      {/* ── Tab content — fills remaining space ── */}
      {activeTab === TAB_SERVICE_REQUESTS && (
        <ServiceRequestsList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
      )}
      {activeTab === TAB_INTERVENTIONS && (
        <InterventionsList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
      )}
    </Box>
  );
};

export default WorkOrdersPage;
