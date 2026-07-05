import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  InputAdornment,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import type { Property } from '../../services/api/propertiesApi';
import type {
  TaxCalculationMode,
  TouristTaxConfig,
  TouristTaxConfigRequest,
} from '../../services/api/touristTaxApi';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TouristTaxBaremeDialogProps {
  open: boolean;
  /** Barème en édition, null = création. */
  config: TouristTaxConfig | null;
  properties: Property[];
  saving: boolean;
  onClose: () => void;
  onSave: (request: TouristTaxConfigRequest) => void;
}

/** Valeur spéciale du select logement pour le barème par défaut de l'org. */
const ORG_DEFAULT = 'ORG_DEFAULT';

interface FormState {
  propertyId: string; // ORG_DEFAULT ou id numérique en string
  communeName: string;
  communeCode: string;
  calculationMode: TaxCalculationMode;
  ratePerPerson: string;
  percentageRatePct: string; // saisi en % (stocké en fraction côté backend)
  capPerPersonNight: string;
  departmentalSurchargePct: string;
  regionalSurchargePct: string;
  maxNights: string;
  exemptMinors: boolean;
  enabled: boolean;
}

function toForm(config: TouristTaxConfig | null): FormState {
  return {
    propertyId: config?.propertyId != null ? String(config.propertyId) : ORG_DEFAULT,
    communeName: config?.communeName ?? '',
    communeCode: config?.communeCode ?? '',
    calculationMode: config?.calculationMode ?? 'PER_PERSON_PER_NIGHT',
    ratePerPerson: config?.ratePerPerson != null ? String(config.ratePerPerson) : '',
    percentageRatePct: config?.percentageRate != null ? String(config.percentageRate * 100) : '',
    capPerPersonNight: config?.capPerPersonNight != null ? String(config.capPerPersonNight) : '',
    departmentalSurchargePct:
      config?.departmentalSurchargePct != null ? String(config.departmentalSurchargePct) : '',
    regionalSurchargePct:
      config?.regionalSurchargePct != null ? String(config.regionalSurchargePct) : '',
    maxNights: config?.maxNights != null ? String(config.maxNights) : '',
    exemptMinors: config?.exemptMinors ?? true,
    enabled: config?.enabled ?? true,
  };
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Dialog de saisie d'un barème de taxe de séjour (création/édition).
 * Le pourcentage est saisi en % et converti en fraction pour le backend.
 */
export default function TouristTaxBaremeDialog({
  open,
  config,
  properties,
  saving,
  onClose,
  onSave,
}: TouristTaxBaremeDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() => toForm(config));

  // Ré-initialise le formulaire à chaque ouverture (création ou édition).
  useEffect(() => {
    if (open) setForm(toForm(config));
  }, [open, config]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isPercentage = form.calculationMode === 'PERCENTAGE_OF_RATE';
  const canSubmit = form.communeName.trim() !== '' && !saving;

  const handleSave = () => {
    const pct = numOrNull(form.percentageRatePct);
    onSave({
      propertyId: form.propertyId === ORG_DEFAULT ? null : Number(form.propertyId),
      communeName: form.communeName.trim(),
      communeCode: form.communeCode.trim() || null,
      calculationMode: form.calculationMode,
      ratePerPerson: isPercentage ? null : numOrNull(form.ratePerPerson),
      percentageRate: isPercentage && pct != null ? pct / 100 : null,
      capPerPersonNight: isPercentage ? numOrNull(form.capPerPersonNight) : null,
      departmentalSurchargePct: numOrNull(form.departmentalSurchargePct),
      regionalSurchargePct: numOrNull(form.regionalSurchargePct),
      maxNights: numOrNull(form.maxNights),
      exemptMinors: form.exemptMinors,
      enabled: form.enabled,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {config
          ? t('touristTax.dialog.editTitle', 'Modifier le barème')
          : t('touristTax.dialog.createTitle', 'Nouveau barème de taxe de séjour')}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              size="small"
              label={t('touristTax.dialog.property', 'Logement')}
              value={form.propertyId}
              onChange={(e) => set('propertyId', e.target.value)}
              disabled={config != null /* la clé naturelle ne change pas en édition */}
              helperText={t(
                'touristTax.dialog.propertyHelp',
                'Le barème par défaut s’applique à tous les logements sans barème propre.'
              )}
            >
              <MenuItem value={ORG_DEFAULT}>
                {t('touristTax.dialog.orgDefault', 'Barème par défaut (toute l’organisation)')}
              </MenuItem>
              {properties.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              size="small"
              required
              label={t('touristTax.dialog.communeName', 'Commune')}
              value={form.communeName}
              onChange={(e) => set('communeName', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label={t('touristTax.dialog.communeCode', 'Code INSEE')}
              value={form.communeCode}
              onChange={(e) => set('communeCode', e.target.value)}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              size="small"
              label={t('touristTax.dialog.mode', 'Mode de calcul')}
              value={form.calculationMode}
              onChange={(e) => set('calculationMode', e.target.value as TaxCalculationMode)}
            >
              <MenuItem value="PER_PERSON_PER_NIGHT">
                {t('touristTax.mode.perPersonPerNight', 'Classé — montant fixe / personne / nuit')}
              </MenuItem>
              <MenuItem value="PERCENTAGE_OF_RATE">
                {t('touristTax.mode.percentageOfRate', 'Non classé « au réel » — % du prix, plafonné')}
              </MenuItem>
              <MenuItem value="FLAT_PER_NIGHT">
                {t('touristTax.mode.flatPerNight', 'Forfait / nuit')}
              </MenuItem>
            </TextField>
          </Grid>

          {!isPercentage && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label={
                  form.calculationMode === 'FLAT_PER_NIGHT'
                    ? t('touristTax.dialog.ratePerNight', 'Montant par nuit')
                    : t('touristTax.dialog.ratePerPerson', 'Montant par personne et par nuit')
                }
                value={form.ratePerPerson}
                onChange={(e) => set('ratePerPerson', e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
                inputProps={{ inputMode: 'decimal' }}
              />
            </Grid>
          )}

          {isPercentage && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('touristTax.dialog.percentageRate', 'Taux (% du prix de la nuitée / pers.)')}
                  value={form.percentageRatePct}
                  onChange={(e) => set('percentageRatePct', e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('touristTax.dialog.cap', 'Plafond / personne / nuit')}
                  value={form.capPerPersonNight}
                  onChange={(e) => set('capPerPersonNight', e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Grid>
            </>
          )}

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label={t('touristTax.dialog.departmentalSurcharge', 'Taxe additionnelle départementale')}
              value={form.departmentalSurchargePct}
              onChange={(e) => set('departmentalSurchargePct', e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              inputProps={{ inputMode: 'decimal' }}
              helperText={t('touristTax.dialog.departmentalHelp', 'Typiquement 10 %')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label={t('touristTax.dialog.regionalSurcharge', 'Taxe additionnelle régionale')}
              value={form.regionalSurchargePct}
              onChange={(e) => set('regionalSurchargePct', e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              inputProps={{ inputMode: 'decimal' }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label={t('touristTax.dialog.maxNights', 'Nuits taxées max (optionnel)')}
              value={form.maxNights}
              onChange={(e) => set('maxNights', e.target.value)}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Grid>
          <Grid item xs={12} sm={6} sx={{ display: 'flex', flexDirection: 'column' }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.exemptMinors}
                  onChange={(e) => set('exemptMinors', e.target.checked)}
                />
              }
              label={t('touristTax.dialog.exemptMinors', 'Exonérer les mineurs (<18 ans)')}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.enabled}
                  onChange={(e) => set('enabled', e.target.checked)}
                />
              }
              label={t('touristTax.dialog.enabled', 'Barème actif')}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Annuler')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSubmit}>
          {t('common.save', 'Enregistrer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
