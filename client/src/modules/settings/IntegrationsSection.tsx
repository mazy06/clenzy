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
import { docusignApi } from '../../services/api/docusignApi';
import { pricingConnectionApi, type PricingProvider } from '../../services/api/pricingConnectionApi';
import { quickbooksApi } from '../../services/api/quickbooksApi';

// ─── Style helpers (Clenzy palette) ─────────────────────────────────────────

const ACCENT = '#4A9B8E';
const PRIMARY = '#6B8A9A';
const DANGER = '#C97A7A';
const NEUTRAL = '#8A8378';
const WARM = '#D4A574';

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

export default function IntegrationsSection() {
  const { t } = useTranslation();

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
  const [activeProvider, setActiveProvider] = useState<SelectableProvider | null>(null);
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
  const [activePricingProvider, setActivePricingProvider] = useState<PricingProvider | null>(null);
  const [connectedPricing, setConnectedPricing] = useState<Set<PricingProvider>>(new Set());
  const handlePricingStatusChange = useCallback((p: PricingProvider, connected: boolean) => {
    setConnectedPricing((prev) => {
      const next = new Set(prev);
      if (connected) next.add(p); else next.delete(p);
      return next;
    });
  }, []);

  // ─── Comptabilite (QuickBooks) ────────────────────────────────────────────
  const [quickbooksActive, setQuickbooksActive] = useState(false);
  const [quickbooksConnected, setQuickbooksConnected] = useState(false);

  // Au mount : detecte les connexions deja existantes pour pricing + quickbooks
  useEffect(() => {
    const safe = async <T extends { connected: boolean }>(p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch { return null; }
    };
    Promise.all([
      safe(pricingConnectionApi.getStatus('PRICELABS')),
      safe(pricingConnectionApi.getStatus('BEYOND')),
      safe(quickbooksApi.getStatus()),
    ]).then(([pl, beyond, qb]) => {
      const configured = new Set<PricingProvider>();
      if (pl?.connected) configured.add('PRICELABS');
      if (beyond?.connected) configured.add('BEYOND');
      setConnectedPricing(configured);
      if (configured.size > 0) {
        setActivePricingProvider(configured.values().next().value!);
      }
      if (qb?.connected) {
        setQuickbooksConnected(true);
        setQuickbooksActive(true);
      }
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
      if (configured.size > 0 && activeProvider === null) {
        setActiveProvider(configured.values().next().value!);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* ─── Choix du provider signature (radio) ──────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mb: 2,
          px: 2,
          py: 1.75,
        }}
      >
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
          {t('settings.integrations.signatureProvider.title', 'Signature electronique')}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          {t(
            'settings.integrations.signatureProvider.description',
            'Activez et configurez plusieurs fournisseurs en parallele. Chaque connexion est independante.',
          )}
        </Typography>
        <SignatureProviderCards
          value={activeProvider}
          onChange={(next) => setActiveProvider(next)}
          connectedSet={connectedProviders}
          disabled={providerLoading}
        />
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

      {/* ─── Pennylane integration card (visible si focus) ───────────── */}
      {activeProvider === 'PENNYLANE' && (
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          overflow: 'hidden',
          transition:
            'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          '&:hover': {
            borderColor: `${PRIMARY}40`,
            boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 12px rgba(45, 55, 72, 0.06)',
          },
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
      )}

      {/* ─── QTSP français — Yousign / Universign / DocaPoste ────────── */}
      {activeProvider === 'YOUSIGN' && (
        <ApiKeyProviderCard
          provider="YOUSIGN"
          onStatusChange={(c) => handleProviderStatusChange('YOUSIGN', c)}
        />
      )}
      {activeProvider === 'UNIVERSIGN' && (
        <ApiKeyProviderCard
          provider="UNIVERSIGN"
          onStatusChange={(c) => handleProviderStatusChange('UNIVERSIGN', c)}
        />
      )}
      {activeProvider === 'DOCAPOSTE' && (
        <ApiKeyProviderCard
          provider="DOCAPOSTE"
          onStatusChange={(c) => handleProviderStatusChange('DOCAPOSTE', c)}
        />
      )}

      {/* ─── DocuSign (OAuth — meme moteur partage que Pennylane) ────── */}
      {activeProvider === 'DOCUSIGN' && (
        <OAuthProviderCard
          providerId="DOCUSIGN"
          label="DocuSign"
          description="Signature électronique mondiale · OAuth2 · SES + AES + QES via partenaires QTSP européens"
          api={docusignApi}
          onStatusChange={(c) => handleProviderStatusChange('DOCUSIGN', c)}
        />
      )}

      {/* ─── Odoo (utilise le composant generique unifie) ────────────── */}
      {activeProvider === 'ODOO' && (
        <ApiKeyProviderCard
          provider="ODOO"
          onStatusChange={(c) => handleProviderStatusChange('ODOO', c)}
        />
      )}


      {/* ─── Section : Tarification dynamique (PriceLabs, Beyond) ────── */}
      <Paper
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
        }}
      >
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
          Tarification dynamique
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Connectez un moteur de revenue management pour des recommandations de prix automatiques (saisonnalité, demande, événements).
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
          }}
        >
          {(['PRICELABS', 'BEYOND'] as const).map((p) => (
            <Box
              key={p}
              role="radio"
              aria-checked={activePricingProvider === p}
              tabIndex={0}
              onClick={() => setActivePricingProvider(p)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setActivePricingProvider(p);
                }
              }}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                p: 1,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: activePricingProvider === p
                  ? ACCENT
                  : (connectedPricing.has(p) ? `${ACCENT}55` : 'divider'),
                backgroundColor: activePricingProvider === p
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
                  backgroundColor: activePricingProvider === p ? `${ACCENT}14` : `${ACCENT}08`,
                  boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                },
                '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
              }}
            >
              <ProviderLogo provider={p} size={32} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>
                  {p === 'PRICELABS' ? 'PriceLabs' : 'Beyond'}
                </Typography>
                <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                  {p === 'PRICELABS' ? 'Revenue management · API key' : 'Algorithme propriétaire · API key'}
                </Typography>
              </Box>
              {connectedPricing.has(p) && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                  <CheckCircleIcon size={14} strokeWidth={2.5} />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Paper>
      {activePricingProvider && (
        <PricingProviderCard
          provider={activePricingProvider}
          onStatusChange={(c) => handlePricingStatusChange(activePricingProvider, c)}
        />
      )}

      {/* ─── Section : Comptabilité (QuickBooks) ──────────────────────── */}
      <Paper
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
        }}
      >
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
          Comptabilité
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Synchronisez factures et dépenses vers votre logiciel comptable. Pennylane est aussi disponible dans la section signature ci-dessus.
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
            role="radio"
            aria-checked={quickbooksActive}
            tabIndex={0}
            onClick={() => setQuickbooksActive((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setQuickbooksActive((v) => !v);
              }
            }}
            sx={{
              position: 'relative',
              cursor: 'pointer',
              p: 1,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: quickbooksActive ? ACCENT : (quickbooksConnected ? `${ACCENT}55` : 'divider'),
              backgroundColor: quickbooksActive ? `${ACCENT}10` : (quickbooksConnected ? `${ACCENT}05` : 'background.paper'),
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minHeight: 56,
              outline: 'none',
              transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              '&:hover': {
                borderColor: ACCENT,
                backgroundColor: quickbooksActive ? `${ACCENT}14` : `${ACCENT}08`,
              },
              '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
            }}
          >
            <ProviderLogo provider="QUICKBOOKS" size={32} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.15 }}>
                QuickBooks
              </Typography>
              <Typography sx={{ fontSize: '0.67rem', color: 'text.secondary', lineHeight: 1.25 }}>
                Intuit · OAuth2 · standard US/UK/CA
              </Typography>
            </Box>
            {quickbooksConnected && (
              <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'inline-flex', color: ACCENT }}>
                <CheckCircleIcon size={14} strokeWidth={2.5} />
              </Box>
            )}
          </Box>
        </Box>
      </Paper>
      {quickbooksActive && (
        <OAuthProviderCard
          providerId="QUICKBOOKS"
          label="QuickBooks"
          description="Synchronisation comptable temps réel · OAuth2 Intuit · sandbox + production"
          api={quickbooksApi}
          onStatusChange={(c) => setQuickbooksConnected(c)}
        />
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
