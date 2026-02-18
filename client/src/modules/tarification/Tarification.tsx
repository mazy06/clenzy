import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Save,
  Refresh,
  Euro,
  Home,
  People,
  Speed,
  SquareFoot,
  Computer,
  Devices,
  ExpandMore,
  AutoAwesome,
  Bolt,
  CleaningServices,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { pricingConfigApi, DEFAULT_FORFAIT_CONFIGS } from '../../services/api/pricingConfigApi';
import type { PricingConfig, PricingConfigUpdate, SurfaceTier, ForfaitConfig } from '../../services/api/pricingConfigApi';
import { teamsApi } from '../../services/api/teamsApi';
import type { Team } from '../../services/api/teamsApi';
import PageHeader from '../../components/PageHeader';
import ForfaitAccordionSection from './ForfaitAccordionSection';

// ─── Default values (matching backend defaults) ────────────────────────────

const DEFAULT_CONFIG: PricingConfig = {
  id: null,
  propertyTypeCoeffs: { studio: 0.85, appartement: 1.0, maison: 1.15, duplex: 1.20, villa: 1.35, autre: 1.0 },
  propertyCountCoeffs: { '1': 1.0, '2': 0.95, '3-5': 0.90, '6+': 0.85 },
  guestCapacityCoeffs: { '1-2': 0.90, '3-4': 1.0, '5-6': 1.10, '7+': 1.25 },
  frequencyCoeffs: { 'tres-frequent': 0.85, regulier: 0.92, 'nouvelle-annonce': 1.0, occasionnel: 1.10 },
  surfaceTiers: [
    { maxSurface: 40, coeff: 0.85, label: '< 40 m²' },
    { maxSurface: 60, coeff: 1.0, label: '40 - 60 m²' },
    { maxSurface: 80, coeff: 1.10, label: '61 - 80 m²' },
    { maxSurface: 120, coeff: 1.20, label: '81 - 120 m²' },
    { maxSurface: null, coeff: 1.35, label: '> 120 m²' },
  ],
  basePriceEssentiel: 50,
  basePriceConfort: 75,
  basePricePremium: 100,
  minPrice: 50,
  pmsMonthlyPriceCents: 500,
  pmsSyncPriceCents: 1000,
  automationBasicSurcharge: 0,
  automationFullSurcharge: 0,
  forfaitConfigs: DEFAULT_FORFAIT_CONFIGS,
  updatedAt: null,
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function Tarification() {
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [expandedSection, setExpandedSection] = useState<string | false>('basePrices');
  const handleAccordionChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  // Load config + teams
  useEffect(() => {
    const load = async () => {
      try {
        const [data, teamData] = await Promise.all([
          pricingConfigApi.get(),
          teamsApi.getAll().catch(() => [] as Team[]),
        ]);
        setConfig({
          ...data,
          forfaitConfigs: data.forfaitConfigs?.length ? data.forfaitConfigs : DEFAULT_FORFAIT_CONFIGS,
        });
        setTeams(teamData);
      } catch {
        setSnackbar({ open: true, message: t('tarification.loadError'), severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  // Check edit permission
  useEffect(() => {
    hasPermissionAsync('tarification:edit').then(setCanEdit);
  }, [hasPermissionAsync]);

  // Handlers
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { id, updatedAt, ...updateData } = config;
      const updated = await pricingConfigApi.update(updateData as PricingConfigUpdate);
      setConfig(updated);
      setSnackbar({ open: true, message: t('tarification.saveSuccess'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('tarification.saveError'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [config, t]);

  const handleReset = useCallback(() => {
    if (window.confirm(t('tarification.resetConfirm'))) {
      setConfig({ ...DEFAULT_CONFIG, id: config.id, updatedAt: config.updatedAt });
    }
  }, [config.id, config.updatedAt, t]);

  const updateCoeff = (group: 'propertyTypeCoeffs' | 'propertyCountCoeffs' | 'guestCapacityCoeffs' | 'frequencyCoeffs', key: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setConfig((prev) => ({
      ...prev,
      [group]: { ...prev[group], [key]: num },
    }));
  };

  const updateSurfaceTier = (index: number, field: 'coeff', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setConfig((prev) => {
      const tiers = [...prev.surfaceTiers];
      tiers[index] = { ...tiers[index], [field]: num };
      return { ...prev, surfaceTiers: tiers };
    });
  };

  const updateNumericField = (field: keyof PricingConfig, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setConfig((prev) => ({ ...prev, [field]: num }));
  };

  const updateForfait = useCallback((index: number, updated: ForfaitConfig) => {
    setConfig((prev) => {
      const forfaits = [...(prev.forfaitConfigs || [])];
      forfaits[index] = updated;
      return { ...prev, forfaitConfigs: forfaits };
    });
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t('tarification.title')}
        subtitle={t('tarification.subtitle')}
        backPath="/dashboard"
      />

      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('tarification.readOnly')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* ─── Section 1: Prix de base des forfaits ────────────────── */}
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
                <TextField label={t('tarification.basePrices.essentiel')} type="number" size="small" fullWidth value={config.basePriceEssentiel} onChange={(e) => updateNumericField('basePriceEssentiel', e.target.value)} disabled={!canEdit} InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField label={t('tarification.basePrices.confort')} type="number" size="small" fullWidth value={config.basePriceConfort} onChange={(e) => updateNumericField('basePriceConfort', e.target.value)} disabled={!canEdit} InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField label={t('tarification.basePrices.premium')} type="number" size="small" fullWidth value={config.basePricePremium} onChange={(e) => updateNumericField('basePricePremium', e.target.value)} disabled={!canEdit} InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField label={t('tarification.basePrices.minPrice')} type="number" size="small" fullWidth value={config.minPrice} onChange={(e) => updateNumericField('minPrice', e.target.value)} disabled={!canEdit} helperText={t('tarification.basePrices.minPriceHelp')} InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* ─── Sections Forfaits nettoyage ──────────────────────────── */}
        {(config.forfaitConfigs || []).map((forfait, index) => {
          const panelKey = `forfait-${forfait.key}`;
          const icons = [
            <AutoAwesome key="s" sx={{ color: 'primary.main', fontSize: 20 }} />,
            <Bolt key="e" sx={{ color: 'warning.main', fontSize: 20 }} />,
            <CleaningServices key="d" sx={{ color: 'secondary.main', fontSize: 20 }} />,
          ];
          return (
            <Accordion
              key={forfait.key}
              expanded={expandedSection === panelKey}
              onChange={handleAccordionChange(panelKey)}
              sx={{ '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {icons[index] || icons[0]}
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
                />
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* ─── Section 2: Abonnement PMS + Automation ──────────────── */}
        <Accordion expanded={expandedSection === 'subscription'} onChange={handleAccordionChange('subscription')} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Devices sx={{ color: 'info.main', fontSize: 20 }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>{t('tarification.pms.title')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('tarification.pms.subtitle')}</Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField label={t('tarification.pms.monthly')} type="number" size="small" fullWidth value={(config.pmsMonthlyPriceCents / 100).toFixed(0)} onChange={(e) => { const euros = parseInt(e.target.value, 10); if (!isNaN(euros)) setConfig((prev) => ({ ...prev, pmsMonthlyPriceCents: euros * 100 })); }} disabled={!canEdit} helperText={t('tarification.pms.monthlyHelp')} InputProps={{ endAdornment: <InputAdornment position="end">€/mois</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField label={t('tarification.pms.sync')} type="number" size="small" fullWidth value={(config.pmsSyncPriceCents / 100).toFixed(0)} onChange={(e) => { const euros = parseInt(e.target.value, 10); if (!isNaN(euros)) setConfig((prev) => ({ ...prev, pmsSyncPriceCents: euros * 100 })); }} disabled={!canEdit} helperText={t('tarification.pms.syncHelp')} InputProps={{ endAdornment: <InputAdornment position="end">€/mois</InputAdornment> }} />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Computer sx={{ color: 'warning.main', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>{t('tarification.automation.title')}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('tarification.automation.subtitle')}</Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField label={t('tarification.automation.basic')} type="number" size="small" fullWidth value={config.automationBasicSurcharge} onChange={(e) => updateNumericField('automationBasicSurcharge', e.target.value)} disabled={!canEdit} helperText={t('tarification.automation.basicHelp')} InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField label={t('tarification.automation.full')} type="number" size="small" fullWidth value={config.automationFullSurcharge} onChange={(e) => updateNumericField('automationFullSurcharge', e.target.value)} disabled={!canEdit} helperText={t('tarification.automation.fullHelp')} InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* ─── Section 3: Coefficients type de logement ────────────── */}
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
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Coefficient</TableCell>
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

        {/* ─── Section 4: Coefficients nombre de logements ─────────── */}
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
                    <TableCell>Nombre</TableCell>
                    <TableCell align="right">Coefficient</TableCell>
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

        {/* ─── Section 5: Coefficients capacité voyageurs ──────────── */}
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
                    <TableCell>Capacite</TableCell>
                    <TableCell align="right">Coefficient</TableCell>
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

        {/* ─── Section 6: Coefficients fréquence ───────────────────── */}
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
                    <TableCell>Frequence</TableCell>
                    <TableCell align="right">Coefficient</TableCell>
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

        {/* ─── Section 7: Paliers surface ──────────────────────────── */}
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
                    <TableCell>Palier</TableCell>
                    <TableCell align="center">Seuil max (m²)</TableCell>
                    <TableCell align="right">Coefficient</TableCell>
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
                        <TextField type="number" size="small" value={tier.coeff} onChange={(e) => updateSurfaceTier(index, 'coeff', e.target.value)} disabled={!canEdit} inputProps={{ step: 0.05, min: 0.1, max: 5.0, style: { textAlign: 'right' } }} sx={{ width: 100 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* ─── Action buttons ──────────────────────────────────────── */}
      {canEdit && (
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleReset}
            disabled={saving}
          >
            {t('tarification.reset')}
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
            onClick={handleSave}
            disabled={saving}
          >
            {t('tarification.save')}
          </Button>
        </Box>
      )}

      {/* ─── Snackbar ────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
