import React, { useState } from 'react';
import {
  Box,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Payment,
  Receipt,
  AccountBalanceWallet,
  AccountBalance,
  Category,
  Assessment,
} from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
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
import FiscalReportSection from '../reports/FiscalReportSection';

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. billingTabMeta plus bas).

// ─── Merged Reports & Exports Tab ──────────────────────────────────────────

const ReportsExportsTab: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<'fiscal' | 'exports'>('fiscal');

  return (
    <Box>
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_e, v) => v && setView(v)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.8125rem', px: 3 } }}
        >
          <ToggleButton value="fiscal">
            {t('billing.tabs.fiscalReport', 'Rapport fiscal')}
          </ToggleButton>
          <ToggleButton value="exports">
            {t('billing.tabs.exports', 'Exports comptables')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {view === 'fiscal' && <FiscalReportSection />}
      {view === 'exports' && <ExportsTab />}
    </Box>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const BillingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();

  const canViewInvoices = user?.permissions?.includes('reports:view') ?? false;
  const canViewWallets = user?.permissions?.includes('payments:manage') ?? false;
  const canViewAccounting = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Source de verite des tabs (avec `key` stable + `hidden`). Definie AVANT useTabKeyParam,
  // qui derive l'onglet actif de l'URL (?tab=<key>) — robuste au role (l'index visible shifte,
  // jamais la cle). Le filtre `hidden` matche les permissions ci-dessus.
  const tabs = [
    { key: 'payments', label: t('billing.tabs.payments'),                             icon: <Payment />,                hidden: false },
    { key: 'invoices', label: t('billing.tabs.invoices'),                             icon: <Receipt />,                hidden: !canViewInvoices },
    { key: 'wallets',  label: t('navigation.wallets'),                                icon: <AccountBalanceWallet />,   hidden: !canViewWallets },
    { key: 'payouts',  label: t('billing.tabs.payouts', 'Reversements'),              icon: <AccountBalance />,         hidden: !canViewAccounting },
    { key: 'expenses', label: t('billing.tabs.expenses', 'Depenses'),                 icon: <Category />,               hidden: !canViewAccounting },
    { key: 'reports',  label: t('billing.tabs.reportsExports', 'Rapports & Exports'), icon: <Assessment />,             hidden: !canViewAccounting },
  ];
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
      <Box>
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
        {activeKey === 'invoices' && canViewInvoices && <InvoicesList embedded />}
        {activeKey === 'wallets' && canViewWallets && <WalletDashboard embedded />}
        {activeKey === 'payouts' && canViewAccounting && <PayoutsTab />}
        {activeKey === 'expenses' && canViewAccounting && <ExpensesTab />}
        {activeKey === 'reports' && canViewAccounting && <ReportsExportsTab />}
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default BillingPage;
