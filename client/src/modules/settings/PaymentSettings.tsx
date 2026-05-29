import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  TextField,
  Button,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Save,
  Payment,
  AccountBalance,
  PieChart,
  CreditCard,
} from '../../icons';
import { paymentConfigApi } from '../../services/api/paymentConfigApi';
import { splitConfigApi } from '../../services/api/splitConfigApi';
import type { PaymentMethodConfig, PaymentProviderType, SplitConfiguration } from '../../types/payment';
import { PAYMENT_PROVIDER_LABELS } from '../../types/payment';
import { useTranslation } from '../../hooks/useTranslation';
import { useCommissions, useSaveCommission } from '../../hooks/useAccounting';
import type { ChannelCommission } from '../../services/api/accountingApi';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';
import PaymentProviderConfigDialog from './components/PaymentProviderConfigDialog';
import { Settings as SettingsIcon } from '../../icons';

// ─── Provider metadata ───────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  STRIPE: '#635BFF',
  PAYTABS: '#1A8FE3',
  CMI: '#E4002B',
  PAYZONE: '#00B67A',
  PAYPAL: '#003087',
};

const PROVIDER_REGIONS: Record<string, string> = {
  STRIPE: 'Europe',
  PAYTABS: 'Arabie Saoudite',
  CMI: 'Maroc',
  PAYZONE: 'Maroc',
  PAYPAL: 'Global',
};

const STATUS_CHIP_SX = {
  height: 20,
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  borderRadius: '5px',
  '& .MuiChip-label': { px: 0.75 },
} as const;

function buildStatusChipSx(color: string) {
  return {
    ...STATUS_CHIP_SX,
    backgroundColor: `${color}14`,
    color,
    border: `1px solid ${color}33`,
  } as const;
}

// ─── Share colors (palette Baitly) ──────────────────────────────────────────

const SHARE_OWNER = '#4A9B8E';
const SHARE_PLATFORM = '#6B8A9A';
const SHARE_CONCIERGE = '#D4A574';

/** Providers configurables via le dialog (credentials chiffres en BDD).
 *  STRIPE est configure cote application.yml (global), pas par-tenant.
 *  Plus aucun stub UI : les 4 providers non-Stripe sont desormais configurables.
 */
const CONFIGURABLE_PROVIDERS: PaymentProviderType[] = ['PAYTABS', 'CMI', 'PAYZONE', 'PAYPAL'];
const STUB_PROVIDERS: PaymentProviderType[] = [];

export default function PaymentSettings() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configDialogProvider, setConfigDialogProvider] = useState<PaymentProviderType | null>(null);

  // Split config state
  const [splitConfig, setSplitConfig] = useState<SplitConfiguration | null>(null);
  const [ownerPct, setOwnerPct] = useState('80');
  const [platformPct, setPlatformPct] = useState('5');
  const [conciergePct, setConciergePct] = useState('15');
  const [splitSaving, setSplitSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
    loadSplitConfig();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await paymentConfigApi.getConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to load payment configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSplitConfig = async () => {
    try {
      const configs = await splitConfigApi.getConfigs();
      const defaultConfig = configs.find(c => c.isDefault) ?? configs[0] ?? null;
      if (defaultConfig) {
        setSplitConfig(defaultConfig);
        setOwnerPct(String(Math.round(defaultConfig.ownerShare * 10000) / 100));
        setPlatformPct(String(Math.round(defaultConfig.platformShare * 10000) / 100));
        setConciergePct(String(Math.round(defaultConfig.conciergeShare * 10000) / 100));
      }
    } catch (error) {
      console.error('Failed to load split config:', error);
    }
  };

  /**
   * Verifie si la config d'un provider est suffisamment renseignee pour
   * etre activee.
   * - STRIPE   : toujours OK (config globale application.yml).
   * - PAYTABS  : profileId + region dans configJson (server_key chiffré BDD).
   * - CMI      : okUrl + failUrl dans configJson (client_id + store_key BDD).
   * - PAYZONE  : webhookUrl dans configJson (api_key BDD). MAD principal.
   * - PAYPAL   : client_id + client_secret BDD (presence = config valide).
   */
  const isProviderConfigured = (type: PaymentProviderType, config?: PaymentMethodConfig): boolean => {
    if (type === 'STRIPE') return true;
    if (!config) return false;
    const json = (config.config ?? {}) as Record<string, unknown>;
    if (type === 'PAYTABS') {
      return json.profileId != null && typeof json.region === 'string' && json.region.length > 0;
    }
    if (type === 'CMI') {
      return typeof json.okUrl === 'string' && typeof json.failUrl === 'string';
    }
    if (type === 'PAYZONE') {
      // L'api_key elle-même n'est pas exposée par l'API (chiffrée), donc on
      // s'appuie sur la presence d'au moins une clef provider-specific dans
      // configJson — la webhookUrl est requise au moment du saving du dialog.
      return typeof json.webhookUrl === 'string' && json.webhookUrl.length > 0;
    }
    if (type === 'PAYPAL') {
      // PayPal n'a pas de configJson obligatoire — la config est valide dès
      // que sandbox mode + credentials ont été enregistrés au moins une fois.
      // L'API renvoie le sandboxMode mais pas les credentials. On considère
      // que si le record existe et que sandboxMode est défini, c'est configuré.
      return config.id != null;
    }
    return false;
  };

  const handleToggle = async (providerType: PaymentProviderType, currentEnabled: boolean) => {
    const config = getConfig(providerType);
    // Pour PayTabs/CMI : si on essaie d'activer mais pas encore configure → ouvre le dialog.
    if (!currentEnabled
        && CONFIGURABLE_PROVIDERS.includes(providerType)
        && !isProviderConfigured(providerType, config)) {
      openConfigDialog(providerType);
      return;
    }
    try {
      await paymentConfigApi.updateConfig(providerType, { enabled: !currentEnabled });
      setConfigs(prev =>
        prev.map(c =>
          c.providerType === providerType ? { ...c, enabled: !currentEnabled } : c
        )
      );
      setSnackbar({
        open: true,
        message: `${PAYMENT_PROVIDER_LABELS[providerType]} ${!currentEnabled ? 'activé' : 'désactivé'}`,
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({ open: true, message: 'Erreur lors de la mise à jour', severity: 'error' });
    }
  };

  const openConfigDialog = (providerType: PaymentProviderType) => {
    setConfigDialogProvider(providerType);
    setConfigDialogOpen(true);
  };

  const handleSaveProviderConfig = async (data: Parameters<typeof paymentConfigApi.updateConfig>[1]) => {
    if (!configDialogProvider) return;
    const updated = await paymentConfigApi.updateConfig(configDialogProvider, data);
    setConfigs(prev => {
      const existing = prev.find(c => c.providerType === configDialogProvider);
      return existing
        ? prev.map(c => (c.providerType === configDialogProvider ? updated : c))
        : [...prev, updated];
    });
    setSnackbar({
      open: true,
      message: `${PAYMENT_PROVIDER_LABELS[configDialogProvider]} configuré`,
      severity: 'success',
    });
  };

  const splitTotal = useCallback(() => {
    const o = parseFloat(ownerPct) || 0;
    const p = parseFloat(platformPct) || 0;
    const c = parseFloat(conciergePct) || 0;
    return Math.round((o + p + c) * 100) / 100;
  }, [ownerPct, platformPct, conciergePct]);

  const handleSaveSplit = async () => {
    const total = splitTotal();
    if (total !== 100) {
      setSnackbar({ open: true, message: t('settings.split.totalError'), severity: 'error' });
      return;
    }

    setSplitSaving(true);
    try {
      const data = {
        name: splitConfig?.name ?? t('settings.split.configName'),
        ownerShare: parseFloat(ownerPct) / 100,
        platformShare: parseFloat(platformPct) / 100,
        conciergeShare: parseFloat(conciergePct) / 100,
        isDefault: true,
        active: true,
      };

      if (splitConfig?.id) {
        const updated = await splitConfigApi.update(splitConfig.id, data);
        setSplitConfig(updated);
      } else {
        const created = await splitConfigApi.create(data);
        setSplitConfig(created);
      }
      setSnackbar({ open: true, message: t('settings.split.saved'), severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: t('settings.split.error'), severity: 'error' });
    } finally {
      setSplitSaving(false);
    }
  };

  const allProviders: PaymentProviderType[] = ['STRIPE', 'PAYTABS', 'CMI', 'PAYZONE', 'PAYPAL'];

  const getConfig = (type: PaymentProviderType): PaymentMethodConfig | undefined =>
    configs.find(c => c.providerType === type);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const total = splitTotal();
  const isValidTotal = total === 100;

  return (
    <Box>
      <Grid container spacing={2}>
        {/* ═══ LEFT COLUMN — Payment Providers ═══ */}
        <Grid item xs={12} md={6}>
          <SettingsSection
            title="Fournisseurs de paiement"
            icon={Payment}
            accent="primary"
            description="Activez ou désactivez les fournisseurs pour votre organisation."
          >
            {allProviders.map((type, index) => {
              const config = getConfig(type);
              const enabled = config?.enabled ?? false;
              const isStub = STUB_PROVIDERS.includes(type);
              const isConfigurable = CONFIGURABLE_PROVIDERS.includes(type);
              const isConfigured = isProviderConfigured(type, config);
              const brandColor = PROVIDER_COLORS[type] ?? '#8A8378';

              const statusChips = (
                <>
                  {isStub && (
                    <Chip label="Bientôt" size="small" sx={buildStatusChipSx('#8A8378')} />
                  )}
                  {isConfigurable && !isConfigured && (
                    <Chip label="À configurer" size="small" sx={buildStatusChipSx('#D4A574')} />
                  )}
                  {enabled && !isStub && (
                    <Chip label="Actif" size="small" sx={buildStatusChipSx('#4A9B8E')} />
                  )}
                  {config?.sandboxMode && isConfigured && (
                    <Chip label="Sandbox" size="small" sx={buildStatusChipSx('#D4A574')} />
                  )}
                </>
              );

              // Pour PayTabs/CMI : icône "Configurer" cliquable a droite de la
              // ligne (rebascule sur le dialog). On la rend en endAdornment via
              // le slot iconButton du SettingsToggleRow… mais ce composant
              // n'expose pas ce slot. On va plutot wrapper la ligne dans un
              // Box avec un IconButton positionne en absolu.
              const configureButton = isConfigurable ? (
                <Tooltip title={isConfigured ? 'Reconfigurer' : 'Configurer les credentials'} arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openConfigDialog(type);
                    }}
                    sx={{
                      ml: 0.5,
                      color: isConfigured ? 'text.secondary' : '#D4A574',
                      '&:hover': { color: '#4A9B8E', backgroundColor: '#4A9B8E0F' },
                    }}
                  >
                    <SettingsIcon size={16} strokeWidth={1.75} />
                  </IconButton>
                </Tooltip>
              ) : null;

              return (
                <Box key={type} sx={{ position: 'relative' }}>
                  <SettingsToggleRow
                    icon={CreditCard}
                    iconColor={brandColor}
                    title={(
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, flexWrap: 'wrap' }}>
                        <Typography
                          component="span"
                          sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'inherit' }}
                        >
                          {PAYMENT_PROVIDER_LABELS[type]}
                        </Typography>
                        {statusChips}
                      </Box>
                    )}
                    description={PROVIDER_REGIONS[type]}
                    checked={enabled}
                    onChange={() => handleToggle(type, enabled)}
                    disabled={isStub}
                    divider={index < allProviders.length - 1}
                  />
                  {configureButton && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        right: 56, // a gauche du Switch (qui fait ~36px + margin)
                        transform: 'translateY(-50%)',
                        pointerEvents: 'auto',
                      }}
                    >
                      {configureButton}
                    </Box>
                  )}
                </Box>
              );
            })}
          </SettingsSection>
        </Grid>

        {/* ═══ RIGHT COLUMN — Revenue Split + Commissions ═══ */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* ─── Revenue Split ─── */}
            <SettingsSection
              title={t('settings.split.title')}
              icon={PieChart}
              accent="warm"
              description={t('settings.split.subtitle')}
            >
              {/* Visual split bar */}
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    height: 30,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      width: `${parseFloat(ownerPct) || 0}%`,
                      bgcolor: SHARE_OWNER,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {parseFloat(ownerPct) >= 15 && (
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          color: '#fff',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {ownerPct}%
                      </Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      width: `${parseFloat(platformPct) || 0}%`,
                      bgcolor: SHARE_PLATFORM,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {parseFloat(platformPct) >= 8 && (
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          color: '#fff',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {platformPct}%
                      </Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      width: `${parseFloat(conciergePct) || 0}%`,
                      bgcolor: SHARE_CONCIERGE,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {parseFloat(conciergePct) >= 10 && (
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          color: '#fff',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {conciergePct}%
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 0.875, flexWrap: 'wrap' }}>
                  <ShareLegend color={SHARE_OWNER} label={t('settings.split.ownerShare')} />
                  <ShareLegend color={SHARE_PLATFORM} label={t('settings.split.platformShare')} />
                  <ShareLegend color={SHARE_CONCIERGE} label={t('settings.split.conciergeShare')} />
                </Box>
              </Box>

              {/* Input fields */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 1.5 }}>
                <ShareInput
                  label={t('settings.split.ownerShare')}
                  value={ownerPct}
                  onChange={setOwnerPct}
                  color={SHARE_OWNER}
                />
                <ShareInput
                  label={t('settings.split.platformShare')}
                  value={platformPct}
                  onChange={setPlatformPct}
                  color={SHARE_PLATFORM}
                />
                <ShareInput
                  label={t('settings.split.conciergeShare')}
                  value={conciergePct}
                  onChange={setConciergePct}
                  color={SHARE_CONCIERGE}
                />
              </Stack>

              {/* Total + Save */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 500 }}>
                    Total
                  </Typography>
                  <Chip
                    label={`${total}%`}
                    size="small"
                    sx={buildStatusChipSx(isValidTotal ? '#4A9B8E' : '#C97A7A')}
                  />
                  {!isValidTotal && (
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: '#C97A7A',
                        fontWeight: 500,
                      }}
                    >
                      {t('settings.split.totalError')}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={
                    splitSaving ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <Save size={14} strokeWidth={1.75} />
                    )
                  }
                  disabled={!isValidTotal || splitSaving}
                  onClick={handleSaveSplit}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    letterSpacing: '0.01em',
                    borderRadius: '8px',
                    py: 0.625,
                    px: 1.5,
                    bgcolor: '#6B8A9A',
                    boxShadow: 'none',
                    transition:
                      'background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                    '&:hover': {
                      bgcolor: '#6B8A9A',
                      filter: 'brightness(0.94)',
                      boxShadow: '0 1px 2px rgba(45, 55, 72, 0.06), 0 4px 10px rgba(107, 138, 154, 0.22)',
                      transform: 'translateY(-1px)',
                    },
                    '&:active': { transform: 'translateY(0)', boxShadow: 'none' },
                    '&.Mui-disabled': { bgcolor: 'rgba(107, 138, 154, 0.32)', color: '#fff' },
                  }}
                >
                  {splitSaving ? t('settings.split.saving', 'Sauvegarde...') : t('settings.split.save')}
                </Button>
              </Box>

              {!splitConfig && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: '8px' }}>
                  {t('settings.split.defaults')}
                </Alert>
              )}
            </SettingsSection>

            {/* ─── Channel Commissions ─── */}
            <ChannelCommissionsSection />
          </Box>
        </Grid>
      </Grid>

      <PaymentProviderConfigDialog
        open={configDialogOpen}
        providerType={configDialogProvider}
        currentConfig={configDialogProvider ? getConfig(configDialogProvider) ?? null : null}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveProviderConfig}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: '8px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface ShareLegendProps {
  color: string;
  label: string;
}

const ShareLegend: React.FC<ShareLegendProps> = ({ color, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color }} />
    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
      {label}
    </Typography>
  </Box>
);

interface ShareInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
}

const ShareInput: React.FC<ShareInputProps> = ({ label, value, onChange, color }) => (
  <TextField
    label={label}
    type="number"
    size="small"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    InputProps={{
      endAdornment: <InputAdornment position="end">%</InputAdornment>,
      inputProps: { min: 0, max: 100, step: 0.01 },
      sx: {
        '& input': { fontVariantNumeric: 'tabular-nums', fontWeight: 600, color },
      },
    }}
    fullWidth
  />
);

// ─── Channel Commissions Section ────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  AIRBNB: '#FF5A5F',
  BOOKING: '#003580',
  DIRECT: '#4A9B8E',
};

const CHANNEL_LABELS: Record<string, string> = {
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking.com',
  DIRECT: 'Booking Engine',
};

const EDITABLE_CHANNELS = new Set(['DIRECT']);

function ChannelCommissionsSection() {
  const { t } = useTranslation();
  const { data: commissions = [], isLoading, isError } = useCommissions();
  const saveMutation = useSaveCommission();

  const [editRates, setEditRates] = useState<Record<string, string>>({});
  const [savedChannel, setSavedChannel] = useState<string | null>(null);

  useEffect(() => {
    if (commissions.length > 0 && Object.keys(editRates).length === 0) {
      const rates: Record<string, string> = {};
      for (const c of commissions) {
        if (EDITABLE_CHANNELS.has(c.channelName)) {
          rates[c.channelName] = String(c.commissionRate);
        }
      }
      setEditRates(rates);
    }
  }, [commissions, editRates]);

  const handleSave = useCallback(
    async (commission: ChannelCommission) => {
      const newRate = parseFloat(editRates[commission.channelName] ?? '0');
      if (isNaN(newRate) || newRate < 0 || newRate > 100) return;
      await saveMutation.mutateAsync({
        channel: commission.channelName,
        data: { ...commission, commissionRate: newRate },
      });
      setSavedChannel(commission.channelName);
      setTimeout(() => setSavedChannel(null), 2000);
    },
    [editRates, saveMutation],
  );

  const content = (() => {
    if (isLoading) {
      return (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress size={24} />
        </Box>
      );
    }
    if (isError) {
      return (
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {t('settings.commissions.error', 'Erreur lors du chargement des commissions')}
        </Alert>
      );
    }
    if (commissions.length === 0) {
      return (
        <Alert severity="info" sx={{ borderRadius: '8px' }}>
          {t('settings.commissions.empty', 'Aucun canal de réservation configuré')}
        </Alert>
      );
    }
    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
                {t('settings.commissions.channel', 'Canal')}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
                {t('settings.commissions.rate', 'Taux (%)')}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', width: 80 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {commissions.map((c) => {
              const isEditable = EDITABLE_CHANNELS.has(c.channelName);
              const color = CHANNEL_COLORS[c.channelName] ?? '#8A8378';
              const label = CHANNEL_LABELS[c.channelName] ?? c.channelName;
              return (
                <TableRow key={c.channelName} hover>
                  <TableCell>
                    <Chip
                      label={label}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        backgroundColor: `${color}14`,
                        color,
                        border: `1px solid ${color}33`,
                        borderRadius: '6px',
                        '& .MuiChip-label': { px: 0.875 },
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {isEditable ? (
                      <TextField
                        type="number"
                        size="small"
                        value={editRates[c.channelName] ?? c.commissionRate}
                        onChange={(e) =>
                          setEditRates((prev) => ({ ...prev, [c.channelName]: e.target.value }))
                        }
                        inputProps={{
                          min: 0,
                          max: 100,
                          step: 0.5,
                          style: {
                            textAlign: 'center',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                          },
                        }}
                        sx={{ width: 96 }}
                        InputProps={{ sx: { fontSize: '0.8125rem' } }}
                      />
                    ) : (
                      <Typography
                        sx={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: 'text.primary',
                        }}
                      >
                        {c.commissionRate}%
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {isEditable && (
                      savedChannel === c.channelName ? (
                        <Chip
                          label={t('common.saved', 'Sauvegardé')}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            backgroundColor: '#4A9B8E14',
                            color: '#4A9B8E',
                            border: '1px solid #4A9B8E33',
                            borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.875 },
                          }}
                        />
                      ) : (
                        <Tooltip title={t('common.save', 'Enregistrer')}>
                          <IconButton
                            size="small"
                            onClick={() => handleSave(c)}
                            disabled={saveMutation.isPending}
                            aria-label={t('common.save', 'Enregistrer')}
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '7px',
                              color: 'text.secondary',
                              border: '1px solid',
                              borderColor: 'divider',
                              transition:
                                'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                              '&:hover': {
                                color: '#4A9B8E',
                                borderColor: '#4A9B8E66',
                                backgroundColor: '#4A9B8E0F',
                              },
                              '&:focus-visible': { outline: '2px solid #4A9B8E', outlineOffset: 2 },
                            }}
                          >
                            <Save size={13} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  })();

  return (
    <SettingsSection
      title={t('settings.commissions.title', 'Commissions canaux')}
      icon={AccountBalance}
      accent="info"
      description={t(
        'settings.commissions.subtitle',
        "Taux de commission prélevé par chaque plateforme de réservation. Les taux des plateformes externes ne sont pas modifiables. Seul le taux du booking engine est configurable.",
      )}
    >
      {content}
    </SettingsSection>
  );
}
