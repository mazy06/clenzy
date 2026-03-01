import React, { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Euro,
  ExpandMore,
  AutoAwesome,
  Bolt,
  CleaningServices,
  Home,
  People,
  Speed,
  SquareFoot,
} from '@mui/icons-material';
import type { PricingConfig, ForfaitConfig, CommissionConfig, PrestationOption, SurchargeOption } from '../../services/api/pricingConfigApi';
import type { Team } from '../../services/api/teamsApi';
import { useTranslation } from '../../hooks/useTranslation';
import ForfaitAccordionSection from './ForfaitAccordionSection';
import CommissionSection from './CommissionSection';

interface TabEntretienProps {
  config: PricingConfig;
  teams: Team[];
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabEntretien({ config, teams, canEdit, onUpdate, currencySymbol }: TabEntretienProps) {
  const { t } = useTranslation();
  const [expandedSection, setExpandedSection] = useState<string | false>('basePrices');

  const handleAccordionChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  const updateNumericField = (field: keyof PricingConfig, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    onUpdate({ [field]: num });
  };

  const updateCoeff = (group: 'propertyTypeCoeffs' | 'propertyCountCoeffs' | 'guestCapacityCoeffs' | 'frequencyCoeffs', key: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    onUpdate({ [group]: { ...config[group], [key]: num } });
  };

  const updateSurfaceTier = (index: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const tiers = [...config.surfaceTiers];
    tiers[index] = { ...tiers[index], coeff: num };
    onUpdate({ surfaceTiers: tiers });
  };

  const updateForfait = useCallback((index: number, updated: ForfaitConfig) => {
    const forfaits = [...(config.forfaitConfigs || [])];
    forfaits[index] = updated;
    onUpdate({ forfaitConfigs: forfaits });
  }, [config.forfaitConfigs, onUpdate]);

  const handleAddPrestation = useCallback((prestation: PrestationOption) => {
    const current = config.availablePrestations || [];
    if (current.some((p) => p.key === prestation.key)) return;
    onUpdate({ availablePrestations: [...current, prestation] });
  }, [config.availablePrestations, onUpdate]);

  const handleAddSurcharge = useCallback((surcharge: SurchargeOption) => {
    const current = config.availableSurcharges || [];
    if (current.some((s) => s.key === surcharge.key)) return;
    onUpdate({ availableSurcharges: [...current, surcharge] });
  }, [config.availableSurcharges, onUpdate]);

  const commission = (config.commissionConfigs || []).find((c) => c.category === 'entretien');

  const handleCommissionChange = useCallback((updated: CommissionConfig) => {
    const configs = [...(config.commissionConfigs || [])];
    const idx = configs.findIndex((c) => c.category === 'entretien');
    if (idx >= 0) {
      configs[idx] = updated;
    } else {
      configs.push(updated);
    }
    onUpdate({ commissionConfigs: configs });
  }, [config.commissionConfigs, onUpdate]);

  const FORFAIT_ICONS = [
    <AutoAwesome key="s" sx={{ color: 'primary.main', fontSize: 20 }} />,
    <Bolt key="e" sx={{ color: 'warning.main', fontSize: 20 }} />,
    <CleaningServices key="d" sx={{ color: 'secondary.main', fontSize: 20 }} />,
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
      {/* ─── Prix de base ───────────────────────────────────────────── */}
      <Accordion expanded={expandedSection === 'basePrices'} onChange={handleAccordionChange('basePrices')} sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Euro sx={{ color: 'primary.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{t('tarification.basePrices.title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('tarification.basePrices.subtitle')}</Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField label={t('tarification.basePrices.essentiel')} type="number" size="small" fullWidth value={config.basePriceEssentiel} onChange={(e) => updateNumericField('basePriceEssentiel', e.target.value)} disabled={!canEdit} InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label={t('tarification.basePrices.confort')} type="number" size="small" fullWidth value={config.basePriceConfort} onChange={(e) => updateNumericField('basePriceConfort', e.target.value)} disabled={!canEdit} InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label={t('tarification.basePrices.premium')} type="number" size="small" fullWidth value={config.basePricePremium} onChange={(e) => updateNumericField('basePricePremium', e.target.value)} disabled={!canEdit} InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label={t('tarification.basePrices.minPrice')} type="number" size="small" fullWidth value={config.minPrice} onChange={(e) => updateNumericField('minPrice', e.target.value)} disabled={!canEdit} helperText={t('tarification.basePrices.minPriceHelp')} InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }} />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Forfaits nettoyage ─────────────────────────────────────── */}
      {(config.forfaitConfigs || []).map((forfait, index) => {
        const panelKey = `forfait-${forfait.key}`;
        return (
          <Accordion
            key={forfait.key}
            expanded={expandedSection === panelKey}
            onChange={handleAccordionChange(panelKey)}
            sx={{ '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {FORFAIT_ICONS[index] || FORFAIT_ICONS[0]}
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t(`tarification.forfaits.${forfait.key}.title`, `Forfait ${forfait.label}`)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(`tarification.forfaits.${forfait.key}.subtitle`, `Configuration du forfait ${forfait.label.toLowerCase()}`)}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <ForfaitAccordionSection
                forfait={forfait}
                teams={teams}
                canEdit={canEdit}
                onChange={(updated) => updateForfait(index, updated)}
                availablePrestations={config.availablePrestations || []}
                availableSurcharges={config.availableSurcharges || []}
                onAddPrestation={handleAddPrestation}
                onAddSurcharge={handleAddSurcharge}
                currencySymbol={currencySymbol}
              />
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* ─── Coefficients type de logement ──────────────────────────── */}
      <Accordion expanded={expandedSection === 'propertyType'} onChange={handleAccordionChange('propertyType')} sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Home sx={{ color: 'secondary.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{t('tarification.propertyType.title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('tarification.propertyType.subtitle')}</Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('tarification.tableHeaders.type')}</TableCell>
                  <TableCell align="right">{t('tarification.tableHeaders.coefficient')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(config.propertyTypeCoeffs).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell>{t(`tarification.propertyType.${key}`) || key}</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>
                      <TextField type="number" size="small" value={value} onChange={(e) => updateCoeff('propertyTypeCoeffs', key, e.target.value)} disabled={!canEdit} inputProps={{ step: 0.05, min: 0.1, max: 5.0, style: { textAlign: 'right' } }} sx={{ width: 100 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* ─── Coefficients nombre de logements ───────────────────────── */}
      <Accordion expanded={expandedSection === 'propertyCount'} onChange={handleAccordionChange('propertyCount')} sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Home sx={{ color: 'success.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{t('tarification.propertyCount.title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('tarification.propertyCount.subtitle')}</Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('tarification.tableHeaders.count')}</TableCell>
                  <TableCell align="right">{t('tarification.tableHeaders.coefficient')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(config.propertyCountCoeffs).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell>{t(`tarification.propertyCount.${key}`) || key}</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>
                      <TextField type="number" size="small" value={value} onChange={(e) => updateCoeff('propertyCountCoeffs', key, e.target.value)} disabled={!canEdit} inputProps={{ step: 0.05, min: 0.1, max: 5.0, style: { textAlign: 'right' } }} sx={{ width: 100 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* ─── Coefficients capacité voyageurs ─────────────────────────── */}
      <Accordion expanded={expandedSection === 'guestCapacity'} onChange={handleAccordionChange('guestCapacity')} sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <People sx={{ color: 'primary.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{t('tarification.guestCapacity.title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('tarification.guestCapacity.subtitle')}</Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('tarification.tableHeaders.capacity')}</TableCell>
                  <TableCell align="right">{t('tarification.tableHeaders.coefficient')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(config.guestCapacityCoeffs).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell>{t(`tarification.guestCapacity.${key}`) || key}</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>
                      <TextField type="number" size="small" value={value} onChange={(e) => updateCoeff('guestCapacityCoeffs', key, e.target.value)} disabled={!canEdit} inputProps={{ step: 0.05, min: 0.1, max: 5.0, style: { textAlign: 'right' } }} sx={{ width: 100 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* ─── Coefficients fréquence ──────────────────────────────────── */}
      <Accordion expanded={expandedSection === 'frequency'} onChange={handleAccordionChange('frequency')} sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Speed sx={{ color: 'warning.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{t('tarification.frequency.title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('tarification.frequency.subtitle')}</Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('tarification.tableHeaders.frequency')}</TableCell>
                  <TableCell align="right">{t('tarification.tableHeaders.coefficient')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(config.frequencyCoeffs).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell>{t(`tarification.frequency.${key}`) || key}</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>
                      <TextField type="number" size="small" value={value} onChange={(e) => updateCoeff('frequencyCoeffs', key, e.target.value)} disabled={!canEdit} inputProps={{ step: 0.05, min: 0.1, max: 5.0, style: { textAlign: 'right' } }} sx={{ width: 100 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* ─── Paliers surface ─────────────────────────────────────────── */}
      <Accordion expanded={expandedSection === 'surfaceTiers'} onChange={handleAccordionChange('surfaceTiers')} sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SquareFoot sx={{ color: 'error.main', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{t('tarification.surface.title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('tarification.surface.subtitle')}</Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('tarification.tableHeaders.tier')}</TableCell>
                  <TableCell align="center">{t('tarification.tableHeaders.maxThreshold')}</TableCell>
                  <TableCell align="right">{t('tarification.tableHeaders.coefficient')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {config.surfaceTiers.map((tier, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Chip label={tier.label} size="small" variant="outlined" color={index === config.surfaceTiers.length - 1 ? 'error' : 'default'} />
                    </TableCell>
                    <TableCell align="center">{tier.maxSurface !== null ? `${tier.maxSurface} m²` : '—'}</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>
                      <TextField type="number" size="small" value={tier.coeff} onChange={(e) => updateSurfaceTier(index, e.target.value)} disabled={!canEdit} inputProps={{ step: 0.05, min: 0.1, max: 5.0, style: { textAlign: 'right' } }} sx={{ width: 100 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* ─── Commission entretien ────────────────────────────────────── */}
      {commission && (
        <Box sx={{ px: 1 }}>
          <CommissionSection
            commission={commission}
            canEdit={canEdit}
            onChange={handleCommissionChange}
          />
        </Box>
      )}
    </Box>
  );
}
