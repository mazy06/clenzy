import React, { useCallback } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  AutoAwesome,
  Group,
  Add,
  Delete,
} from '@mui/icons-material';
import type { ForfaitConfig, SurfaceBasePrice } from '../../services/api/pricingConfigApi';
import type { Team } from '../../services/api/teamsApi';

// ─── Constants ────────────────────────────────────────────────────────────────

/** All cleaning intervention types that can be assigned to a forfait */
const ALL_CLEANING_SERVICE_TYPES: { value: string; label: string }[] = [
  { value: 'CLEANING', label: 'Nettoyage' },
  { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express' },
  { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur' },
  { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres' },
  { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols' },
  { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine' },
  { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires' },
];

/** All prestations that can be included or extra */
const ALL_PRESTATIONS: { key: string; label: string }[] = [
  { key: 'laundry', label: 'Linge' },
  { key: 'exterior', label: 'Extérieur' },
  { key: 'ironing', label: 'Repassage' },
  { key: 'deepKitchen', label: 'Cuisine profonde' },
  { key: 'disinfection', label: 'Désinfection' },
  { key: 'windows', label: 'Fenêtres' },
  { key: 'frenchDoors', label: 'Portes-fenêtres' },
  { key: 'slidingDoors', label: 'Baies vitrées' },
];

/** Surcharge keys and labels */
const SURCHARGE_KEYS: { key: string; label: string; unit: string }[] = [
  { key: 'perBedroom', label: 'Par chambre sup.', unit: '€' },
  { key: 'perBathroom', label: 'Par salle de bain sup.', unit: '€' },
  { key: 'perFloor', label: 'Par étage sup.', unit: '€' },
  { key: 'exterior', label: 'Extérieur', unit: '€' },
  { key: 'laundry', label: 'Linge', unit: '€' },
  { key: 'perGuestAbove4', label: 'Par voyageur (>4)', unit: '€' },
];

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
}

// ─── Component ────────────────────────────────────────────────────────────────

const ForfaitAccordionSection: React.FC<ForfaitAccordionSectionProps> = React.memo(
  ({ forfait, teams, canEdit, onChange }) => {
    const primaryColor = '#6B8A9A';

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

      // Remove from both columns first
      const idxInc = included.indexOf(key);
      const idxExt = extra.indexOf(key);
      if (idxInc >= 0) included.splice(idxInc, 1);
      if (idxExt >= 0) extra.splice(idxExt, 1);

      // Add to the target column (toggle: if was already there, just remove = neither)
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

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* ─── Coefficients ─────────────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>Coefficients de prix</Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField
                label="Coeff. min"
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
                label="Coeff. max"
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
          <Typography sx={SECTION_TITLE_SX}>Types de service associés</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {ALL_CLEANING_SERVICE_TYPES.map((st) => {
              const isSelected = (forfait.serviceTypes || []).includes(st.value);
              return (
                <Chip
                  key={st.value}
                  icon={<AutoAwesome sx={{ fontSize: 14 }} />}
                  label={st.label}
                  onClick={canEdit ? () => toggleServiceType(st.value) : undefined}
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
          <Typography sx={SECTION_TITLE_SX}>Prestations</Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            {/* Incluses */}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: 'success.main', mb: 0.5 }}>
                Incluses dans le prix
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {ALL_PRESTATIONS.map((p) => {
                  const isIncluded = (forfait.includedPrestations || []).includes(p.key);
                  return (
                    <Chip
                      key={p.key}
                      label={p.label}
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
                En supplément
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {ALL_PRESTATIONS.map((p) => {
                  const isExtra = (forfait.extraPrestations || []).includes(p.key);
                  return (
                    <Chip
                      key={p.key}
                      label={p.label}
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
        </Box>

        {/* ─── Équipes éligibles ────────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>
            Équipes éligibles
            <Typography component="span" sx={{ fontSize: '0.5625rem', fontWeight: 400, color: 'text.disabled', ml: 1 }}>
              (vide = toutes les équipes)
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {teams.length === 0 ? (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', fontStyle: 'italic' }}>
                Aucune équipe disponible
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
          <Typography sx={SECTION_TITLE_SX}>Tarification par surface</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.6875rem' }}>Seuil max (m²)</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.6875rem' }}>Prix de base (€)</TableCell>
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
                        <Chip label="Illimité" size="small" variant="outlined" color="default" sx={{ height: 24 }} />
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
                        InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
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
                label="Ajouter un palier"
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
          <Typography sx={SECTION_TITLE_SX}>Surcharges</Typography>
          <Grid container spacing={1}>
            {SURCHARGE_KEYS.map((sk) => (
              <Grid item xs={6} sm={4} key={sk.key}>
                <TextField
                  label={sk.label}
                  type="number"
                  size="small"
                  fullWidth
                  value={(forfait.surcharges || {})[sk.key] ?? 0}
                  onChange={(e) => updateSurcharge(sk.key, e.target.value)}
                  disabled={!canEdit}
                  inputProps={{ step: 1, min: 0 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">{sk.unit}</InputAdornment> }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    );
  }
);

ForfaitAccordionSection.displayName = 'ForfaitAccordionSection';

export default ForfaitAccordionSection;
