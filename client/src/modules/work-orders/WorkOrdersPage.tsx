import React, { useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  Assignment,
  Build,
} from '../../icons';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Permission checks
  // Operational roles (HOUSEKEEPER, TECHNICIAN, etc.) can view service requests assigned to them
  const isOperational = user?.roles?.some((r: string) =>
    ['TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH', 'SUPERVISOR'].includes(r)
  ) ?? false;
  const canViewServiceRequests = (user?.permissions?.includes('service-requests:view') || isOperational) ?? false;
  const canViewInterventions = (user?.permissions?.includes('interventions:view') || canViewServiceRequests) ?? false;
  const showBothTabs = canViewServiceRequests && canViewInterventions;

  const maxTab = showBothTabs ? TAB_INTERVENTIONS : 0;
  // Operational roles default to Interventions tab
  const defaultTab = isOperational ? TAB_INTERVENTIONS : TAB_SERVICE_REQUESTS;
  const initialTab = parseInt(searchParams.get('tab') || String(defaultTab), 10);
  const [activeTab, setActiveTab] = useState(
    isNaN(initialTab) ? 0 : Math.min(initialTab, maxTab)
  );

  // Portal containers: child components render their actions/filters into these DOM elements
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const [filtersContainer, setFiltersContainer] = useState<HTMLDivElement | null>(null);

  // Sync tab to URL param
  const handleTabChange = useCallback((v: number) => {
    setActiveTab(v);
    setSearchParams(v === 0 ? {} : { tab: String(v) }, { replace: true });
  }, [setSearchParams]);

  // Handle URL param changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= maxTab && parsed !== activeTab) {
        setActiveTab(parsed);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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
          title={t('workOrders.title')}
          subtitle={t('workOrders.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
          actions={<div ref={setActionsContainer} style={PORTAL_STYLE} />}
          filters={<div ref={setFiltersContainer} style={PORTAL_STYLE} />}
        />
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <PageTabs
          options={[
            { value: TAB_SERVICE_REQUESTS, label: t('workOrders.tabs.serviceRequests'), icon: <Assignment /> },
            { value: TAB_INTERVENTIONS,    label: t('workOrders.tabs.interventions'),  icon: <Build /> },
          ]}
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
