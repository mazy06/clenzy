import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
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
  Card,
  CardContent,
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

export default function PaymentSettings() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

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

  const handleToggle = async (providerType: PaymentProviderType, currentEnabled: boolean) => {
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
      <Grid container spacing={3}>
        {/* ═══ LEFT COLUMN — Payment Providers ═══ */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Payment size={22} strokeWidth={1.75} /></Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Fournisseurs de paiement
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Activez ou désactivez les fournisseurs pour votre organisation.
              </Typography>

              <List disablePadding>
                {allProviders.map((type, index) => {
                  const config = getConfig(type);
                  const enabled = config?.enabled ?? false;
                  const isStub = type !== 'STRIPE';
                  const color = PROVIDER_COLORS[type] ?? '#666';

                  return (
                    <ListItem
                      key={type}
                      divider={index < allProviders.length - 1}
                      sx={{ px: 0, py: 1.5 }}
                    >
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: `${color}14`,
                          mr: 1.5,
                          flexShrink: 0,
                        }}
                      >
                        <Box component="span" sx={{ display: 'inline-flex', color }}>
                          <CreditCard size={18} strokeWidth={1.75} />
                        </Box>
                      </Box>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={0.75}>
                            <Typography variant="body2" fontWeight={600}>
                              {PAYMENT_PROVIDER_LABELS[type]}
                            </Typography>
                            {isStub && (
                              <Chip
                                label="Bientôt"
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  bgcolor: 'action.hover',
                                  '& .MuiChip-label': { px: 0.75 },
                                }}
                              />
                            )}
                            {enabled && !isStub && (
                              <Chip
                                label="Actif"
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  bgcolor: '#4A9B8E18',
                                  color: '#4A9B8E',
                                  fontWeight: 600,
                                  '& .MuiChip-label': { px: 0.75 },
                                }}
                              />
                            )}
                            {config?.sandboxMode && (
                              <Chip
                                label="Sandbox"
                                size="small"
                                color="warning"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 18, '& .MuiChip-label': { px: 0.75 } }}
                              />
                            )}
                          </Box>
                        }
                        secondary={PROVIDER_REGIONS[type]}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          edge="end"
                          size="small"
                          checked={enabled}
                          onChange={() => handleToggle(type, enabled)}
                          disabled={isStub}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* ═══ RIGHT COLUMN — Revenue Split + Commissions ═══ */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
            {/* ─── Revenue Split ─── */}
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <PieChart size={22} strokeWidth={1.75} color='#D4A574' />
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t('settings.split.title')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {t('settings.split.subtitle')}
                </Typography>

                {/* Visual split bar */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', height: 28, borderRadius: 1, overflow: 'hidden' }}>
                    <Box
                      sx={{
                        width: `${parseFloat(ownerPct) || 0}%`,
                        bgcolor: '#4A9B8E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'width 0.3s',
                      }}
                    >
                      {parseFloat(ownerPct) >= 15 && (
                        <Typography variant="caption" color="white" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                          {ownerPct}%
                        </Typography>
                      )}
                    </Box>
                    <Box
                      sx={{
                        width: `${parseFloat(platformPct) || 0}%`,
                        bgcolor: '#6B8A9A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'width 0.3s',
                      }}
                    >
                      {parseFloat(platformPct) >= 8 && (
                        <Typography variant="caption" color="white" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                          {platformPct}%
                        </Typography>
                      )}
                    </Box>
                    <Box
                      sx={{
                        width: `${parseFloat(conciergePct) || 0}%`,
                        bgcolor: '#D4A574',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'width 0.3s',
                      }}
                    >
                      {parseFloat(conciergePct) >= 10 && (
                        <Typography variant="caption" color="white" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                          {conciergePct}%
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4A9B8E' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{t('settings.split.ownerShare')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#6B8A9A' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{t('settings.split.platformShare')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#D4A574' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{t('settings.split.conciergeShare')}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Input fields */}
                <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
                  <TextField
                    label={t('settings.split.ownerShare')}
                    type="number"
                    size="small"
                    value={ownerPct}
                    onChange={(e) => setOwnerPct(e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      inputProps: { min: 0, max: 100, step: 0.01 },
                    }}
                    fullWidth
                  />
                  <TextField
                    label={t('settings.split.platformShare')}
                    type="number"
                    size="small"
                    value={platformPct}
                    onChange={(e) => setPlatformPct(e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      inputProps: { min: 0, max: 100, step: 0.01 },
                    }}
                    fullWidth
                  />
                  <TextField
                    label={t('settings.split.conciergeShare')}
                    type="number"
                    size="small"
                    value={conciergePct}
                    onChange={(e) => setConciergePct(e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      inputProps: { min: 0, max: 100, step: 0.01 },
                    }}
                    fullWidth
                  />
                </Stack>

                {/* Total + Save */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography
                    variant="body2"
                    color={isValidTotal ? 'text.secondary' : 'error'}
                    fontWeight={isValidTotal ? 400 : 600}
                  >
                    Total : {total}%
                    {!isValidTotal && ` — ${t('settings.split.totalError')}`}
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Save />}
                    disabled={!isValidTotal || splitSaving}
                    onClick={handleSaveSplit}
                  >
                    {splitSaving ? <CircularProgress size={20} /> : t('settings.split.save')}
                  </Button>
                </Box>

                {!splitConfig && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    {t('settings.split.defaults')}
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* ─── Channel Commissions ─── */}
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <ChannelCommissionsSection />
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ─── Channel Commissions Section ────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = { AIRBNB: '#FF5A5F', BOOKING: '#003580', DIRECT: '#4A9B8E' };

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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <AccountBalance size={22} strokeWidth={1.75} color='#6B8A9A' />
        <Typography variant="subtitle1" fontWeight={700}>
          {t('settings.commissions.title', 'Commissions canaux')}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {t('settings.commissions.subtitle', 'Taux de commission par plateforme. Seul le booking engine est configurable.')}
      </Typography>

      {isLoading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress size={24} />
        </Box>
      ) : isError ? (
        <Alert severity="error">
          {t('settings.commissions.error', 'Erreur lors du chargement des commissions')}
        </Alert>
      ) : commissions.length === 0 ? (
        <Alert severity="info">
          {t('settings.commissions.empty', 'Aucun canal de réservation configuré')}
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                  {t('settings.commissions.channel', 'Canal')}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                  {t('settings.commissions.rate', 'Taux (%)')}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', width: 80 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {commissions.map((c) => {
                const isEditable = EDITABLE_CHANNELS.has(c.channelName);
                return (
                  <TableRow key={c.channelName} hover>
                    <TableCell>
                      <Chip
                        label={c.channelName === 'DIRECT' ? 'Booking Engine' : c.channelName}
                        size="small"
                        sx={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: CHANNEL_COLORS[c.channelName] ?? '#666',
                          color: '#fff',
                          height: 22,
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
                          inputProps={{ min: 0, max: 100, step: 0.5, style: { textAlign: 'center' } }}
                          sx={{ width: 100 }}
                          InputProps={{ sx: { fontSize: '0.8125rem' } }}
                        />
                      ) : (
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                          {c.commissionRate}%
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditable && (
                        savedChannel === c.channelName ? (
                          <Chip label={t('common.saved', 'Sauvegardé')} size="small" color="success" sx={{ fontSize: '0.6875rem', height: 22 }} />
                        ) : (
                          <Tooltip title={t('common.save', 'Enregistrer')}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleSave(c)}
                              disabled={saveMutation.isPending}
                            >
                              <Save size={'1rem'} strokeWidth={1.75} />
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
      )}
    </Box>
  );
}
