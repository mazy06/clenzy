import React, { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  Chip,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AutoAwesome,
  Group,
  Add,
  Delete,
} from '@mui/icons-material';
import type { ForfaitConfig, SurfaceBasePrice, PrestationOption, SurchargeOption } from '../../services/api/pricingConfigApi';
import type { Team } from '../../services/api/teamsApi';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Constants ────────────────────────────────────────────────────────────────

/** All cleaning intervention type keys (system enum — stays hardcoded) */
const ALL_CLEANING_SERVICE_TYPE_KEYS = [
  'CLEANING',
  'EXPRESS_CLEANING',
  'DEEP_CLEANING',
  'WINDOW_CLEANING',
  'FLOOR_CLEANING',
  'KITCHEN_CLEANING',
  'BATHROOM_CLEANING',
] as const;

// ─── Shared SX ────────────────────────────────────────────────────────────────

const CHIP_SX = {
  height: 30,
  fontSize: '0.75rem',
  fontWeight: 500,
  borderWidth: 1.5,
  '& .MuiChip-label': { px: 0.75 },
  transition: 'all 0.15s ease',
} as const;

const SECTION_TITLE_SX = {
  fontSize: '0.625rem',
  fontWeight: 600,
  color: 'text.secondary',
  mb: 0.75,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ForfaitAccordionSectionProps {
  forfait: ForfaitConfig;
  teams: Team[];
  canEdit: boolean;
  onChange: (updated: ForfaitConfig) => void;
  availablePrestations: PrestationOption[];
  availableSurcharges: SurchargeOption[];
  onAddPrestation: (prestation: PrestationOption) => void;
  onAddSurcharge: (surcharge: SurchargeOption) => void;
  currencySymbol: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ForfaitAccordionSection: React.FC<ForfaitAccordionSectionProps> = React.memo(
  ({ forfait, teams, canEdit, onChange, availablePrestations, availableSurcharges, onAddPrestation, onAddSurcharge, currencySymbol }) => {
    const { t } = useTranslation();
    const primaryColor = '#6B8A9A';

    // ─── Add prestation dialog ─────────────────────────────────────────
    const [addPrestationOpen, setAddPrestationOpen] = useState(false);
    const [newPrestationKey, setNewPrestationKey] = useState('');
    const [newPrestationLabel, setNewPrestationLabel] = useState('');

    // ─── Add surcharge dialog ──────────────────────────────────────────
    const [addSurchargeOpen, setAddSurchargeOpen] = useState(false);
    const [newSurchargeKey, setNewSurchargeKey] = useState('');
    const [newSurchargeLabel, setNewSurchargeLabel] = useState('');

    // ─── Toggle helpers ───────────────────────────────────────────────

    const toggleServiceType = useCallback((value: string) => {
      if (!canEdit) return;
      const current = forfait.serviceTypes || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange({ ...forfait, serviceTypes: next });
    }, [forfait, canEdit, onChange]);

    const togglePrestation = useCallback((key: string, column: 'included' | 'extra') => {
      if (!canEdit) return;
      const included = [...(forfait.includedPrestations || [])];
      const extra = [...(forfait.extraPrestations || [])];

      const idxInc = included.indexOf(key);
      const idxExt = extra.indexOf(key);
      if (idxInc >= 0) included.splice(idxInc, 1);
      if (idxExt >= 0) extra.splice(idxExt, 1);

      if (column === 'included' && idxInc < 0) {
        included.push(key);
      } else if (column === 'extra' && idxExt < 0) {
        extra.push(key);
      }

      onChange({ ...forfait, includedPrestations: included, extraPrestations: extra });
    }, [forfait, canEdit, onChange]);

    const toggleTeam = useCallback((teamId: number) => {
      if (!canEdit) return;
      const current = forfait.eligibleTeamIds || [];
      const next = current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId];
      onChange({ ...forfait, eligibleTeamIds: next });
    }, [forfait, canEdit, onChange]);

    // ─── Surcharge & surface handlers ─────────────────────────────────

    const updateSurcharge = useCallback((key: string, value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      onChange({
        ...forfait,
        surcharges: { ...(forfait.surcharges || {}), [key]: num },
      });
    }, [forfait, onChange]);

    const updateSurfaceBasePrice = useCallback((index: number, field: 'maxSurface' | 'base', value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num) && field !== 'maxSurface') return;
      const prices = [...(forfait.surfaceBasePrices || [])];
      if (field === 'maxSurface') {
        prices[index] = { ...prices[index], maxSurface: value === '' ? null : num };
      } else {
        prices[index] = { ...prices[index], base: num };
      }
      onChange({ ...forfait, surfaceBasePrices: prices });
    }, [forfait, onChange]);

    const addSurfaceTier = useCallback(() => {
      const prices = [...(forfait.surfaceBasePrices || [])];
      prices.push({ maxSurface: null, base: 0 });
      onChange({ ...forfait, surfaceBasePrices: prices });
    }, [forfait, onChange]);

    const removeSurfaceTier = useCallback((index: number) => {
      const prices = [...(forfait.surfaceBasePrices || [])];
      prices.splice(index, 1);
      onChange({ ...forfait, surfaceBasePrices: prices });
    }, [forfait, onChange]);

    const updateCoeff = useCallback((field: 'coeffMin' | 'coeffMax', value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      onChange({ ...forfait, [field]: num });
    }, [forfait, onChange]);

    // ─── Add prestation handler ───────────────────────────────────────
    const handleAddPrestation = useCallback(() => {
      if (!newPrestationKey.trim() || !newPrestationLabel.trim()) return;
      onAddPrestation({ key: newPrestationKey.trim(), label: newPrestationLabel.trim() });
      setNewPrestationKey('');
      setNewPrestationLabel('');
      setAddPrestationOpen(false);
    }, [newPrestationKey, newPrestationLabel, onAddPrestation]);

    // ─── Add surcharge handler ────────────────────────────────────────
    const handleAddSurcharge = useCallback(() => {
      if (!newSurchargeKey.trim() || !newSurchargeLabel.trim()) return;
      onAddSurcharge({ key: newSurchargeKey.trim(), label: newSurchargeLabel.trim(), unit: currencySymbol });
      setNewSurchargeKey('');
      setNewSurchargeLabel('');
      setAddSurchargeOpen(false);
    }, [newSurchargeKey, newSurchargeLabel, onAddSurcharge]);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* ─── Coefficients ─────────────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>{t('tarification.forfaitSection.priceCoefficients')}</Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField
                label={t('tarification.forfaitSection.coeffMin')}
                type="number"
                size="small"
                fullWidth
                value={forfait.coeffMin}
                onChange={(e) => updateCoeff('coeffMin', e.target.value)}
                disabled={!canEdit}
                inputProps={{ step: 0.05, min: 0.1, max: 5.0 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label={t('tarification.forfaitSection.coeffMax')}
                type="number"
                size="small"
                fullWidth
                value={forfait.coeffMax}
                onChange={(e) => updateCoeff('coeffMax', e.target.value)}
                disabled={!canEdit}
                inputProps={{ step: 0.05, min: 0.1, max: 5.0 }}
              />
            </Grid>
          </Grid>
        </Box>

        {/* ─── Types de service associés ────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>{t('tarification.forfaitSection.serviceTypes')}</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {ALL_CLEANING_SERVICE_TYPE_KEYS.map((stKey) => {
              const isSelected = (forfait.serviceTypes || []).includes(stKey);
              return (
                <Chip
                  key={stKey}
                  icon={<AutoAwesome sx={{ fontSize: 14 }} />}
                  label={t(`tarification.forfaitSection.cleaningTypes.${stKey}`)}
                  onClick={canEdit ? () => toggleServiceType(stKey) : undefined}
                  variant={isSelected ? 'filled' : 'outlined'}
                  size="small"
                  sx={{
                    ...CHIP_SX,
                    borderColor: isSelected ? primaryColor : 'grey.200',
                    bgcolor: isSelected ? alpha(primaryColor, 0.12) : 'transparent',
                    color: isSelected ? primaryColor : 'text.secondary',
                    '& .MuiChip-icon': {
                      fontSize: 14,
                      ml: 0.5,
                      color: isSelected ? primaryColor : 'primary.main',
                    },
                    '&:hover': canEdit ? {
                      bgcolor: alpha(primaryColor, 0.06),
                      borderColor: primaryColor,
                    } : {},
                    cursor: canEdit ? 'pointer' : 'default',
                    opacity: canEdit ? 1 : 0.6,
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* ─── Prestations incluses / en supplément ─────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>{t('tarification.forfaitSection.prestations')}</Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            {/* Incluses */}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: 'success.main', mb: 0.5 }}>
                {t('tarification.forfaitSection.includedInPrice')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {availablePrestations.map((p) => {
                  const isIncluded = (forfait.includedPrestations || []).includes(p.key);
                  return (
                    <Chip
                      key={p.key}
                      label={t(`tarification.forfaitSection.prestationTypes.${p.key}`, p.label)}
                      onClick={canEdit ? () => togglePrestation(p.key, 'included') : undefined}
                      variant={isIncluded ? 'filled' : 'outlined'}
                      size="small"
                      sx={{
                        ...CHIP_SX,
                        borderColor: isIncluded ? 'success.main' : 'grey.200',
                        bgcolor: isIncluded ? alpha('#4caf50', 0.12) : 'transparent',
                        color: isIncluded ? 'success.main' : 'text.disabled',
                        cursor: canEdit ? 'pointer' : 'default',
                        opacity: canEdit ? 1 : 0.6,
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
            {/* En supplément */}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: 'warning.main', mb: 0.5 }}>
                {t('tarification.forfaitSection.extraCharge')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {availablePrestations.map((p) => {
                  const isExtra = (forfait.extraPrestations || []).includes(p.key);
                  return (
                    <Chip
                      key={p.key}
                      label={t(`tarification.forfaitSection.prestationTypes.${p.key}`, p.label)}
                      onClick={canEdit ? () => togglePrestation(p.key, 'extra') : undefined}
                      variant={isExtra ? 'filled' : 'outlined'}
                      size="small"
                      sx={{
                        ...CHIP_SX,
                        borderColor: isExtra ? 'warning.main' : 'grey.200',
                        bgcolor: isExtra ? alpha('#ff9800', 0.12) : 'transparent',
                        color: isExtra ? 'warning.main' : 'text.disabled',
                        cursor: canEdit ? 'pointer' : 'default',
                        opacity: canEdit ? 1 : 0.6,
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          </Box>
          {/* Add prestation button */}
          {canEdit && (
            <Box sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => setAddPrestationOpen(true)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('tarification.addPrestation')}
              </Button>
            </Box>
          )}
        </Box>

        {/* ─── Équipes éligibles ────────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>
            {t('tarification.forfaitSection.eligibleTeams')}
            <Typography component="span" sx={{ fontSize: '0.5625rem', fontWeight: 400, color: 'text.disabled', ml: 1 }}>
              {t('tarification.forfaitSection.eligibleTeamsHint')}
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {teams.length === 0 ? (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', fontStyle: 'italic' }}>
                {t('tarification.forfaitSection.noTeamsAvailable')}
              </Typography>
            ) : (
              teams.map((team) => {
                const isSelected = (forfait.eligibleTeamIds || []).includes(team.id);
                return (
                  <Chip
                    key={team.id}
                    icon={<Group sx={{ fontSize: 14 }} />}
                    label={`${team.name} (${team.memberCount})`}
                    onClick={canEdit ? () => toggleTeam(team.id) : undefined}
                    variant={isSelected ? 'filled' : 'outlined'}
                    size="small"
                    sx={{
                      ...CHIP_SX,
                      borderColor: isSelected ? primaryColor : 'grey.200',
                      bgcolor: isSelected ? alpha(primaryColor, 0.12) : 'transparent',
                      color: isSelected ? primaryColor : 'text.secondary',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                        ml: 0.5,
                        color: isSelected ? primaryColor : 'primary.main',
                      },
                      '&:hover': canEdit ? {
                        bgcolor: alpha(primaryColor, 0.06),
                        borderColor: primaryColor,
                      } : {},
                      cursor: canEdit ? 'pointer' : 'default',
                      opacity: canEdit ? 1 : 0.6,
                    }}
                  />
                );
              })
            )}
          </Box>
        </Box>

        {/* ─── Tarification par surface ─────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>{t('tarification.forfaitSection.surfacePricing')}</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.6875rem' }}>{t('tarification.forfaitSection.maxThreshold')}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.6875rem' }}>{t('tarification.forfaitSection.basePrice')}</TableCell>
                  {canEdit && <TableCell align="center" sx={{ width: 48 }} />}
                </TableRow>
              </TableHead>
              <TableBody>
                {(forfait.surfaceBasePrices || []).map((tier, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {tier.maxSurface !== null ? (
                        <TextField
                          type="number"
                          size="small"
                          value={tier.maxSurface}
                          onChange={(e) => updateSurfaceBasePrice(index, 'maxSurface', e.target.value)}
                          disabled={!canEdit}
                          inputProps={{ min: 1, style: { textAlign: 'right' } }}
                          sx={{ width: 100 }}
                          InputProps={{ endAdornment: <InputAdornment position="end">m²</InputAdornment> }}
                        />
                      ) : (
                        <Chip label={t('tarification.forfaitSection.unlimited')} size="small" variant="outlined" color="default" sx={{ height: 24 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={tier.base}
                        onChange={(e) => updateSurfaceBasePrice(index, 'base', e.target.value)}
                        disabled={!canEdit}
                        inputProps={{ min: 0, style: { textAlign: 'right' } }}
                        sx={{ width: 100 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => removeSurfaceTier(index)} color="error">
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {canEdit && (
            <Box sx={{ mt: 0.5 }}>
              <Chip
                icon={<Add sx={{ fontSize: 14 }} />}
                label={t('tarification.forfaitSection.addTier')}
                onClick={addSurfaceTier}
                variant="outlined"
                size="small"
                sx={{ ...CHIP_SX, cursor: 'pointer', borderStyle: 'dashed' }}
              />
            </Box>
          )}
        </Box>

        {/* ─── Surcharges ───────────────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>{t('tarification.forfaitSection.surcharges')}</Typography>
          <Grid container spacing={1}>
            {availableSurcharges.map((s) => (
              <Grid item xs={6} sm={4} key={s.key}>
                <TextField
                  label={t(`tarification.forfaitSection.surcharge_${s.key}`, s.label)}
                  type="number"
                  size="small"
                  fullWidth
                  value={(forfait.surcharges || {})[s.key] ?? 0}
                  onChange={(e) => updateSurcharge(s.key, e.target.value)}
                  disabled={!canEdit}
                  inputProps={{ step: 1, min: 0 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">{s.unit}</InputAdornment> }}
                />
              </Grid>
            ))}
          </Grid>
          {/* Add surcharge button */}
          {canEdit && (
            <Box sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => setAddSurchargeOpen(true)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('tarification.addSurcharge')}
              </Button>
            </Box>
          )}
        </Box>

        {/* ─── Add prestation dialog ───────────────────────────────────── */}
        <Dialog open={addPrestationOpen} onClose={() => setAddPrestationOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('tarification.addPrestation')}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField
              label={t('tarification.newItem.key')}
              value={newPrestationKey}
              onChange={(e) => setNewPrestationKey(e.target.value)}
              size="small"
              fullWidth
              autoFocus
              helperText={t('tarification.newItem.keyHelp')}
            />
            <TextField
              label={t('tarification.newItem.label')}
              value={newPrestationLabel}
              onChange={(e) => setNewPrestationLabel(e.target.value)}
              size="small"
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddPrestationOpen(false)}>{t('tarification.cancel')}</Button>
            <Button onClick={handleAddPrestation} variant="contained" disabled={!newPrestationKey.trim() || !newPrestationLabel.trim()}>
              {t('tarification.add')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ─── Add surcharge dialog ────────────────────────────────────── */}
        <Dialog open={addSurchargeOpen} onClose={() => setAddSurchargeOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('tarification.addSurcharge')}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField
              label={t('tarification.newItem.key')}
              value={newSurchargeKey}
              onChange={(e) => setNewSurchargeKey(e.target.value)}
              size="small"
              fullWidth
              autoFocus
              helperText={t('tarification.newItem.keyHelp')}
            />
            <TextField
              label={t('tarification.newItem.label')}
              value={newSurchargeLabel}
              onChange={(e) => setNewSurchargeLabel(e.target.value)}
              size="small"
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddSurchargeOpen(false)}>{t('tarification.cancel')}</Button>
            <Button onClick={handleAddSurcharge} variant="contained" disabled={!newSurchargeKey.trim() || !newSurchargeLabel.trim()}>
              {t('tarification.add')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
);

ForfaitAccordionSection.displayName = 'ForfaitAccordionSection';

export default ForfaitAccordionSection;
