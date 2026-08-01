import React from 'react';
import { TextField, Grid, InputAdornment, Divider } from '@mui/material';
import { Devices, Computer, People, AutoAwesome } from '../../icons';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';

interface TabPMSProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabPMS({ config, canEdit, onUpdate, currencySymbol }: TabPMSProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  return (
    <div className="pt-3">
      {/* ─── Abonnement PMS ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-[var(--mui-info)]"><Devices size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.pms.title')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('tarification.pms.subtitle')}
      </p>

      <Grid container spacing={1.5}>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.monthly')}
            type="number"
            size="small"
            fullWidth
            value={(config.pmsMonthlyPriceCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ pmsMonthlyPriceCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.monthlyHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} />/mois</InputAdornment> }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.sync')}
            type="number"
            size="small"
            fullWidth
            value={(config.pmsSyncPriceCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ pmsSyncPriceCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.syncHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} />/mois</InputAdornment> }}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2.5 }} />

      {/* ─── Supplément IA par forfait (campagne X5) ─────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-[var(--mui-secondary)]"><AutoAwesome size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.pms.aiTitle')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('tarification.pms.aiSubtitle')}
      </p>

      <Grid container spacing={1.5}>
        <Grid item xs={4}>
          <TextField
            label={t('tarification.pms.aiEssentiel')}
            type="number"
            size="small"
            fullWidth
            value={(config.aiSurchargeEssentielCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ aiSurchargeEssentielCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.aiEssentielHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} />/mois</InputAdornment> }}
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            label={t('tarification.pms.aiConfort')}
            type="number"
            size="small"
            fullWidth
            value={(config.aiSurchargeConfortCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ aiSurchargeConfortCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.aiConfortHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} />/mois</InputAdornment> }}
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            label={t('tarification.pms.aiPremium')}
            type="number"
            size="small"
            fullWidth
            value={(config.aiSurchargePremiumCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ aiSurchargePremiumCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.aiPremiumHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} />/mois</InputAdornment> }}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2.5 }} />

      {/* ─── Tarification par utilisateur ────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-[var(--bui-success-ink)]"><People size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.pms.perSeatTitle')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('tarification.pms.perSeatSubtitle')}
      </p>

      <Grid container spacing={1.5}>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.perSeat')}
            type="number"
            size="small"
            fullWidth
            value={(config.pmsPerSeatPriceCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ pmsPerSeatPriceCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.perSeatHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} />/mois/utilisateur</InputAdornment> }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.freeSeats')}
            type="number"
            size="small"
            fullWidth
            value={config.pmsFreeSeats}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              if (!isNaN(num) && num >= 0) onUpdate({ pmsFreeSeats: num });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.freeSeatsHelp')}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2.5 }} />

      {/* ─── Surcharges automatisation ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-[var(--bui-warning-ink)]"><Computer size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.automation.title')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('tarification.automation.subtitle')}
      </p>

      <Grid container spacing={1.5}>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.automation.basic')}
            type="number"
            size="small"
            fullWidth
            value={config.automationBasicSurcharge}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              if (!isNaN(num)) onUpdate({ automationBasicSurcharge: num });
            }}
            disabled={!canEdit}
            helperText={t('tarification.automation.basicHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.automation.full')}
            type="number"
            size="small"
            fullWidth
            value={config.automationFullSurcharge}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              if (!isNaN(num)) onUpdate({ automationFullSurcharge: num });
            }}
            disabled={!canEdit}
            helperText={t('tarification.automation.fullHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
          />
        </Grid>
      </Grid>
    </div>
  );
}
