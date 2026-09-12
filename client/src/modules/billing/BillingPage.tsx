import React, { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import { useTranslation } from '../../hooks/useTranslation';
import { AccountBalance } from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import PaymentHistoryPage from '../payments/PaymentHistoryPage';
import InvoicesList from '../invoices/InvoicesList';
import WalletDashboard from '../finance/WalletDashboard';
import { PayoutsTab, ExpensesTab, ExportsTab } from '../accounting/AccountingPage';
import HousekeeperPayoutsTab from '../accounting/components/HousekeeperPayoutsTab';
import FiscalReportSection from '../reports/FiscalReportSection';

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. billingTabMeta plus bas).

// ─── Merged Reports & Exports Tab ──────────────────────────────────────────

const ReportsExportsTab: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<'fiscal' | 'exports'>('fiscal');

  return (
    <div>
      {/* Segmented (bascule de vue). `type="single"` + garde sur la valeur vide :
          Radix renvoie "" quand on re-clique l'item actif, ce que l'ancien
          `exclusive` de MUI traduisait par null — on refuse dans les deux cas. */}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={view}
        onValueChange={(v) => { if (v) setView(v as 'fiscal' | 'exports'); }}
        className="mb-3"
      >
        <ToggleGroupItem value="fiscal">
          {t('billing.tabs.fiscalReport', 'Rapport fiscal')}
        </ToggleGroupItem>
        <ToggleGroupItem value="exports">
          {t('billing.tabs.exports', 'Exports comptables')}
        </ToggleGroupItem>
      </ToggleGroup>

      {view === 'fiscal' && <FiscalReportSection />}
      {view === 'exports' && <ExportsTab />}
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const BillingPage: React.FC = () => {
  const { t } = useTranslation();


  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Onglets lus dans le registre partage (config/screenTabs.tsx), droits
  // compris : la barre laterale deplie EXACTEMENT cette liste dans son
  // troisieme tiroir. Definie AVANT useTabKeyParam, qui derive l'onglet actif
  // de l'URL (?tab=<key>) — robuste au role : l'index visible shifte, jamais la cle.
  const tabs = useScreenTabs('/billing');
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  const [activePos, setActivePos] = useTabKeyParam(tabs);
  const handleTabChange = setActivePos;
  // Cle de l'onglet actif (pour le rendu du contenu) — stable, independante du role.
  const activeKey = visibleTabs[activePos]?.key ?? 'payments';
  const visibleTabLabels = visibleTabs.map((tab) => tab.label);
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const billingTabMeta: Record<string, TabHeaderMeta> = {
    [t('billing.tabs.payments')]: {
      subtitle: t('tabHeaders.billing.subtitle.payments', 'Historique des paiements voyageurs : statut, mode de reglement, remboursements et reconciliation.'),
    },
    [t('billing.tabs.invoices')]: {
      subtitle: t('tabHeaders.billing.subtitle.invoices', 'Factures emises (sejours, frais, services) et avoirs : edition PDF, envoi et suivi des reglements.'),
    },
    [t('navigation.wallets')]: {
      subtitle: t('tabHeaders.billing.subtitle.wallets', 'Solde des portefeuilles par proprietaire : mouvements, blocages, retraits et historique detaille.'),
    },
    [t('billing.tabs.payouts', 'Reversements')]: {
      subtitle: t('tabHeaders.billing.subtitle.payouts', 'Calendrier des reversements aux proprietaires : calculs SEPA, statut, exports bancaires.'),
    },
    [t('billing.tabs.expenses', 'Depenses')]: {
      subtitle: t('tabHeaders.billing.subtitle.expenses', 'Suivi des depenses operationnelles par categorie et par bien : factures fournisseurs, refacturation.'),
    },
    [t('billing.tabs.housekeeperPayouts', 'Versements prestataires')]: {
      subtitle: t('tabHeaders.billing.subtitle.housekeeperPayouts', 'Versements Stripe directs aux prestataires (ménage), déclenchés à la validation de mission — distincts des reversements propriétaires.'),
    },
    [t('billing.tabs.reportsExports', 'Rapports & Exports')]: {
      subtitle: t('tabHeaders.billing.subtitle.reportsExports', 'Rapport fiscal (TVA, taxes, NF 525) et exports comptables formates pour vos outils tiers.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.billing.title', 'Facturation'),
    t('tabHeaders.billing.default', 'Paiements, factures, reversements, dépenses et rapports comptables'),
    visibleTabLabels,
    activePos,
    billingTabMeta,
  );

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <div>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<AccountBalance />}
          backPath="/dashboard"
          showBackButton={false}
          actions={headerActionsPortal}
        />
        <PageTabs
          options={tabs}
          value={activePos}
          onChange={handleTabChange}
        />

        {/* ── Tab content (rendu par cle stable, independante du role) ── */}
        {activeKey === 'payments' && <PaymentHistoryPage embedded />}
        {/* Pas de second garde par permission : `activeKey` est lu dans les
            onglets VISIBLES, un onglet masque ne peut donc jamais etre actif.
            Le registre (config/screenTabs.tsx) porte ce filtrage, une fois. */}
        {activeKey === 'invoices' && <InvoicesList embedded />}
        {activeKey === 'wallets' && <WalletDashboard embedded />}
        {activeKey === 'payouts' && <PayoutsTab />}
        {activeKey === 'expenses' && <ExpensesTab />}
        {activeKey === 'housekeeper-payouts' && <HousekeeperPayoutsTab />}
        {activeKey === 'reports' && <ReportsExportsTab />}
      </div>
    </PageHeaderActionsProvider>
  );
};

export default BillingPage;
