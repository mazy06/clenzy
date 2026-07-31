import React, { useCallback, useState } from 'react';
import StatusChip from '../../components/StatusChip';
import { cn } from '../../utils/cn';
import { Badge } from '../../components/ui';
import { Typography, TextField, Grid, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import {
  AutoAwesome,
  Group,
  Add,
  Delete,
} from '../../icons';
import type { ForfaitConfig, SurfaceBasePrice, PrestationOption, SurchargeOption } from '../../services/api/pricingConfigApi';
import type { Team } from '../../services/api/teamsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';

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
    const { currency } = useCurrency();

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
    }, [newSurchargeKey, newSurchargeLabel, onAddSurcharge, currencySymbol]);

    const includedPrestationSet = new Set(forfait.includedPrestations || []);
    const extraPrestationSet = new Set(forfait.extraPrestations || []);
    const eligibleTeamIdSet = new Set(forfait.eligibleTeamIds || []);

    return (
      <div className="flex flex-col gap-3.5">
        {/* ─── Coefficients ─────────────────────────────────────────────── */}
        <div>
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
        </div>

        {/* ─── Types de service associés ────────────────────────────────── */}
        <div>
          <Typography sx={SECTION_TITLE_SX}>{t('tarification.forfaitSection.serviceTypes')}</Typography>
          <div className="flex gap-1 flex-wrap">
            {ALL_CLEANING_SERVICE_TYPE_KEYS.map((stKey) => {
              const isSelected = (forfait.serviceTypes || []).includes(stKey);
              return (
                <StatusChip
                  key={stKey}
                  outlined
                  selected={isSelected}
                  pressed={isSelected}
                  tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }}
                  icon={<AutoAwesome size={14} strokeWidth={1.75} />}
                  label={t(`tarification.forfaitSection.cleaningTypes.${stKey}`)}
                  onClick={canEdit ? () => toggleServiceType(stKey) : undefined}
                  className={cn('h-[30px] text-[0.75rem]', !canEdit && 'opacity-60')}
                />
              );
            })}
          </div>
        </div>

        {/* ─── Prestations incluses / en supplément ─────────────────────── */}
        <div>
          <Typography sx={SECTION_TITLE_SX}>{t('tarification.forfaitSection.prestations')}</Typography>
          <div className="flex gap-4">
            {/* Incluses */}
            <div className="flex-1">
              <p className="cn-text-body1 text-[0.5625rem] font-semibold text-[var(--bui-success-ink)] mb-0.5">
                {t('tarification.forfaitSection.includedInPrice')}
              </p>
              <div className="flex gap-0.5 flex-wrap">
                {availablePrestations.map((p) => {
                  const isIncluded = includedPrestationSet.has(p.key);
                  return (
                    <StatusChip
                      key={p.key}
                      outlined
                      selected={isIncluded}
                      pressed={isIncluded}
                      tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }}
                      label={t(`tarification.forfaitSection.prestationTypes.${p.key}`, p.label)}
                      onClick={canEdit ? () => togglePrestation(p.key, 'included') : undefined}
                      className={cn('h-[30px] text-[0.75rem]', !canEdit && 'opacity-60')}
                    />
                  );
                })}
              </div>
            </div>
            {/* En supplément */}
            <div className="flex-1">
              <p className="cn-text-body1 text-[0.5625rem] font-semibold text-[var(--bui-warning-ink)] mb-0.5">
                {t('tarification.forfaitSection.extraCharge')}
              </p>
              <div className="flex gap-0.5 flex-wrap">
                {availablePrestations.map((p) => {
                  const isExtra = extraPrestationSet.has(p.key);
                  return (
                    <StatusChip
                      key={p.key}
                      outlined
                      selected={isExtra}
                      pressed={isExtra}
                      tokens={{ color: 'var(--warn)', bg: 'var(--warn-soft)' }}
                      label={t(`tarification.forfaitSection.prestationTypes.${p.key}`, p.label)}
                      onClick={canEdit ? () => togglePrestation(p.key, 'extra') : undefined}
                      className={cn('h-[30px] text-[0.75rem]', !canEdit && 'opacity-60')}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* Add prestation button */}
          {canEdit && (
            <div className="mt-1.5">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => setAddPrestationOpen(true)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('tarification.addPrestation')}
              </Button>
            </div>
          )}
        </div>

        {/* ─── Équipes éligibles ────────────────────────────────────────── */}
        <div>
          <Typography sx={SECTION_TITLE_SX}>
            {t('tarification.forfaitSection.eligibleTeams')}
            <span className="text-[0.5625rem] font-normal text-muted-foreground opacity-60 ms-1.5">
              {t('tarification.forfaitSection.eligibleTeamsHint')}
            </span>
          </Typography>
          <div className="flex gap-1 flex-wrap">
            {teams.length === 0 ? (
              <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground opacity-60 italic">
                {t('tarification.forfaitSection.noTeamsAvailable')}
              </p>
            ) : (
              teams.map((team) => {
                const isSelected = eligibleTeamIdSet.has(team.id);
                return (
                  <StatusChip
                    key={team.id}
                    outlined
                    selected={isSelected}
                    pressed={isSelected}
                    tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }}
                    icon={<Group size={14} strokeWidth={1.75} />}
                    label={`${team.name} (${team.memberCount})`}
                    onClick={canEdit ? () => toggleTeam(team.id) : undefined}
                    className={cn('h-[30px] text-[0.75rem]', !canEdit && 'opacity-60')}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ─── Tarification par surface ─────────────────────────────────── */}
        <div>
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
                        <Badge variant="secondary" className="h-[24px]">{t('tarification.forfaitSection.unlimited')}</Badge>
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
                        InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => removeSurfaceTier(index)} color="error">
                          <Delete size={16} strokeWidth={1.75} />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {canEdit && (
            <div className="mt-0.5">
              <StatusChip
                outlined
                tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }}
                icon={<Add size={14} strokeWidth={1.75} />}
                label={t('tarification.forfaitSection.addTier')}
                onClick={addSurfaceTier}
                className="h-[30px] border-dashed text-[0.75rem]"
              />
            </div>
          )}
        </div>

        {/* ─── Surcharges ───────────────────────────────────────────────── */}
        <div>
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
            <div className="mt-1.5">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => setAddSurchargeOpen(true)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('tarification.addSurcharge')}
              </Button>
            </div>
          )}
        </div>

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
      </div>
    );
  }
);

ForfaitAccordionSection.displayName = 'ForfaitAccordionSection';

export default ForfaitAccordionSection;
