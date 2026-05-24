import React, { useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  Home,
  TrendingUp,
} from '../../icons';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import PropertiesList from './PropertiesList';
import DynamicPricing from '../pricing/DynamicPricing';

// ─── Portal container for child actions in PageHeader ────────────────────────
const PORTAL_STYLE = { display: 'contents' } as const;

// ─── Tab indices ────────────────────────────────────────────────────────────

const TAB_PROPERTIES = 0;
const TAB_PRICING = 1;

// ─── Metadata par tab (breadcrumb + subtitle) ────────────────────────────────
// Clef = LABEL traduit du tab (string stable face aux changements d'index visible).
const PROPERTIES_TAB_META: Record<string, TabHeaderMeta> = {
  'Propriétés': {
    subtitle: "Liste de vos biens immobiliers avec leur statut, taux d'occupation et alertes.",
  },
  'Prix dynamique': {
    subtitle: 'Configuration de la tarification dynamique par bien : prix de base, saisonnalité, ajustements.',
  },
};
const PROPERTIES_ROOT_TITLE = 'Propriétés';
const PROPERTIES_DEFAULT_SUBTITLE = 'Gestion des propriétés et des tarifs dynamiques';

// ─── Component ──────────────────────────────────────────────────────────────

const PropertiesPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = parseInt(searchParams.get('tab') || '0', 10);
  const [activeTab, setActiveTab] = useState(
    isNaN(initialTab) ? 0 : Math.min(initialTab, TAB_PRICING)
  );

  // Portal containers: child components render their actions/filters into these DOM elements
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const [filtersContainer, setFiltersContainer] = useState<HTMLDivElement | null>(null);
  const [tabInlineContainer, setTabInlineContainer] = useState<HTMLDivElement | null>(null);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

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
      if (!isNaN(parsed) && parsed >= 0 && parsed <= TAB_PRICING && parsed !== activeTab) {
        setActiveTab(parsed);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Source de verite des tabs — utilisee pour PageTabs ET pour la resolution
  // {title, subtitle} via resolveTabHeader (indexe par label).
  const tabs = [
    { value: TAB_PROPERTIES, label: t('propertiesPage.tabs.properties'), icon: <Home /> },
    { value: TAB_PRICING,    label: t('propertiesPage.tabs.pricing'),    icon: <TrendingUp /> },
  ];
  const visibleTabs = tabs.filter((tab) => !(tab as { hidden?: boolean }).hidden);
  const { title, subtitle } = resolveTabHeader(
    PROPERTIES_ROOT_TITLE,
    PROPERTIES_DEFAULT_SUBTITLE,
    visibleTabs.map((tab) => tab.label),
    activeTab,
    PROPERTIES_TAB_META,
  );

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Box sx={{ flexShrink: 0 }}>
          <PageHeader
            title={title}
            subtitle={subtitle}
            iconBadge={<Home />}
            backPath="/dashboard"
            showBackButton={false}
            actions={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {headerActionsPortal}
                <div ref={setActionsContainer} style={PORTAL_STYLE} />
              </Box>
            }
            filters={<div ref={setFiltersContainer} style={PORTAL_STYLE} />}
          />
          <PageTabs
            options={tabs}
            value={activeTab}
            onChange={handleTabChange}
            inlineActions={<div ref={setTabInlineContainer} style={PORTAL_STYLE} />}
          />
        </Box>

        {/* ── Tab content ── */}
        {activeTab === TAB_PROPERTIES && (
          <PropertiesList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
        )}
        {activeTab === TAB_PRICING && (
          <DynamicPricing embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} tabInlineContainer={tabInlineContainer} />
        )}
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default PropertiesPage;
