import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import { useTranslation } from '../../hooks/useTranslation';
import { Home } from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import PropertiesList from './PropertiesList';
import VouchersPage from '../vouchers/VouchersPage';
import { useQueryClient } from '@tanstack/react-query';
import { usePropertiesList, propertiesListKeys } from '../../hooks/usePropertiesList';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import PropertiesEmptyShowcase, { isPropertyIntroduction } from './PropertiesEmptyShowcase';
import ChannexMappingDialog from '../settings/components/ChannexMappingDialog';

// ─── Portal container for child actions in PageHeader ────────────────────────
const PORTAL_STYLE = { display: 'contents' } as const;

// ─── Tab indices ────────────────────────────────────────────────────────────


// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. propertiesTabMeta plus bas).

// ─── Component ──────────────────────────────────────────────────────────────

const PropertiesPage: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { properties, isLoading, isError } = usePropertiesList();
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const hasProperties = properties.length > 0;
  const refreshProperties = () => queryClient.invalidateQueries({ queryKey: propertiesListKeys.all });

  // Source de verite des tabs : `key` stable pour l'URL (?tab=<key>) + label pour le header.
  // Definie AVANT useTabKeyParam (qui en derive l'onglet actif) et AVANT tout early return.
  const tabs = useScreenTabs('/properties');
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  // useTabKeyParam derive l'onglet actif de l'URL (?tab=<key>) — source de verite, pas de useState/useEffect.
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  // Contenu resolu par CLE : `activeTab` est un index VISIBLE, il ne coincide
  // avec le rang du registre que tant qu'aucun onglet n'est masque.
  const activeKey = visibleTabs[activeTab]?.key;
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
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.properties.title', 'Propriétés'),
    t('tabHeaders.properties.default', 'Gestion des propriétés et des tarifs dynamiques'),
    visibleTabs.map((tab) => tab.label),
    activeTab,
    propertiesTabMeta,
  );

  if (new URLSearchParams(location.search).get('tab') === 'pricing') return <Navigate to="/dynamic-pricing" replace />;

  // Keep historical links while exposing a single, standalone equipment workspace.
  if (new URLSearchParams(location.search).get('tab') === 'connected-objects') return <Navigate to="/connected-objects" replace />;

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0">
          <PageHeader
            title={title}
            subtitle={subtitle}
            iconBadge={<Home />}
            backPath="/dashboard"
            showBackButton={false}
            actions={hasProperties ? (
              <div className="flex items-center gap-1.5">
                {headerActionsPortal}
                <div ref={setActionsContainer} style={PORTAL_STYLE} />
              </div>
            ) : undefined}
            filters={hasProperties ? <div ref={setFiltersContainer} style={PORTAL_STYLE} /> : undefined}
          />
          <PageTabs
            options={tabs}
            value={activeTab}
            onChange={handleTabChange}
            inlineActions={hasProperties ? <div ref={setTabInlineContainer} style={PORTAL_STYLE} /> : undefined}
          />
        </div>

        {/* ── Tab content ── */}
        {!hasProperties && isLoading ? (
          <div className="grid gap-6 p-6 md:grid-cols-2" role="status" aria-label={t('common.loading')}>
            <div><Skeleton className="mb-4 h-20 w-4/5" /><Skeleton className="h-40 w-full" /></div>
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        ) : !hasProperties && isError ? (
          <Alert className="m-4 w-auto" variant="destructive">
            <AlertDescription>
              {t('propertiesFirstUse.loadError')}
              <Button variant="outline" className="ms-3" onClick={() => { void refreshProperties(); }}>{t('common.retry')}</Button>
            </AlertDescription>
          </Alert>
        ) : !hasProperties && isPropertyIntroduction(activeKey) ? (
          <PropertiesEmptyShowcase key={activeKey} screen={activeKey} onImport={() => setImportOpen(true)} />
        ) : null}
        {hasProperties && activeKey === 'properties' && (
          <PropertiesList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
        )}
        {hasProperties && activeKey === 'vouchers' && (
          <VouchersPage embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
        )}
      </div>
      {importOpen && <ChannexMappingDialog open guided onClose={() => {
        setImportOpen(false);
        void refreshProperties();
      }} />}
    </PageHeaderActionsProvider>
  );
};

export default PropertiesPage;
