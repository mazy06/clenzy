import React, { useState } from 'react';
import { Box } from '@mui/material';
import {
  Home,
  TrendingUp,
  LocalOffer,
  Inventory2,
} from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
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
import VouchersPage from '../vouchers/VouchersPage';
import ConnectedObjectsHub from '../connected-objects/ConnectedObjectsHub';

// ─── Portal container for child actions in PageHeader ────────────────────────
const PORTAL_STYLE = { display: 'contents' } as const;

// ─── Tab indices ────────────────────────────────────────────────────────────

const TAB_PROPERTIES = 0;
const TAB_PRICING = 1;
const TAB_VOUCHERS = 2;
const TAB_CONNECTED_OBJECTS = 3;

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. propertiesTabMeta plus bas).

// ─── Component ──────────────────────────────────────────────────────────────

const PropertiesPage: React.FC = () => {
  const { t } = useTranslation();

  // Source de verite des tabs : `key` stable pour l'URL (?tab=<key>) + label pour le header.
  // Definie AVANT useTabKeyParam (qui en derive l'onglet actif) et AVANT tout early return.
  const tabs = [
    { value: TAB_PROPERTIES, key: 'properties', label: t('propertiesPage.tabs.properties'), icon: <Home /> },
    { value: TAB_PRICING,    key: 'pricing',    label: t('propertiesPage.tabs.pricing'),    icon: <TrendingUp /> },
    { value: TAB_VOUCHERS,   key: 'vouchers',   label: t('propertiesPage.tabs.vouchers', 'Codes promo'), icon: <LocalOffer /> },
    { value: TAB_CONNECTED_OBJECTS, key: 'connected-objects', label: t('propertiesPage.tabs.connectedObjects', 'Objets connectés'), icon: <Inventory2 /> },
  ];
  const visibleTabs = tabs.filter((tab) => !(tab as { hidden?: boolean }).hidden);
  // useTabKeyParam derive l'onglet actif de l'URL (?tab=<key>) — source de verite, pas de useState/useEffect.
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const handleTabChange = setActiveTab;

  // Portal containers: child components render their actions/filters into these DOM elements
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const [filtersContainer, setFiltersContainer] = useState<HTMLDivElement | null>(null);
  const [tabInlineContainer, setTabInlineContainer] = useState<HTMLDivElement | null>(null);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const propertiesTabMeta: Record<string, TabHeaderMeta> = {
    [t('propertiesPage.tabs.properties')]: {
      subtitle: t('tabHeaders.properties.subtitle.properties', "Liste de vos biens immobiliers avec leur statut, taux d'occupation et alertes."),
    },
    [t('propertiesPage.tabs.pricing')]: {
      subtitle: t('tabHeaders.properties.subtitle.pricing', 'Configuration de la tarification dynamique par bien : prix de base, saisonnalité, ajustements.'),
    },
    [t('propertiesPage.tabs.vouchers', 'Codes promo')]: {
      subtitle: t('tabHeaders.properties.subtitle.vouchers', 'Codes promo et campagnes auto applicables aux nuitées : remises pourcentage ou montant fixe, scope par bien.'),
    },
    [t('propertiesPage.tabs.connectedObjects', 'Objets connectés')]: {
      subtitle: t('tabHeaders.properties.subtitle.connectedObjects', 'Supervisez et pilotez vos serrures, capteurs et clés, logement par logement.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.properties.title', 'Propriétés'),
    t('tabHeaders.properties.default', 'Gestion des propriétés et des tarifs dynamiques'),
    visibleTabs.map((tab) => tab.label),
    activeTab,
    propertiesTabMeta,
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
        {activeTab === TAB_VOUCHERS && (
          <VouchersPage embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
        )}
        {activeTab === TAB_CONNECTED_OBJECTS && (
          <ConnectedObjectsHub embedded actionsContainer={actionsContainer} />
        )}
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default PropertiesPage;
