import React from 'react';
import { Badge } from '../../components/ui';
import { cn } from '../../utils/cn';
import { Box, TextField, InputAdornment, Divider, Paper, Switch, List, ListItem, ListItemIcon, ListItemText, ListItemSecondaryAction } from '@mui/material';
import {
  VolumeUp,
  Handshake,
  Memory,
  CheckCircleOutline,
} from '../../icons';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { Money, CurrencySymbol } from '../../components/Money';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TabMonitoringProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

// ─── Feature list helper ────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircleOutline size={16} strokeWidth={1.75} /></span>
      <p className="cn-text-body2 text-[0.8125rem]">
        {text}
      </p>
    </div>
  );
}

const centsToEuros = (cents: number) => (cents / 100).toFixed(0);
const eurosToCents = (val: string) => {
  const euros = parseInt(val, 10);
  return isNaN(euros) ? 0 : euros * 100;
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function TabMonitoring({ config, canEdit, onUpdate, currencySymbol }: TabMonitoringProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  // ─── Baitly total calculation ─────────────────────────────────────────────
  const clenzyTotalCents =
    (config.monitoringClenzyDevicePriceCents || 0) +
    (config.monitoringClenzyInstallationPriceCents || 0) +
    (config.monitoringClenzyConfigPriceCents || 0) +
    (config.monitoringClenzySupportPriceCents || 0);

  return (
    <div className="pt-3">
      {/* ─── Section title ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="inline-flex text-primary"><VolumeUp size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.monitoring.title')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3.5">
        {t('tarification.monitoring.subtitle')}
      </p>

      {/* ─── Two offers side by side ───────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-3">

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MINUT — Abonnement mensuel                                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: config.monitoringMinutEnabled ? 'primary.main' : 'divider',
              borderRadius: 2,
              transition: 'border-color 0.2s',
              opacity: config.monitoringMinutEnabled ? 1 : 0.75,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Handshake size={22} strokeWidth={1.75} color='var(--accent)' />
              <h6 className="cn-text-subtitle1 font-bold text-[1rem]">
                {t('tarification.monitoring.minut.title')}
              </h6>
              <Badge variant="default" className="text-[0.6875rem] h-[22px]">{t('tarification.monitoring.minut.badge')}</Badge>
            </div>

            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem] mb-3 leading-[1.5]">
              {t('tarification.monitoring.minut.description')}
            </p>

            <Divider sx={{ my: 1.5 }} />

            {/* Pricing model */}
            <span className="cn-text-overline text-[0.6875rem] font-bold text-muted-foreground tracking-[0.08em]">
              {t('tarification.monitoring.minut.pricingModel')}
            </span>

            <div className="mt-1.5 mb-3">
              {config.monitoringMinutMonthlyPriceCents > 0 ? (
                <TextField
                  label={t('tarification.monitoring.minut.monthlyPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringMinutMonthlyPriceCents)}
                  onChange={(e) => onUpdate({ monitoringMinutMonthlyPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} />/mois</InputAdornment> }}
                />
              ) : (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'grey.50',
                    border: '1px dashed',
                    borderColor: 'divider',
                    textAlign: 'center',
                  }}
                >
                  <h6 className="cn-text-h6 font-bold text-muted-foreground text-[1.1rem]">
                    {t('tarification.monitoring.minut.onQuote')}
                  </h6>
                  <span className="cn-text-caption text-muted-foreground text-[0.6875rem]">
                    {t('tarification.monitoring.minut.onQuoteHint')}
                  </span>
                </Box>
              )}
            </div>

            <Divider sx={{ my: 1.5 }} />

            {/* Features */}
            <div className="mb-3">
              <FeatureItem text={t('tarification.monitoring.minut.feature1')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature2')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature3')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature4')} />
            </div>

            <Divider sx={{ my: 1.5 }} />

            {/* Enable switch */}
            <List disablePadding>
              <ListItem disableGutters sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <span className={cn('inline-flex', config.monitoringMinutEnabled ? 'text-[var(--mui-primary)]' : 'text-[var(--faint)]')}><VolumeUp size={20} strokeWidth={1.75} /></span>
                </ListItemIcon>
                <ListItemText
                  primary={t('tarification.monitoring.enable')}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={config.monitoringMinutEnabled}
                    onChange={(e) => onUpdate({ monitoringMinutEnabled: e.target.checked })}
                    disabled={!canEdit}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* CLENZY HARDWARE — Coût unique (Tuya OEM)                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: config.monitoringClenzyEnabled ? 'success.main' : 'divider',
              borderRadius: 2,
              transition: 'border-color 0.2s',
              opacity: config.monitoringClenzyEnabled ? 1 : 0.75,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Memory size={22} strokeWidth={1.75} color='var(--ok)' />
              <h6 className="cn-text-subtitle1 font-bold text-[1rem]">
                {t('tarification.monitoring.clenzy.title')}
              </h6>
              <Badge variant="success" className="text-[0.6875rem] h-[22px]">{t('tarification.monitoring.clenzy.badge')}</Badge>
            </div>

            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem] mb-3 leading-[1.5]">
              {t('tarification.monitoring.clenzy.description')}
            </p>

            <Divider sx={{ my: 1.5 }} />

            {/* Pricing model */}
            <span className="cn-text-overline text-[0.6875rem] font-bold text-muted-foreground tracking-[0.08em]">
              {t('tarification.monitoring.clenzy.pricingModel')}
            </span>

            <div className="grid grid-cols-12 gap-[9px] mt-[3px] mb-1.5">
              <div className="col-span-6">
                <TextField
                  label={t('tarification.monitoring.clenzy.devicePrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzyDevicePriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzyDevicePriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.devicePriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
                />
              </div>
              <div className="col-span-6">
                <TextField
                  label={t('tarification.monitoring.clenzy.installationPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzyInstallationPriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzyInstallationPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.installationPriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
                />
              </div>
              <div className="col-span-6">
                <TextField
                  label={t('tarification.monitoring.clenzy.configPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzyConfigPriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzyConfigPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.configPriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
                />
              </div>
              <div className="col-span-6">
                <TextField
                  label={t('tarification.monitoring.clenzy.supportPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzySupportPriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzySupportPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.supportPriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
                />
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-2 rounded-[1.5px] bg-[success.50] border border-[success.200] mb-2">
              <h6 className="cn-text-subtitle2 font-bold text-[0.875rem]">
                {t('tarification.monitoring.clenzy.total')}
              </h6>
              <h6 className="cn-text-h6 font-extrabold text-[var(--ok)] text-[1.25rem]">
                {clenzyTotalCents > 0 ? <Money value={clenzyTotalCents / 100} decimals={0} /> : <>— <CurrencySymbol code={currency} /></>}
              </h6>
            </div>

            <Divider sx={{ my: 1.5 }} />

            {/* Features */}
            <div className="mb-3">
              <FeatureItem text={t('tarification.monitoring.clenzy.feature1')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature2')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature3')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature4')} />
            </div>

            <Divider sx={{ my: 1.5 }} />

            {/* Enable switch */}
            <List disablePadding>
              <ListItem disableGutters sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <span className={cn('inline-flex', config.monitoringClenzyEnabled ? 'text-[#4A9B8E]' : 'text-[var(--faint)]')}><Memory size={20} strokeWidth={1.75} /></span>
                </ListItemIcon>
                <ListItemText
                  primary={t('tarification.monitoring.enable')}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={config.monitoringClenzyEnabled}
                    onChange={(e) => onUpdate({ monitoringClenzyEnabled: e.target.checked })}
                    disabled={!canEdit}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </div>
      </div>
    </div>
  );
}
