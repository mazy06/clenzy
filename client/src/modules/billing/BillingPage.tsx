import React, { useState, useCallback, useEffect } from 'react';
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
import { useSearchParams } from 'react-router-dom';
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

// ─── Tab indices (logical, stable) ──────────────────────────────────────────

const TAB_PAYMENTS = 0;
const TAB_INVOICES = 1;
const TAB_WALLETS = 2;
const TAB_PAYOUTS = 3;
const TAB_EXPENSES = 4;
const TAB_REPORTS = 5;

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
  const [searchParams, setSearchParams] = useSearchParams();

  const canViewInvoices = user?.permissions?.includes('reports:view') ?? false;
  const canViewWallets = user?.permissions?.includes('payments:manage') ?? false;
  const canViewAccounting = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Build visible tabs dynamically (order preserved)
  const visibleTabs: { index: number; key: string }[] = [
    { index: TAB_PAYMENTS, key: 'payments' },
  ];
  if (canViewInvoices) visibleTabs.push({ index: TAB_INVOICES, key: 'invoices' });
  if (canViewWallets) visibleTabs.push({ index: TAB_WALLETS, key: 'wallets' });
  if (canViewAccounting) {
    visibleTabs.push({ index: TAB_PAYOUTS, key: 'payouts' });
    visibleTabs.push({ index: TAB_EXPENSES, key: 'expenses' });
    visibleTabs.push({ index: TAB_REPORTS, key: 'reports' });
  }

  // Map URL ?tab=<logicalIndex> → visible position
  const getInitialPos = () => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) return 0;
    const parsed = parseInt(tabParam, 10);
    if (isNaN(parsed)) return 0;
    const pos = visibleTabs.findIndex((vt) => vt.index === parsed);
    return pos >= 0 ? pos : 0;
  };

  const [activePos, setActivePos] = useState(getInitialPos);
  const activeLogicalIndex = visibleTabs[activePos]?.index ?? TAB_PAYMENTS;

  const handleTabChange = useCallback(
    (newPos: number) => {
      setActivePos(newPos);
      const logicalIndex = visibleTabs[newPos]?.index ?? 0;
      setSearchParams(logicalIndex === 0 ? {} : { tab: String(logicalIndex) }, { replace: true });
    },
    [setSearchParams, visibleTabs],
  );

  // Handle URL param changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed)) {
        const pos = visibleTabs.findIndex((vt) => vt.index === parsed);
        if (pos >= 0 && pos !== activePos) {
          setActivePos(pos);
        }
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Source de verite des tabs (avec hidden flag) — utilisee pour PageTabs ET
  // pour resoudre le tab actif via resolveTabHeader. Le filtre `hidden` doit
  // matcher la logique de visibleTabs ci-dessus pour rester coherent.
  const tabs = [
    { label: t('billing.tabs.payments'),                          icon: <Payment />,                hidden: false },
    { label: t('billing.tabs.invoices'),                          icon: <Receipt />,                hidden: !canViewInvoices },
    { label: t('navigation.wallets'),                             icon: <AccountBalanceWallet />,   hidden: !canViewWallets },
    { label: t('billing.tabs.payouts', 'Reversements'),           icon: <AccountBalance />,         hidden: !canViewAccounting },
    { label: t('billing.tabs.expenses', 'Depenses'),              icon: <Category />,               hidden: !canViewAccounting },
    { label: t('billing.tabs.reportsExports', 'Rapports & Exports'), icon: <Assessment />,          hidden: !canViewAccounting },
  ];
  const visibleTabLabels = tabs.filter((tab) => !tab.hidden).map((tab) => tab.label);
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

        {/* ── Tab content ── */}
        {activeLogicalIndex === TAB_PAYMENTS && <PaymentHistoryPage embedded />}
        {activeLogicalIndex === TAB_INVOICES && canViewInvoices && <InvoicesList embedded />}
        {activeLogicalIndex === TAB_WALLETS && canViewWallets && <WalletDashboard embedded />}
        {activeLogicalIndex === TAB_PAYOUTS && canViewAccounting && <PayoutsTab />}
        {activeLogicalIndex === TAB_EXPENSES && canViewAccounting && <ExpensesTab />}
        {activeLogicalIndex === TAB_REPORTS && canViewAccounting && <ReportsExportsTab />}
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default BillingPage;
