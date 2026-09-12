import React, { useEffect } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';
import { Button, Spinner } from '../../components/ui';
import { useNotification } from '../../hooks/useNotification';
import {
  Save,
  Refresh,
  Euro,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useTarification } from '../../hooks/useTarification';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import TabPMS from './TabPMS';
import TabEntretien from './TabEntretien';
import TabMenage from './TabMenage';
import TabTravaux from './TabTravaux';
import TabExterieur from './TabExterieur';
import TabBlanchisserie from './TabBlanchisserie';
import TabMonitoring from './TabMonitoring';

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. tarificationTabMeta plus bas).

// ─── Component ───────────────────────────────────────────────────────────────

export default function Tarification() {
  const { t } = useTranslation();
  const {
    config,
    teams,
    isLoading,
    canEdit,
    isSaving,
    currencySymbol,
    updateConfig,
    saveConfig,
    resetConfig,
    snackbar,
    closeSnackbar,
  } = useTarification();

  // L'etat du snackbar vit dans useTarification (fichier .ts, hors perimetre de
  // cette migration) : on le draine vers le toast sonner puis on le referme,
  // ce qui evite d'avoir deux mecanismes de notification en parallele.
  const { notify } = useNotification();
  useEffect(() => {
    if (!snackbar.open) return;
    notify[snackbar.severity](snackbar.message);
    closeSnackbar();
  }, [snackbar, notify, closeSnackbar]);

  // Onglets lus dans le registre partage (config/screenTabs.tsx) : la barre
  // laterale deplie EXACTEMENT cette liste dans son troisieme tiroir. Les `key`
  // y sont stables, on passe donc la liste telle quelle au hook (URL ?tab=<key>).
  const tabs = useScreenTabs('/tarification');
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Source de verite des tabs — utilisee pour PageTabs ET pour la resolution
  // {title, subtitle} via resolveTabHeader (indexe par label).
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const tarificationTabMeta: Record<string, TabHeaderMeta> = {
    [t('tarification.tabs.pms')]: {
      subtitle: t('tabHeaders.tarification.subtitle.pms', 'Configuration tarifaire des prestations PMS : abonnements, paliers et options.'),
    },
    [t('tarification.tabs.entretien')]: {
      subtitle: t('tabHeaders.tarification.subtitle.entretien', "Tarifs des prestations d'entretien et menage : forfaits, suppléments et coefficients."),
    },
    [t('tarification.tabs.menage')]: {
      subtitle: t('tabHeaders.tarification.subtitle.menage', 'Moteur Ménage : minutes normées par composant, taux horaire et fourchette du prix conseillé.'),
    },
    [t('tarification.tabs.travaux')]: {
      subtitle: t('tabHeaders.tarification.subtitle.travaux', 'Grille tarifaire des travaux et interventions techniques par typologie de chantier.'),
    },
    [t('tarification.tabs.exterieur')]: {
      subtitle: t('tabHeaders.tarification.subtitle.exterieur', 'Tarifs des prestations extérieures : jardinage, piscine, espaces verts.'),
    },
    [t('tarification.tabs.blanchisserie')]: {
      subtitle: t('tabHeaders.tarification.subtitle.blanchisserie', 'Tarification du linge : forfaits par type de pièce, lavage et livraison.'),
    },
    [t('tarification.tabs.monitoring')]: {
      subtitle: t('tabHeaders.tarification.subtitle.monitoring', 'Tarifs des offres de monitoring sonore (Minut, Roomonitor) propagés aux clients.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.tarification.title', 'Configuration tarifaire'),
    t('tabHeaders.tarification.default', 'Gérez les coefficients de pondération, les prix de base et les abonnements'),
    tabs.map((tab) => tab.label),
    activeTab,
    tarificationTabMeta,
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner className="size-10" />
      </div>
    );
  }

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <div>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<Euro />}
          backPath="/dashboard"
          actions={
            <div className="flex items-center gap-1.5">
              {headerActionsPortal}
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetConfig}
                    disabled={isSaving}
                    title={t('tarification.reset')}
                  >
                    <Refresh />
                    {t('tarification.reset')}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveConfig}
                    disabled={isSaving}
                    title={t('tarification.save')}
                  >
                    {isSaving ? <Spinner className="size-4" /> : <Save />}
                    {t('tarification.save')}
                  </Button>
                </>
              )}
            </div>
          }
        />

        {!canEdit && (
          <UiAlert variant="info" className="mb-3">
            <Info />
            <AlertDescription>{t('tarification.readOnly')}</AlertDescription>
          </UiAlert>
        )}

        {/* ─── Tabs ──────────────────────────────────────────────────── */}
        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* ─── Tab Content ───────────────────────────────────────────── */}
        <div className="pt-1.5">
          {activeTab === 0 && (
            <TabPMS config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 1 && (
            <TabEntretien config={config} teams={teams} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 2 && (
            <TabMenage config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 3 && (
            <TabTravaux
              items={config.travauxConfig || []}
              canEdit={canEdit}
              onItemsChange={(items) => updateConfig({ travauxConfig: items })}
              currencySymbol={currencySymbol}
              commission={(config.commissionConfigs || []).find((c) => c.category === 'travaux')}
              onCommissionChange={(updated) => {
                const configs = [...(config.commissionConfigs || [])];
                const idx = configs.findIndex((c) => c.category === 'travaux');
                if (idx >= 0) configs[idx] = updated; else configs.push(updated);
                updateConfig({ commissionConfigs: configs });
              }}
            />
          )}
          {activeTab === 4 && (
            <TabExterieur config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 5 && (
            <TabBlanchisserie config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 6 && (
            <TabMonitoring config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
        </div>
      </div>
    </PageHeaderActionsProvider>
  );
}
