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
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
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
import { odooApi } from '../../services/api/odooApi';
import type { OdooStatus } from '../../services/api/odooApi';
import { integrationsApi } from '../../services/api/integrationsApi';
import type { SignatureProvider } from '../../services/api/integrationsApi';
import { useTranslation } from '../../hooks/useTranslation';

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

  // ─── Choix radio du provider signature (cross-provider config) ─────────────
  const [signatureProvider, setSignatureProvider] = useState<SignatureProvider>(null);
  const [providerLoading, setProviderLoading] = useState(false);

  // ─── Odoo state ────────────────────────────────────────────────────────────
  const [odooStatus, setOdooStatus] = useState<OdooStatus | null>(null);
  const [odooForm, setOdooForm] = useState({
    serverUrl: '',
    databaseName: '',
    userLogin: '',
    apiKey: '',
  });
  const [odooSubmitting, setOdooSubmitting] = useState(false);
  const [odooMessage, setOdooMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [odooDisconnectOpen, setOdooDisconnectOpen] = useState(false);

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

  // Charge la config integrations (choix radio) + status Odoo au mount.
  // Independant du chargement Pennylane, peut tourner en parallele.
  useEffect(() => {
    integrationsApi.getConfig()
      .then((cfg) => setSignatureProvider(cfg.signatureProvider))
      .catch(() => { /* endpoint pas dispo, on garde null */ });

    odooApi.getStatus()
      .then(setOdooStatus)
      .catch(() => setOdooStatus({ connected: false }));
  }, []);

  const handleProviderChange = useCallback(async (next: SignatureProvider) => {
    setProviderLoading(true);
    try {
      const cfg = await integrationsApi.setSignatureProvider(next);
      setSignatureProvider(cfg.signatureProvider);
    } catch {
      // En cas d'echec, on revert visuellement
      setOdooMessage({
        type: 'error',
        text: t('settings.integrations.providerSwitchError', 'Impossible de mettre a jour le choix.'),
      });
    } finally {
      setProviderLoading(false);
    }
  }, [t]);

  const handleOdooConnect = useCallback(async () => {
    setOdooSubmitting(true);
    setOdooMessage(null);
    try {
      const result = await odooApi.connect(odooForm);
      setOdooStatus(result);
      setOdooMessage({
        type: 'success',
        text: t('settings.integrations.odoo.connected', 'Connexion Odoo etablie.'),
      });
      // Reset apiKey du form pour ne pas la laisser dans le DOM
      setOdooForm((f) => ({ ...f, apiKey: '' }));
    } catch (err) {
      const msg = (err as { body?: { message?: string } } | null)?.body?.message
        ?? t('settings.integrations.odoo.connectionError', 'Connexion Odoo echouee. Verifiez vos credentials.');
      setOdooMessage({ type: 'error', text: msg });
    } finally {
      setOdooSubmitting(false);
    }
  }, [odooForm, t]);

  const handleOdooDisconnect = useCallback(async () => {
    try {
      await odooApi.disconnect();
      setOdooStatus({ connected: false });
      setOdooMessage({
        type: 'success',
        text: t('settings.integrations.odoo.disconnected', 'Connexion Odoo supprimee.'),
      });
    } catch {
      setOdooMessage({
        type: 'error',
        text: t('settings.integrations.odoo.disconnectError', 'Erreur lors de la deconnexion.'),
      });
    } finally {
      setOdooDisconnectOpen(false);
    }
  }, [t]);

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

  const odooConnected = !!odooStatus?.connected;

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
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1.25 }}>
          {t(
            'settings.integrations.signatureProvider.description',
            'Choisissez le fournisseur a utiliser pour les demandes de signature electronique. Un seul fournisseur actif a la fois.',
          )}
        </Typography>
        <FormControl disabled={providerLoading}>
          <RadioGroup
            row
            value={signatureProvider ?? 'NONE'}
            onChange={(e) => {
              const v = e.target.value;
              handleProviderChange(v === 'NONE' ? null : (v as SignatureProvider));
            }}
          >
            <FormControlLabel
              value="PENNYLANE"
              control={<Radio size="small" sx={{ '&.Mui-checked': { color: PRIMARY } }} />}
              label={<Typography sx={{ fontSize: '0.82rem' }}>Pennylane</Typography>}
            />
            <FormControlLabel
              value="ODOO"
              control={<Radio size="small" sx={{ '&.Mui-checked': { color: ACCENT } }} />}
              label={<Typography sx={{ fontSize: '0.82rem' }}>Odoo</Typography>}
            />
            <FormControlLabel
              value="NONE"
              control={<Radio size="small" />}
              label={
                <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                  {t('settings.integrations.signatureProvider.none', 'Aucun')}
                </Typography>
              }
            />
          </RadioGroup>
        </FormControl>
      </Paper>

      {/* ─── Aucun fournisseur selectionne ───────────────────────────── */}
      {signatureProvider === null && (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ borderRadius: '8px', fontSize: '0.8rem' }}
        >
          {t(
            'settings.integrations.signatureProvider.noneHelp',
            "Aucun fournisseur de signature electronique n'est selectionne. Choisissez Pennylane ou Odoo ci-dessus pour configurer la connexion.",
          )}
        </Alert>
      )}

      {/* ─── Pennylane integration card (visible si selectionne) ─────── */}
      {signatureProvider === 'PENNYLANE' && (
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

      {/* ─── Odoo connection card (visible si Odoo selectionne) ─────── */}
      {signatureProvider === 'ODOO' && (
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
          <Box
            sx={{
              px: 2,
              py: 1.75,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: '#714B67', // Odoo brand purple
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              ODOO
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>Odoo</Typography>
              <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                {t(
                  'settings.integrations.odoo.description',
                  'Connectez votre instance Odoo (SaaS ou self-hosted) pour la signature electronique et la comptabilite.',
                )}
              </Typography>
            </Box>
            <Box sx={{ flexShrink: 0 }}>
              {odooConnected ? (
                <Chip
                  icon={<CheckCircleIcon size={11} strokeWidth={2} />}
                  label={t('settings.integrations.odoo.connected', 'Connecte')}
                  size="small"
                  sx={buildStatusChipSx(ACCENT)}
                />
              ) : (
                <Chip
                  icon={<ErrorOutline size={11} strokeWidth={2} />}
                  label={t('settings.integrations.odoo.notConnected', 'Non connecte')}
                  size="small"
                  sx={buildStatusChipSx(NEUTRAL)}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ p: 2 }}>
            {odooConnected ? (
              <Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.25,
                    mb: 1.5,
                    fontSize: '0.78rem',
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Serveur</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{odooStatus?.serverUrl}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Base</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{odooStatus?.databaseName}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Utilisateur</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{odooStatus?.userLogin}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Statut</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{odooStatus?.status}</Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkOffIcon size={14} strokeWidth={2} />}
                  onClick={() => setOdooDisconnectOpen(true)}
                  sx={refinedOutlinedSx(DANGER)}
                >
                  {t('settings.integrations.odoo.disconnect', 'Deconnecter Odoo')}
                </Button>
              </Box>
            ) : (
              <Box
                component="form"
                onSubmit={(e) => { e.preventDefault(); handleOdooConnect(); }}
                sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
              >
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                  {t(
                    'settings.integrations.odoo.formHelp',
                    "Pour generer une API key : Odoo > Preferences utilisateur > Securite > Cles API. L'API key est chiffree avant stockage.",
                  )}
                </Typography>
                <TextField
                  label="URL serveur"
                  placeholder="https://mycompany.odoo.com"
                  size="small"
                  fullWidth
                  required
                  value={odooForm.serverUrl}
                  onChange={(e) => setOdooForm({ ...odooForm, serverUrl: e.target.value })}
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                  <TextField
                    label="Nom de base"
                    placeholder="mycompany"
                    size="small"
                    fullWidth
                    required
                    value={odooForm.databaseName}
                    onChange={(e) => setOdooForm({ ...odooForm, databaseName: e.target.value })}
                  />
                  <TextField
                    label="Login utilisateur"
                    placeholder="admin@mycompany.fr"
                    size="small"
                    fullWidth
                    required
                    value={odooForm.userLogin}
                    onChange={(e) => setOdooForm({ ...odooForm, userLogin: e.target.value })}
                  />
                </Box>
                <TextField
                  label="API key"
                  type="password"
                  size="small"
                  fullWidth
                  required
                  value={odooForm.apiKey}
                  onChange={(e) => setOdooForm({ ...odooForm, apiKey: e.target.value })}
                  inputProps={{ minLength: 8 }}
                />
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    size="small"
                    disabled={odooSubmitting}
                    startIcon={odooSubmitting
                      ? <CircularProgress size={12} />
                      : <LinkIcon size={14} strokeWidth={2} />}
                    sx={refinedContainedSx(ACCENT)}
                  >
                    {odooSubmitting
                      ? t('settings.integrations.odoo.connecting', 'Connexion...')
                      : t('settings.integrations.odoo.connect', 'Connecter Odoo')}
                  </Button>
                </Box>
                <Alert
                  severity="info"
                  variant="outlined"
                  sx={{ mt: 0.5, borderRadius: '8px', fontSize: '0.76rem' }}
                >
                  {t(
                    'settings.integrations.odoo.featureNote',
                    "L'integration Odoo est en cours de developpement. La connexion permet pour l'instant de valider vos credentials ; les appels signature seront ajoutes prochainement.",
                  )}
                </Alert>
              </Box>
            )}
            {odooMessage && (
              <Alert
                severity={odooMessage.type}
                onClose={() => setOdooMessage(null)}
                sx={{ mt: 1.5, borderRadius: '8px' }}
              >
                {odooMessage.text}
              </Alert>
            )}
          </Box>
        </Paper>
      )}

      {/* Dialog : confirm disconnect Odoo */}
      <Dialog open={odooDisconnectOpen} onClose={() => setOdooDisconnectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('settings.integrations.odoo.disconnectTitle', 'Deconnecter Odoo ?')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            {t(
              'settings.integrations.odoo.disconnectConfirm',
              "Cette action supprime les credentials Odoo enregistres pour votre organisation. Vous devrez ressaisir l'API key pour vous reconnecter.",
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOdooDisconnectOpen(false)}>{t('common.cancel', 'Annuler')}</Button>
          <Button onClick={handleOdooDisconnect} color="error" variant="contained">
            {t('settings.integrations.odoo.confirmDisconnect', 'Deconnecter')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Coming soon — other integrations ─────────────────────────── */}
      <Box
        sx={{
          mt: 1.5,
          p: 1.5,
          borderRadius: '10px',
          border: '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.75,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          {t('settings.integrations.comingSoon')}
        </Typography>
      </Box>

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
