import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
} from '../../icons';
import { pennylaneApi } from '../../services/api/pennylaneApi';
import type { PennylaneStatus, PennylaneSyncStatus } from '../../services/api/pennylaneApi';
import type { SignatureProvider } from '../../services/api/integrationsApi';
import { externalConnectionApi } from '../../services/api/externalConnectionApi';
import { useTranslation } from '../../hooks/useTranslation';
import ApiKeyProviderCard from './components/ApiKeyProviderCard';
import SignatureProviderCards from './components/SignatureProviderCards';
import OAuthProviderCard from './components/OAuthProviderCard';
import PricingProviderCard from './components/PricingProviderCard';
import ProviderLogo from './components/ProviderLogos';
import IntegrationConfigDialog from './components/IntegrationConfigDialog';
import { docusignApi } from '../../services/api/docusignApi';
import { pricingConnectionApi, type PricingProvider } from '../../services/api/pricingConnectionApi';
import { quickbooksApi } from '../../services/api/quickbooksApi';
import { xeroApi } from '../../services/api/xeroApi';
import { sageApi } from '../../services/api/sageApi';
import { complianceConnectionApi, type ComplianceProvider } from '../../services/api/complianceConnectionApi';
import ComplianceProviderCard from './components/ComplianceProviderCard';
import { kycConnectionApi, type KycProvider } from '../../services/api/kycConnectionApi';
import KycProviderCard from './components/KycProviderCard';
import {
  COMING_SOON_CHIP_SX,
  DISABLED_CARDS_SX,
  blockInteraction,
} from './components/disabledIntegration';
import { channelManagerConnectionApi, type ChannelManagerProvider } from '../../services/api/channelManagerConnectionApi';
import ChannelManagerProviderCard from './components/ChannelManagerProviderCard';
import ChannexMappingDialog from './components/ChannexMappingDialog';
import OtaShowcaseSection from './components/OtaShowcaseSection';
import ServiceCatalogSection from './components/ServiceCatalogSection';
import ServiceTooltip from './components/ServiceTooltip';
import BrevoConfigCard from './components/BrevoConfigCard';
import { useMarketingIntegration } from '../../hooks/useMarketingIntegration';

// ─── Style helpers (Baitly palette) ─────────────────────────────────────────

const ACCENT = '#4A9B8E';
const PRIMARY = '#6B8A9A';
const DANGER = '#C97A7A';
const NEUTRAL = '#8A8378';
const WARM = '#D4A574';

// Channex est la seule integration fonctionnelle pour l'instant ; toutes les
// autres sections affichent l'etat "Bientot disponible" via les utilitaires
// partages dans disabledIntegration.ts.

const refinedContainedSx = (color: string) => ({
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.78rem',
  letterSpacing: '0.01em',
  borderRadius: '8px',
  py: 0.625,
  px: 1.5,
  bgcolor: color,
  color: '#fff',
  boxShadow: 'none',
  transition:
    'background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
  '&:hover': {
    bgcolor: color,
    filter: 'brightness(0.94)',
    boxShadow: `0 1px 2px rgba(45, 55, 72, 0.06), 0 4px 10px ${color}38`,
    transform: 'translateY(-1px)',
  },
  '&:active': { transform: 'translateY(0)', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: `${color}55`, color: '#fff' },
});

const refinedOutlinedSx = (hoverColor: string) => ({
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.78rem',
  letterSpacing: '0.01em',
  borderRadius: '8px',
  py: 0.625,
  px: 1.5,
  borderColor: 'divider',
  color: 'text.primary',
  transition:
    'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
  '&:hover': {
    borderColor: `${hoverColor}66`,
    backgroundColor: `${hoverColor}0F`,
    color: hoverColor,
  },
  '&:focus-visible': { outline: `2px solid ${hoverColor}`, outlineOffset: 2 },
});

const buildStatusChipSx = (color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '6px',
  px: 0.25,
  backgroundColor: `${color}14`,
  color,
  border: `1px solid ${color}33`,
  '& .MuiChip-icon': {
    color: `${color} !important`,
    ml: '6px',
    mr: '-2px',
  },
  '& .MuiChip-label': { px: 0.875 },
});

// ─── Integration metadata ──────────────────────────────────────────────────

const PENNYLANE_BRAND = '#1B2A4A';
const PENNYLANE_INITIALS = 'PL';

// ─── Component ──────────────────────────────────────────────────────────────

interface IntegrationsSectionProps {
  /**
   * ID de la categorie selectionnee dans le filtre du PageHeader. {@code null}
   * ou {@code undefined} = toutes les sections sont visibles. State possede
   * par {@code Settings.tsx} pour pouvoir injecter le header (search + filter)
   * dans le slot {@code filters} du PageHeader.
   */
  selectedCategoryId?: string | null;
  /**
   * ID du service specifique recherche via l'autocomplete. Si non-null, on
   * affiche UNIQUEMENT la card de ce service dans sa section parent (le filtre
   * categorie est aussi auto-resserre cote Settings.tsx).
   */
  selectedServiceId?: string | null;
}

export default function IntegrationsSection({
  selectedCategoryId = null,
  selectedServiceId = null,
}: IntegrationsSectionProps = {}) {
  const { t } = useTranslation();

  // ─── Marketing & Newsletter (Brevo — section ACTIVE) ──────────────────────
  // La tab Intégrations est déjà gatée SUPER_ADMIN / SUPER_MANAGER (Settings.tsx),
  // donc pas de check de rôle supplémentaire ici. Le badge "Configuré" et le
  // panneau de config partagent la même requête React Query (cache).
  const [openMarketing, setOpenMarketing] = useState(false);
  const { data: marketingData } = useMarketingIntegration();
  const marketingConfigured = !!marketingData?.configured;

  const [status, setStatus] = useState<PennylaneStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<PennylaneSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  /**
   * True quand le backend renvoie 404 sur /api/pennylane/status : la feature
   * est conditionnelle (@ConditionalOnProperty clenzy.pennylane.client-id)
   * et la propriete n'est pas definie sur cet env. On affiche alors un etat
   * "non configure" au lieu de l'erreur generique.
   */
  const [notConfigured, setNotConfigured] = useState(false);

  // ─── Selection card (single-focus) + multi-CONFIGURATION ──────────────────
  // Chaque provider conserve sa propre connexion (table dediee cote backend).
  // La selection ici = "quel panneau de config est ouvert en bas" (single).
  // L'ensemble {@code connectedProviders} liste tous les providers ayant deja
  // une connexion sauvegardee — affiches avec un badge "Configure" sur leur card.
  type SelectableProvider = Exclude<SignatureProvider, null>;
  const [openSignatureProvider, setOpenSignatureProvider] = useState<SelectableProvider | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<SelectableProvider>>(new Set());
  const [providerLoading] = useState(false);
  const [providerMessage, setProviderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /**
   * Callback distribue a chaque card de config. Quand un provider se connecte
   * ou se deconnecte, on met a jour le set local pour rafraichir le badge sur
   * la card de selection en haut.
   */
  const handleProviderStatusChange = useCallback(
    (provider: SelectableProvider, connected: boolean) => {
      setConnectedProviders((prev) => {
        const next = new Set(prev);
        if (connected) next.add(provider);
        else next.delete(provider);
        return next;
      });
    },
    [],
  );

  // Synchronise le badge "Configure" sur la card Pennylane quand son status
  // change (la card Pennylane existante n'utilise pas le pattern onStatusChange
  // unifie car son block est inline avec d'autres fonctionnalites sync).
  useEffect(() => {
    if (status) {
      handleProviderStatusChange('PENNYLANE', !!status.connected);
    }
  }, [status, handleProviderStatusChange]);

  // ─── Tarification dynamique (PriceLabs, Beyond) ───────────────────────────
  const [openPricingProvider, setOpenPricingProvider] = useState<PricingProvider | null>(null);
  const [connectedPricing, setConnectedPricing] = useState<Set<PricingProvider>>(new Set());
  const handlePricingStatusChange = useCallback((p: PricingProvider, connected: boolean) => {
    setConnectedPricing((prev) => {
      const next = new Set(prev);
      if (connected) next.add(p); else next.delete(p);
      return next;
    });
  }, []);

  // ─── Comptabilite (QuickBooks / Xero / Sage) ──────────────────────────────
  type AccountingProvider = 'QUICKBOOKS' | 'XERO' | 'SAGE';
  const [openAccountingProvider, setOpenAccountingProvider] = useState<AccountingProvider | null>(null);
  const [connectedAccounting, setConnectedAccounting] = useState<Set<AccountingProvider>>(new Set());
  const handleAccountingStatusChange = useCallback((p: AccountingProvider, connected: boolean) => {
    setConnectedAccounting((prev) => {
      const next = new Set(prev);
      if (connected) next.add(p); else next.delete(p);
      return next;
    });
  }, []);

  // ─── Conformite legale (Chekin / Police MA / Absher KSA) ─────────────────
  const [openComplianceProvider, setOpenComplianceProvider] = useState<ComplianceProvider | null>(null);
  const [connectedCompliance, setConnectedCompliance] = useState<Set<ComplianceProvider>>(new Set());
  const handleComplianceStatusChange = useCallback((p: ComplianceProvider, connected: boolean) => {
    setConnectedCompliance((prev) => {
      const next = new Set(prev);
      if (connected) next.add(p); else next.delete(p);
      return next;
    });
  }, []);

  // ─── KYC (Sumsub / Veriff / Onfido) ──────────────────────────────────────
  const [openKycProvider, setOpenKycProvider] = useState<KycProvider | null>(null);
  const [connectedKyc, setConnectedKyc] = useState<Set<KycProvider>>(new Set());
  const handleKycStatusChange = useCallback((p: KycProvider, connected: boolean) => {
    setConnectedKyc((prev) => {
      const next = new Set(prev);
      if (connected) next.add(p); else next.delete(p);
      return next;
    });
  }, []);

  // ─── Channel Manager (SiteMinder / Hostaway / Rentals United) ───────────
  const [openChannelManagerProvider, setOpenChannelManagerProvider] = useState<ChannelManagerProvider | null>(null);
  const [channexDialogOpen, setChannexDialogOpen] = useState(false);
  const [connectedChannelManager, setConnectedChannelManager] = useState<Set<ChannelManagerProvider>>(new Set());
  const handleChannelManagerStatusChange = useCallback((p: ChannelManagerProvider, connected: boolean) => {
    setConnectedChannelManager((prev) => {
      const next = new Set(prev);
      if (connected) next.add(p); else next.delete(p);
      return next;
    });
  }, []);

  // ─── Filtre par categorie + service (state hoiste dans Settings.tsx) ──
  // {@code selectedCategoryId} : null = "Toutes", sinon ID de la categorie
  // visible unique. {@code showSection(id)} dit si une section s'affiche.
  // {@code selectedServiceId} : null = toutes les cards visibles, sinon
  // l'ID du seul service a afficher. {@code matchesService(id)} dit si
  // une card individuelle doit etre rendue.
  const showSection = useCallback(
    (categoryId: string): boolean =>
      selectedCategoryId === null || selectedCategoryId === categoryId,
    [selectedCategoryId],
  );
  const matchesService = useCallback(
    (serviceId: string): boolean =>
      selectedServiceId === null || selectedServiceId === serviceId,
    [selectedServiceId],
  );

  // Au mount : detecte les connexions deja existantes pour pricing + accounting
  // pour afficher les badges "Configure" sur les cards. PAS d'ouverture
  // automatique de modal — l'utilisateur clique explicitement pour configurer.
  useEffect(() => {
    const safe = async <T extends { connected: boolean }>(p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch { return null; }
    };
    Promise.all([
      safe(pricingConnectionApi.getStatus('PRICELABS')),
      safe(pricingConnectionApi.getStatus('BEYOND')),
      safe(pricingConnectionApi.getStatus('WHEELHOUSE')),
      safe(quickbooksApi.getStatus()),
      safe(xeroApi.getStatus()),
      safe(sageApi.getStatus()),
      safe(complianceConnectionApi.getStatus('CHEKIN')),
      safe(complianceConnectionApi.getStatus('POLICE_MA')),
      safe(complianceConnectionApi.getStatus('ABSHER_KSA')),
      safe(kycConnectionApi.getStatus('SUMSUB')),
      safe(kycConnectionApi.getStatus('VERIFF')),
      safe(kycConnectionApi.getStatus('ONFIDO')),
      safe(channelManagerConnectionApi.getStatus('SITEMINDER')),
      safe(channelManagerConnectionApi.getStatus('HOSTAWAY')),
      safe(channelManagerConnectionApi.getStatus('RENTALS_UNITED')),
      safe(channelManagerConnectionApi.getStatus('CHANNEX')),
    ]).then(([pl, beyond, wheelhouse, qb, xero, sage, chekin, policeMa, absherKsa,
              sumsub, veriff, onfido, siteminder, hostaway, rentalsUnited, channex]) => {
      const configuredPricing = new Set<PricingProvider>();
      if (pl?.connected) configuredPricing.add('PRICELABS');
      if (beyond?.connected) configuredPricing.add('BEYOND');
      if (wheelhouse?.connected) configuredPricing.add('WHEELHOUSE');
      setConnectedPricing(configuredPricing);

      const configuredAccounting = new Set<AccountingProvider>();
      if (qb?.connected) configuredAccounting.add('QUICKBOOKS');
      if (xero?.connected) configuredAccounting.add('XERO');
      if (sage?.connected) configuredAccounting.add('SAGE');
      setConnectedAccounting(configuredAccounting);

      const configuredCompliance = new Set<ComplianceProvider>();
      if (chekin?.connected) configuredCompliance.add('CHEKIN');
      if (policeMa?.connected) configuredCompliance.add('POLICE_MA');
      if (absherKsa?.connected) configuredCompliance.add('ABSHER_KSA');
      setConnectedCompliance(configuredCompliance);

      const configuredKyc = new Set<KycProvider>();
      if (sumsub?.connected) configuredKyc.add('SUMSUB');
      if (veriff?.connected) configuredKyc.add('VERIFF');
      if (onfido?.connected) configuredKyc.add('ONFIDO');
      setConnectedKyc(configuredKyc);

      const configuredCM = new Set<ChannelManagerProvider>();
      if (siteminder?.connected) configuredCM.add('SITEMINDER');
      if (hostaway?.connected) configuredCM.add('HOSTAWAY');
      if (rentalsUnited?.connected) configuredCM.add('RENTALS_UNITED');
      if (channex?.connected) configuredCM.add('CHANNEX');
      setConnectedChannelManager(configuredCM);
    });
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const [s, ss] = await Promise.all([
        pennylaneApi.getStatus(),
        pennylaneApi.getSyncStatus().catch(() => null),
      ]);
      setStatus(s);
      if (ss) setSyncStatus(ss);
    } catch (err) {
      const httpStatus = (err as { status?: number } | null)?.status;
      if (httpStatus === 404) {
        // Feature Pennylane desactivee cote backend (env sans client-id configure).
        // On bascule en mode "non configure" silencieux — ni erreur ni warning.
        setNotConfigured(true);
      } else {
        setStatus({ connected: false });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Au mount : on detecte tous les providers deja connectes pour afficher
  // le badge "Configure" et focus automatiquement le premier d'entre eux.
  // 404 = provider non active cote backend (env sans client-id) — ignore.
  useEffect(() => {
    const safeStatus = async <T extends { connected: boolean }>(p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch { return null; }
    };

    Promise.all([
      safeStatus(externalConnectionApi.getStatus('YOUSIGN')),
      safeStatus(externalConnectionApi.getStatus('UNIVERSIGN')),
      safeStatus(externalConnectionApi.getStatus('DOCAPOSTE')),
      safeStatus(externalConnectionApi.getStatus('ODOO')),
      safeStatus(pennylaneApi.getStatus()),
      safeStatus(docusignApi.getStatus()),
    ]).then(([yousign, universign, docaposte, odoo, pennylane, docusign]) => {
      const configured = new Set<SelectableProvider>();
      if (yousign?.connected)    configured.add('YOUSIGN');
      if (universign?.connected) configured.add('UNIVERSIGN');
      if (docaposte?.connected)  configured.add('DOCAPOSTE');
      if (odoo?.connected)       configured.add('ODOO');
      if (pennylane?.connected)  configured.add('PENNYLANE');
      if (docusign?.connected)   configured.add('DOCUSIGN');
      setConnectedProviders(configured);
      // Pas d'ouverture automatique de modal — les badges "Configure" sur
      // les cards suffisent a indiquer l'etat. L'utilisateur clique pour
      // configurer.
    });
  }, []);

  const handleConnect = async () => {
    try {
      const result = await pennylaneApi.connect();
      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      }
    } catch {
      setSyncMessage({ type: 'error', text: t('settings.integrations.pennylane.connectionError') });
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await pennylaneApi.disconnect();
      setStatus({ connected: false });
      setSyncStatus(null);
      setDisconnectDialogOpen(false);
      setSyncMessage({ type: 'success', text: t('settings.integrations.pennylane.disconnected') });
    } catch {
      setSyncMessage({ type: 'error', text: t('settings.integrations.pennylane.disconnectError') });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async (type: 'invoices' | 'expenses' | 'all') => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      if (type === 'invoices') {
        const result = await pennylaneApi.syncInvoices();
        setSyncMessage({
          type: result.failed > 0 ? 'error' : 'success',
          text: `${result.synced} ${t('settings.integrations.pennylane.invoicesSynced')}${result.failed > 0 ? ` (${result.failed} ${t('settings.integrations.pennylane.failed')})` : ''}`,
        });
      } else if (type === 'expenses') {
        const result = await pennylaneApi.syncExpenses();
        setSyncMessage({
          type: result.failed > 0 ? 'error' : 'success',
          text: `${result.synced} ${t('settings.integrations.pennylane.expensesSynced')}${result.failed > 0 ? ` (${result.failed} ${t('settings.integrations.pennylane.failed')})` : ''}`,
        });
      } else {
        const result = await pennylaneApi.syncAll();
        const totalSynced = result.invoices.synced + result.expenses.synced;
        const totalFailed = result.invoices.failed + result.expenses.failed;
        setSyncMessage({
          type: totalFailed > 0 ? 'error' : 'success',
          text: `${totalSynced} ${t('settings.integrations.pennylane.elementsSynced')}${totalFailed > 0 ? ` (${totalFailed} ${t('settings.integrations.pennylane.failed')})` : ''}`,
        });
      }
      const ss = await pennylaneApi.getSyncStatus().catch(() => null);
      if (ss) setSyncStatus(ss);
    } catch {
      setSyncMessage({ type: 'error', text: t('settings.integrations.pennylane.syncError') });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const isConnected = !!status?.connected;
  const statusChip = notConfigured ? (
    <Chip
      icon={<ErrorOutline size={11} strokeWidth={2} />}
      label={t('settings.integrations.pennylane.notConfigured', 'Non configuré')}
      size="small"
      sx={buildStatusChipSx(NEUTRAL)}
    />
  ) : isConnected ? (
    <Chip
      icon={<CheckCircleIcon size={11} strokeWidth={2} />}
      label={t('settings.integrations.pennylane.connected')}
      size="small"
      sx={buildStatusChipSx(ACCENT)}
    />
  ) : (
    <Chip
      icon={<ErrorOutline size={11} strokeWidth={2} />}
      label={t('settings.integrations.pennylane.notConnected')}
      size="small"
      sx={buildStatusChipSx(NEUTRAL)}
    />
  );

  return (
    <Box>
      {/* ─── Section : Marketing & Newsletter (Brevo — ACTIVE) ─────────── */}
      {showSection('marketing') && (
      <Paper
        id="section-marketing"
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mb: 2,
          px: 2,
          py: 1.75,
          scrollMarginTop: 80,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Marketing &amp; Newsletter</Typography>
          <Chip
            icon={<CheckCircleIcon size={11} strokeWidth={2} />}
            label="Disponible"
            size="small"
            sx={buildStatusChipSx(ACCENT)}
          />
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Synchronisez vos contacts (waitlist, newsletter, leads devis) vers votre plateforme d&apos;emailing pour vos campagnes.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
          }}
        >
          <Box
            role="button"
            tabIndex={0}
            aria-label="Configurer Brevo"
            onClick={() => setOpenMarketing(true)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setOpenMarketing(true);
              }
            }}
            sx={{
              position: 'relative',
              cursor: 'pointer',
              p: 1,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: marketingConfigured ? `${ACCENT}55` : 'divider',
              backgroundColor: marketingConfigured ? `${ACCENT}05` : 'background.paper',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minHeight: 56,
              outline: 'none',
              transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              '&:hover': {
                borderColor: ACCENT,
                backgroundColor: `${ACCENT}08`,
                boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
              },
              '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#0B996E',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              B
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>Brevo</Typography>
              <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                Emailing · Waitlist &amp; Newsletter · API key
              </Typography>
            </Box>
            {marketingConfigured && (
              <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                <CheckCircleIcon size={14} strokeWidth={2.5} />
              </Box>
            )}
          </Box>
        </Box>
      </Paper>
      )}
      <IntegrationConfigDialog open={openMarketing} onClose={() => setOpenMarketing(false)}>
        <BrevoConfigCard />
      </IntegrationConfigDialog>

      {/* ─── Choix du provider signature (radio) ──────────────────────── */}
      {showSection('signature') && (
      <Paper
        id="section-signature"
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mb: 2,
          px: 2,
          py: 1.75,
          scrollMarginTop: 80,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
            {t('settings.integrations.signatureProvider.title', 'Signature electronique')}
          </Typography>
          <Chip label="Bientôt disponible" size="small" sx={COMING_SOON_CHIP_SX} />
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          {t(
            'settings.integrations.signatureProvider.description',
            'Activez et configurez plusieurs fournisseurs en parallele. Chaque connexion est independante.',
          )}
        </Typography>
        <Box
          sx={DISABLED_CARDS_SX}
          aria-disabled="true"
          onClickCapture={blockInteraction}
          onKeyDownCapture={blockInteraction}
        >
          <SignatureProviderCards
            value={openSignatureProvider}
            onChange={(next) => setOpenSignatureProvider(next)}
            connectedSet={connectedProviders}
            serviceFilter={selectedServiceId}
          />
        </Box>
        {providerMessage && (
          <Alert
            severity={providerMessage.type}
            variant="outlined"
            sx={{ mt: 1.25, borderRadius: '8px', fontSize: '0.75rem', py: 0.25 }}
          >
            {providerMessage.text}
          </Alert>
        )}
      </Paper>
      )}

      {/* ─── Modal Pennylane (OAuth — inline car gere son propre sync) ── */}
      <IntegrationConfigDialog
        open={openSignatureProvider === 'PENNYLANE'}
        onClose={() => setOpenSignatureProvider(null)}
        maxWidth="md"
      >
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.75,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            borderBottom: isConnected ? '1px solid' : undefined,
            borderColor: 'divider',
          }}
        >
          {/* Brand tile */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: PENNYLANE_BRAND,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.04em',
              flexShrink: 0,
              boxShadow: `0 1px 2px ${PENNYLANE_BRAND}1F`,
            }}
            aria-hidden="true"
          >
            {PENNYLANE_INITIALS}
          </Box>
          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              fontWeight={600}
              sx={{
                fontSize: '0.95rem',
                lineHeight: 1.25,
                color: 'text.primary',
                letterSpacing: '-0.005em',
              }}
            >
              {t('settings.integrations.pennylane.title')}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: 'text.secondary',
                lineHeight: 1.4,
                mt: 0.25,
              }}
            >
              {t('settings.integrations.pennylane.description')}
            </Typography>
          </Box>
          {/* Status chip */}
          <Box sx={{ flexShrink: 0 }}>{statusChip}</Box>
        </Box>

        {/* Body */}
        <Box sx={{ p: 2 }}>
          {isConnected ? (
            <>
              {/* Connection metadata */}
              {(status?.connectedAt || status?.lastSyncAt) && (
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                  {status.connectedAt && (
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: 'text.secondary',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <Typography component="span" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.72rem' }}>
                        {t('settings.integrations.pennylane.connectedAt')} :
                      </Typography>{' '}
                      {new Date(status.connectedAt).toLocaleDateString('fr-FR')}
                    </Typography>
                  )}
                  {status.lastSyncAt && (
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: 'text.secondary',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <Typography component="span" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.72rem' }}>
                        {t('settings.integrations.pennylane.lastSync')} :
                      </Typography>{' '}
                      {new Date(status.lastSyncAt).toLocaleString('fr-FR')}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Sync stats */}
              {syncStatus && (
                <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<ReceiptIcon size={11} strokeWidth={2} />}
                    label={`${syncStatus.pendingInvoices} ${t('settings.integrations.pennylane.pendingInvoices')}`}
                    size="small"
                    sx={buildStatusChipSx(syncStatus.pendingInvoices > 0 ? WARM : NEUTRAL)}
                  />
                  <Chip
                    icon={<ShoppingCartIcon size={11} strokeWidth={2} />}
                    label={`${syncStatus.pendingExpenses} ${t('settings.integrations.pennylane.pendingExpenses')}`}
                    size="small"
                    sx={buildStatusChipSx(syncStatus.pendingExpenses > 0 ? WARM : NEUTRAL)}
                  />
                </Box>
              )}

              <Divider sx={{ mb: 1.5, borderColor: 'divider' }} />

              {/* Sync actions */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    syncing ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <ReceiptIcon size={14} strokeWidth={1.75} />
                    )
                  }
                  onClick={() => handleSync('invoices')}
                  disabled={syncing}
                  sx={refinedOutlinedSx(PRIMARY)}
                >
                  {t('settings.integrations.pennylane.syncInvoices')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    syncing ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <ShoppingCartIcon size={14} strokeWidth={1.75} />
                    )
                  }
                  onClick={() => handleSync('expenses')}
                  disabled={syncing}
                  sx={refinedOutlinedSx(PRIMARY)}
                >
                  {t('settings.integrations.pennylane.syncExpenses')}
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={
                    syncing ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <SyncIcon size={14} strokeWidth={2} />
                    )
                  }
                  onClick={() => handleSync('all')}
                  disabled={syncing}
                  sx={refinedContainedSx(ACCENT)}
                >
                  {syncing
                    ? t('settings.integrations.pennylane.syncing')
                    : t('settings.integrations.pennylane.syncAll')}
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkOffIcon size={14} strokeWidth={1.75} />}
                  onClick={() => setDisconnectDialogOpen(true)}
                  sx={refinedOutlinedSx(DANGER)}
                >
                  {t('settings.integrations.pennylane.disconnect')}
                </Button>
              </Box>
            </>
          ) : notConfigured ? (
            <Alert
              severity="info"
              variant="outlined"
              sx={{
                mt: 0,
                borderRadius: '8px',
                fontSize: '0.8rem',
                '& .MuiAlert-message': { padding: '4px 0' },
              }}
            >
              {t(
                'settings.integrations.pennylane.notConfiguredHelp',
                "Cette intégration n'est pas activée sur cet environnement. Contactez votre administrateur pour configurer Pennylane.",
              )}
            </Alert>
          ) : (
            <Button
              variant="contained"
              disableElevation
              size="small"
              startIcon={<LinkIcon size={14} strokeWidth={2} />}
              onClick={handleConnect}
              sx={refinedContainedSx(PRIMARY)}
            >
              {t('settings.integrations.pennylane.connect')}
            </Button>
          )}

          {/* Sync feedback */}
          {syncMessage && (
            <Alert
              severity={syncMessage.type}
              sx={{ mt: 1.75, borderRadius: '8px' }}
              onClose={() => setSyncMessage(null)}
            >
              {syncMessage.text}
            </Alert>
          )}
        </Box>
      </Paper>
      </IntegrationConfigDialog>

      {/* ─── Modals de config signature (QTSP, Odoo, DocuSign) ────────── */}
      <IntegrationConfigDialog
        open={openSignatureProvider === 'YOUSIGN'}
        onClose={() => setOpenSignatureProvider(null)}
      >
        <ApiKeyProviderCard
          provider="YOUSIGN"
          onStatusChange={(c) => handleProviderStatusChange('YOUSIGN', c)}
        />
      </IntegrationConfigDialog>
      <IntegrationConfigDialog
        open={openSignatureProvider === 'UNIVERSIGN'}
        onClose={() => setOpenSignatureProvider(null)}
      >
        <ApiKeyProviderCard
          provider="UNIVERSIGN"
          onStatusChange={(c) => handleProviderStatusChange('UNIVERSIGN', c)}
        />
      </IntegrationConfigDialog>
      <IntegrationConfigDialog
        open={openSignatureProvider === 'DOCAPOSTE'}
        onClose={() => setOpenSignatureProvider(null)}
      >
        <ApiKeyProviderCard
          provider="DOCAPOSTE"
          onStatusChange={(c) => handleProviderStatusChange('DOCAPOSTE', c)}
        />
      </IntegrationConfigDialog>
      <IntegrationConfigDialog
        open={openSignatureProvider === 'DOCUSIGN'}
        onClose={() => setOpenSignatureProvider(null)}
      >
        <OAuthProviderCard
          providerId="DOCUSIGN"
          label="DocuSign"
          description="Signature électronique mondiale · OAuth2 · SES + AES + QES via partenaires QTSP européens"
          api={docusignApi}
          onStatusChange={(c) => handleProviderStatusChange('DOCUSIGN', c)}
        />
      </IntegrationConfigDialog>
      <IntegrationConfigDialog
        open={openSignatureProvider === 'ODOO'}
        onClose={() => setOpenSignatureProvider(null)}
      >
        <ApiKeyProviderCard
          provider="ODOO"
          onStatusChange={(c) => handleProviderStatusChange('ODOO', c)}
        />
      </IntegrationConfigDialog>


      {/* ─── Section : Tarification dynamique (PriceLabs, Beyond) ────── */}
      {showSection('pricing') && (
      <Paper
        id="section-pricing"
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mt: 3,
          mb: 2,
          px: 2,
          py: 1.75,
          scrollMarginTop: 80,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
            Tarification dynamique
          </Typography>
          <Chip label="Bientôt disponible" size="small" sx={COMING_SOON_CHIP_SX} />
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Connectez un moteur de revenue management pour des recommandations de prix automatiques (saisonnalité, demande, événements).
        </Typography>
        <Box
          aria-disabled="true"
          onClickCapture={blockInteraction}
          onKeyDownCapture={blockInteraction}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
            ...DISABLED_CARDS_SX,
          }}
        >
          {([
            { id: 'PRICELABS', label: 'PriceLabs', desc: 'Revenue management · API key' },
            { id: 'BEYOND', label: 'Beyond', desc: 'Algorithme propriétaire · API key' },
            { id: 'WHEELHOUSE', label: 'Wheelhouse', desc: 'Market comparison · API key' },
          ] as const).filter(({ id }) => matchesService(id)).map(({ id: p, label, desc }) => (
            <ServiceTooltip key={p} providerId={p} name={label}>
            <Box
              role="radio"
              aria-checked={openPricingProvider === p}
              tabIndex={0}
              onClick={() => setOpenPricingProvider(p)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setOpenPricingProvider(p);
                }
              }}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                p: 1,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: openPricingProvider === p
                  ? ACCENT
                  : (connectedPricing.has(p) ? `${ACCENT}55` : 'divider'),
                backgroundColor: openPricingProvider === p
                  ? `${ACCENT}10`
                  : (connectedPricing.has(p) ? `${ACCENT}05` : 'background.paper'),
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 56,
                outline: 'none',
                transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': {
                  borderColor: ACCENT,
                  backgroundColor: openPricingProvider === p ? `${ACCENT}14` : `${ACCENT}08`,
                  boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                },
                '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
              }}
            >
              <ProviderLogo provider={p} size={32} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                  {desc}
                </Typography>
              </Box>
              {connectedPricing.has(p) && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                  <CheckCircleIcon size={14} strokeWidth={2.5} />
                </Box>
              )}
            </Box>
            </ServiceTooltip>
          ))}
        </Box>
      </Paper>
      )}
      <IntegrationConfigDialog
        open={openPricingProvider !== null}
        onClose={() => setOpenPricingProvider(null)}
      >
        {openPricingProvider && (
          <PricingProviderCard
            provider={openPricingProvider}
            onStatusChange={(c) => handlePricingStatusChange(openPricingProvider, c)}
          />
        )}
      </IntegrationConfigDialog>

      {/* ─── Section : Comptabilité (QuickBooks) ──────────────────────── */}
      {showSection('accounting') && (
      <Paper
        id="section-accounting"
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mt: 3,
          mb: 2,
          px: 2,
          py: 1.75,
          scrollMarginTop: 80,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
            Comptabilité
          </Typography>
          <Chip label="Bientôt disponible" size="small" sx={COMING_SOON_CHIP_SX} />
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Synchronisez factures et dépenses vers votre logiciel comptable. Pennylane est aussi disponible dans la section signature ci-dessus.
        </Typography>
        <Box
          aria-disabled="true"
          onClickCapture={blockInteraction}
          onKeyDownCapture={blockInteraction}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
            ...DISABLED_CARDS_SX,
          }}
        >
          {([
            { id: 'QUICKBOOKS', label: 'QuickBooks', desc: 'Intuit · OAuth2 · US/UK/CA' },
            { id: 'XERO',       label: 'Xero',       desc: 'OAuth2 · leader UK/AU/NZ' },
            { id: 'SAGE',       label: 'Sage',       desc: 'OAuth2 · leader FR/Europe' },
          ] as const).filter(({ id }) => matchesService(id)).map(({ id: p, label, desc }) => (
            <ServiceTooltip key={p} providerId={p} name={label}>
            <Box
              role="radio"
              aria-checked={openAccountingProvider === p}
              tabIndex={0}
              onClick={() => setOpenAccountingProvider(p)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setOpenAccountingProvider(p);
                }
              }}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                p: 1,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: openAccountingProvider === p
                  ? ACCENT
                  : (connectedAccounting.has(p) ? `${ACCENT}55` : 'divider'),
                backgroundColor: openAccountingProvider === p
                  ? `${ACCENT}10`
                  : (connectedAccounting.has(p) ? `${ACCENT}05` : 'background.paper'),
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 56,
                outline: 'none',
                transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': {
                  borderColor: ACCENT,
                  backgroundColor: openAccountingProvider === p ? `${ACCENT}14` : `${ACCENT}08`,
                  boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                },
                '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
              }}
            >
              <ProviderLogo provider={p} size={32} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                  {desc}
                </Typography>
              </Box>
              {connectedAccounting.has(p) && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                  <CheckCircleIcon size={14} strokeWidth={2.5} />
                </Box>
              )}
            </Box>
            </ServiceTooltip>
          ))}
        </Box>
      </Paper>
      )}
      <IntegrationConfigDialog
        open={openAccountingProvider !== null}
        onClose={() => setOpenAccountingProvider(null)}
      >
        {openAccountingProvider === 'QUICKBOOKS' && (
          <OAuthProviderCard
            providerId="QUICKBOOKS"
            label="QuickBooks"
            description="Synchronisation comptable temps réel · OAuth2 Intuit · sandbox + production"
            api={quickbooksApi}
            onStatusChange={(c) => handleAccountingStatusChange('QUICKBOOKS', c)}
          />
        )}
        {openAccountingProvider === 'XERO' && (
          <OAuthProviderCard
            providerId="XERO"
            label="Xero"
            description="Comptabilité cloud leader UK / Australie / Nouvelle-Zélande · OAuth2 multi-tenant"
            api={xeroApi}
            onStatusChange={(c) => handleAccountingStatusChange('XERO', c)}
          />
        )}
        {openAccountingProvider === 'SAGE' && (
          <OAuthProviderCard
            providerId="SAGE"
            label="Sage"
            description="Sage Business Cloud Accounting · leader France et Europe · OAuth2 multi-business"
            api={sageApi}
            onStatusChange={(c) => handleAccountingStatusChange('SAGE', c)}
          />
        )}
      </IntegrationConfigDialog>

      {/* ─── Section : Conformité légale (Chekin / Police MA / Absher KSA) ── */}
      {showSection('compliance') && (
      <Paper
        id="section-compliance"
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mt: 3,
          mb: 2,
          px: 2,
          py: 1.75,
          scrollMarginTop: 80,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
            Conformité légale
          </Typography>
          <Chip label="Bientôt disponible" size="small" sx={COMING_SOON_CHIP_SX} />
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Automatisez la déclaration légale des voyageurs auprès des autorités locales (fiche police France, DGSN Maroc, Absher Arabie Saoudite). Évite les amendes et les contrôles surprises.
        </Typography>
        <Box
          aria-disabled="true"
          onClickCapture={blockInteraction}
          onKeyDownCapture={blockInteraction}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
            ...DISABLED_CARDS_SX,
          }}
        >
          {([
            { id: 'CHEKIN',     label: 'Chekin',              desc: 'Fiche police FR · API key',     flag: '🇫🇷' },
            { id: 'POLICE_MA',  label: 'Police Maroc',        desc: 'DGSN · déclaration voyageur',   flag: '🇲🇦' },
            { id: 'ABSHER_KSA', label: 'Absher',              desc: 'MOI Arabie Saoudite · KYC',     flag: '🇸🇦' },
          ] as const).filter(({ id }) => matchesService(id)).map(({ id: p, label, desc, flag }) => (
            <ServiceTooltip key={p} providerId={p} name={label}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => setOpenComplianceProvider(p)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setOpenComplianceProvider(p);
                }
              }}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                p: 1,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: openComplianceProvider === p
                  ? ACCENT
                  : (connectedCompliance.has(p) ? `${ACCENT}55` : 'divider'),
                backgroundColor: openComplianceProvider === p
                  ? `${ACCENT}10`
                  : (connectedCompliance.has(p) ? `${ACCENT}05` : 'background.paper'),
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 56,
                outline: 'none',
                transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': {
                  borderColor: ACCENT,
                  backgroundColor: openComplianceProvider === p ? `${ACCENT}14` : `${ACCENT}08`,
                  boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                },
                '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
              }}
            >
              <ProviderLogo provider={p} size={32} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>
                    {label}
                  </Typography>
                  <span aria-hidden="true" style={{ fontSize: '0.78rem' }}>{flag}</span>
                </Box>
                <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                  {desc}
                </Typography>
              </Box>
              {connectedCompliance.has(p) && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                  <CheckCircleIcon size={14} strokeWidth={2.5} />
                </Box>
              )}
            </Box>
            </ServiceTooltip>
          ))}
        </Box>
      </Paper>
      )}
      <IntegrationConfigDialog
        open={openComplianceProvider !== null}
        onClose={() => setOpenComplianceProvider(null)}
      >
        {openComplianceProvider && (
          <ComplianceProviderCard
            provider={openComplianceProvider}
            onStatusChange={(c) => handleComplianceStatusChange(openComplianceProvider, c)}
          />
        )}
      </IntegrationConfigDialog>

      {/* ─── Section : KYC / Vérification d'identité ─────────────────── */}
      {showSection('kyc') && (
      <Paper
        id="section-kyc"
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mt: 3,
          mb: 2,
          px: 2,
          py: 1.75,
          scrollMarginTop: 80,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
            Vérification d'identité (KYC)
          </Typography>
          <Chip label="Bientôt disponible" size="small" sx={COMING_SOON_CHIP_SX} />
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Vérification automatique des pièces d'identité des voyageurs (lutte contre la fraude, conformité LCB-FT). Indispensable pour les paiements sur compte et les réservations à forte valeur.
        </Typography>
        <Box
          aria-disabled="true"
          onClickCapture={blockInteraction}
          onKeyDownCapture={blockInteraction}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
            ...DISABLED_CARDS_SX,
          }}
        >
          {([
            { id: 'SUMSUB', label: 'Sumsub',  desc: 'Leader MENA · KYC + KYB' },
            { id: 'VERIFF', label: 'Veriff',  desc: 'Qualité/prix · EU + MENA' },
            { id: 'ONFIDO', label: 'Onfido',  desc: 'Premium · UX exceptionnelle' },
          ] as const).filter(({ id }) => matchesService(id)).map(({ id: p, label, desc }) => (
            <ServiceTooltip key={p} providerId={p} name={label}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => setOpenKycProvider(p)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setOpenKycProvider(p);
                }
              }}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                p: 1,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: openKycProvider === p
                  ? ACCENT
                  : (connectedKyc.has(p) ? `${ACCENT}55` : 'divider'),
                backgroundColor: openKycProvider === p
                  ? `${ACCENT}10`
                  : (connectedKyc.has(p) ? `${ACCENT}05` : 'background.paper'),
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 56,
                outline: 'none',
                transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': {
                  borderColor: ACCENT,
                  backgroundColor: openKycProvider === p ? `${ACCENT}14` : `${ACCENT}08`,
                  boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                },
                '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
              }}
            >
              <ProviderLogo provider={p} size={32} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                  {desc}
                </Typography>
              </Box>
              {connectedKyc.has(p) && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                  <CheckCircleIcon size={14} strokeWidth={2.5} />
                </Box>
              )}
            </Box>
            </ServiceTooltip>
          ))}
        </Box>
      </Paper>
      )}
      <IntegrationConfigDialog
        open={openKycProvider !== null}
        onClose={() => setOpenKycProvider(null)}
      >
        {openKycProvider && (
          <KycProviderCard
            provider={openKycProvider}
            onStatusChange={(c) => handleKycStatusChange(openKycProvider, c)}
          />
        )}
      </IntegrationConfigDialog>

      {/* ─── Section : Channel Manager (middleware OTAs) ──────────────── */}
      {showSection('channel_manager') && (
      <Paper
        id="section-channel-manager"
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mt: 3,
          mb: 2,
          px: 2,
          py: 1.75,
          scrollMarginTop: 80,
        }}
      >
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
          Channel Manager (middleware)
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Connectez un middleware qui agrège plusieurs OTAs en une seule API — utile pour les marchés niches ou régionaux sans intégration directe. Les OTAs eux-mêmes (Airbnb, Booking, Vrbo) restent dans la tab <strong>Channels</strong>.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
          }}
        >
          {([
            { id: 'CHANNEX',        label: 'Channex',        desc: '100+ OTAs · REST moderne · ~12 €/bien', comingSoon: false },
            { id: 'RENTALS_UNITED', label: 'Rentals United', desc: '60+ OTAs · EU + MENA',                  comingSoon: true  },
            { id: 'HOSTAWAY',       label: 'Hostaway',       desc: 'Focus STR · Airbnb natif',              comingSoon: true  },
            { id: 'SITEMINDER',     label: 'SiteMinder',     desc: '~250 OTAs · leader mondial',            comingSoon: true  },
          ] as const).filter(({ id }) => matchesService(id)).map(({ id: p, label, desc, comingSoon }) => (
            <ServiceTooltip key={p} providerId={p} name={label}>
            <Box
              role="button"
              tabIndex={comingSoon ? -1 : 0}
              aria-disabled={comingSoon || undefined}
              onClick={comingSoon ? undefined : () => {
                if (p === 'CHANNEX') setChannexDialogOpen(true);
                else setOpenChannelManagerProvider(p);
              }}
              onKeyDown={comingSoon ? undefined : (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  if (p === 'CHANNEX') setChannexDialogOpen(true);
                  else setOpenChannelManagerProvider(p);
                }
              }}
              sx={{
                position: 'relative',
                cursor: comingSoon ? 'not-allowed' : 'pointer',
                p: 1,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: openChannelManagerProvider === p
                  ? ACCENT
                  : (connectedChannelManager.has(p) ? `${ACCENT}55` : 'divider'),
                backgroundColor: openChannelManagerProvider === p
                  ? `${ACCENT}10`
                  : (connectedChannelManager.has(p) ? `${ACCENT}05` : 'background.paper'),
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 56,
                opacity: comingSoon ? 0.55 : 1,
                filter: comingSoon ? 'grayscale(0.7)' : 'none',
                userSelect: comingSoon ? 'none' : 'auto',
                outline: 'none',
                transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': comingSoon ? {} : {
                  borderColor: ACCENT,
                  backgroundColor: openChannelManagerProvider === p ? `${ACCENT}14` : `${ACCENT}08`,
                  boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                },
                '&:focus-visible': comingSoon ? {} : { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
              }}
            >
              <ProviderLogo provider={p} size={32} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                  {desc}
                </Typography>
              </Box>
              {comingSoon ? (
                <Chip label="Bientôt" size="small" sx={{ ...COMING_SOON_CHIP_SX, position: 'absolute', top: 4, right: 4 }} />
              ) : connectedChannelManager.has(p) && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                  <CheckCircleIcon size={14} strokeWidth={2.5} />
                </Box>
              )}
            </Box>
            </ServiceTooltip>
          ))}
        </Box>
      </Paper>
      )}
      <IntegrationConfigDialog
        open={openChannelManagerProvider !== null}
        onClose={() => setOpenChannelManagerProvider(null)}
      >
        {openChannelManagerProvider && (
          <ChannelManagerProviderCard
            provider={openChannelManagerProvider}
            onStatusChange={(c) => handleChannelManagerStatusChange(openChannelManagerProvider, c)}
          />
        )}
      </IntegrationConfigDialog>

      {/* Channex : dialog dedie (mapping par property au lieu d'API key globale) */}
      <ChannexMappingDialog
        open={channexDialogOpen}
        onClose={() => {
          setChannexDialogOpen(false);
          // Refresh du statut "connecte" pour la card Channex
          channelManagerConnectionApi.getStatus('CHANNEX').then((status) => {
            setConnectedChannelManager((prev) => {
              const next = new Set(prev);
              if (status?.connected) next.add('CHANNEX');
              else next.delete('CHANNEX');
              return next;
            });
          }).catch(() => { /* ignore */ });
        }}
      />

      {/* ─── Section : OTAs (vitrine — gestion dans tab Channels) ────── */}
      {showSection('ota') && (
        <Box id="section-ota" sx={{ scrollMarginTop: 80 }}>
          <OtaShowcaseSection serviceFilter={selectedServiceId} disabled />
        </Box>
      )}

      {/* ─── Sections catalogue (services informatifs avec tooltips riches) ─── */}
      {showSection('messaging') && (
        <Box id="section-messaging" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="messaging"
            title="Messagerie"
            description="Envoyez emails, SMS et messages WhatsApp directement via les APIs natives des providers, sans intermédiaire."
          />
        </Box>
      )}
      {showSection('market_intelligence') && (
        <Box id="section-market-intelligence" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="market_intelligence"
            title="Intelligence de marché"
            description="Données de marché Airbnb / Vrbo : ADR, taux d'occupation, RevPAR par zone pour vos hosts."
          />
        </Box>
      )}
      {showSection('tax_automation') && (
      <Box id="section-tax" sx={{ scrollMarginTop: 80 }}>
        <ServiceCatalogSection
          disabled
          serviceFilter={selectedServiceId}
          category="tax_automation"
          title="Fiscalité — Taxe de séjour"
          description="Calcul, collecte et déclaration automatique de la taxe de séjour. Compatible barèmes France et international."
        />
      </Box>
      )}
      {showSection('insurance') && (
        <Box id="section-insurance" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="insurance"
            title="Assurance & screening"
            description="Vérification des guests, caution dommages, assurances annulation. Réduisez les risques et générez du revenu d'affiliation."
          />
        </Box>
      )}
      {showSection('cleaning_operations') && (
        <Box id="section-cleaning" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="cleaning_operations"
            title="Ménage & opérations"
            description="Marketplaces de cleaners, checklists photo, gestion des inspections. Industrialisez les turnovers."
          />
        </Box>
      )}
      {showSection('smart_locks_iot') && (
        <Box id="section-smart-locks" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="smart_locks_iot"
            title="Serrures connectées & IoT"
            description="Serrures Bluetooth, thermostats, capteurs. Codes guests dynamiques, économies énergie, supervision à distance."
          />
        </Box>
      )}
      {showSection('key_management') && (
        <Box id="section-key-management" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="key_management"
            title="Gestion des clés"
            description="Réseaux de gardiens de clés pour les logements sans serrure connectée. Solution propriétaire Baitly ou partenaires externes."
          />
        </Box>
      )}
      {showSection('noise_monitoring') && (
        <Box id="section-noise" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="noise_monitoring"
            title="Monitoring sonore"
            description="Surveillez le niveau de bruit en temps réel pour prévenir les nuisances et protéger vos relations de voisinage. Hardware Baitly ou capteur partenaire."
          />
        </Box>
      )}
      {showSection('activities_affiliate') && (
        <Box id="section-activities" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="activities_affiliate"
            title="Activités & affiliation"
            description="Vendez des activités à vos guests en cross-sell. Commission affiliée 8-20 % par réservation."
          />
        </Box>
      )}
      {showSection('reviews_reputation') && (
        <Box id="section-reviews" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="reviews_reputation"
            title="Avis & réputation"
            description="Agrégation multi-canaux, sentiment analysis, automated responses. Suivez votre réputation cross-OTA."
          />
        </Box>
      )}
      {showSection('marketing_crm') && (
        <Box id="section-marketing" sx={{ scrollMarginTop: 80 }}>
          <ServiceCatalogSection
            disabled
            serviceFilter={selectedServiceId}
            category="marketing_crm"
            title="Marketing & CRM"
            description="Email marketing, automation, CRM commercial pour acquisition de nouveaux propriétaires et campagnes guest."
          />
        </Box>
      )}

      {/* ─── Disconnect confirmation dialog ────────────────────────────── */}
      <Dialog
        open={disconnectDialogOpen}
        onClose={() => setDisconnectDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.005em' }}>
          {t('settings.integrations.pennylane.disconnectTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            {t('settings.integrations.pennylane.disconnectConfirm')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDisconnectDialogOpen(false)}
            disabled={disconnecting}
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: '8px',
              color: 'text.secondary',
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={handleDisconnect}
            disabled={disconnecting}
            startIcon={
              disconnecting ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <LinkOffIcon size={14} strokeWidth={1.75} />
              )
            }
            sx={refinedContainedSx(DANGER)}
          >
            {t('settings.integrations.pennylane.disconnect')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
