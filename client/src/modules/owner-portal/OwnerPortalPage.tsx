import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, TextField, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Grid,
} from '@mui/material';
import {
  Home as HomeIcon,
  EventAvailable as ReservationIcon,
  TrendingUp as RevenueIcon,
  Hotel as OccupancyIcon,
  Star as RatingIcon,
  Receipt as StatementIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { SPACING } from '../../theme/spacing';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import { useOwnerDashboard, useOwnerStatement } from '../../hooks/useOwnerPortal';
import type { OwnerDashboard, OwnerStatement } from '../../services/api/ownerPortalApi';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../utils/currencyUtils';

// ─── Constants ──────────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = { fontSize: '0.75rem', fontWeight: 700, py: 1, color: 'text.secondary' } as const;
const TAB_SX = { textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, minHeight: 40 } as const;

const KPI_CARD_SX = {
  ...CARD_SX,
  textAlign: 'center',
  p: 2,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number, currency = 'EUR') => formatCurrency(n, currency);

const fmtPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ─── Component ──────────────────────────────────────────────────────────────

const OwnerPortalPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-list'],
    queryFn: () => propertiesApi.getAll(),
    staleTime: 120_000,
  });

  const ownerId = selectedOwnerId === '' ? undefined : selectedOwnerId;

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageHeader
        title={t('ownerPortal.title', 'Portail Proprietaire')}
        subtitle={t('ownerPortal.subtitle', 'Dashboard et releves proprietaires')}
        showBackButton={false}
        backPath="/dashboard"
      />

      {/* ── Owner selector ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel sx={{ fontSize: '0.8125rem' }}>
            {t('ownerPortal.selectOwner', 'Selectionner un proprietaire')}
          </InputLabel>
          <Select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value as number | '')}
            label={t('ownerPortal.selectOwner', 'Selectionner un proprietaire')}
            sx={{ fontSize: '0.8125rem' }}
          >
            {properties.map((p: Property) => (
              <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                {p.name} (#{p.id})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
        >
          <Tab label={t('ownerPortal.tabs.dashboard', 'Dashboard')} sx={TAB_SX} />
          <Tab label={t('ownerPortal.tabs.statement', 'Releve')} sx={TAB_SX} />
        </Tabs>
      </Paper>

      {!ownerId ? (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <HomeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('ownerPortal.selectOwnerHint', 'Selectionnez un proprietaire pour afficher les donnees')}
          </Typography>
        </Paper>
      ) : (
        <>
          {activeTab === 0 && <DashboardTab ownerId={ownerId} />}
          {activeTab === 1 && <StatementTab ownerId={ownerId} />}
        </>
      )}
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════

const DashboardTab: React.FC<{ ownerId: number }> = ({ ownerId }) => {
  const { t } = useTranslation();
  const { data: dashboard, isLoading, isError } = useOwnerDashboard(ownerId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (isError || !dashboard) {
    return (
      <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
        {t('ownerPortal.dashboardError', 'Erreur lors du chargement du dashboard')}
      </Alert>
    );
  }

  const kpis = [
    { icon: <HomeIcon />, label: t('ownerPortal.kpi.properties', 'Proprietes'), value: dashboard.totalProperties, color: '#1976d2' },
    { icon: <ReservationIcon />, label: t('ownerPortal.kpi.reservations', 'Reservations actives'), value: dashboard.activeReservations, color: '#4A9B8E' },
    { icon: <RevenueIcon />, label: t('ownerPortal.kpi.netRevenue', 'Revenu net'), value: fmtCurrency(dashboard.netRevenue), color: '#2e7d32' },
    { icon: <OccupancyIcon />, label: t('ownerPortal.kpi.occupancy', 'Occupation moy.'), value: fmtPercent(dashboard.averageOccupancy), color: '#D4A574' },
    { icon: <RatingIcon />, label: t('ownerPortal.kpi.rating', 'Note moyenne'), value: dashboard.averageRating.toFixed(1), color: '#f9a825' },
  ];

  return (
    <>
      {/* ── KPI Cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {kpis.map((kpi) => (
          <Grid item xs={6} sm={4} md key={kpi.label}>
            <Card sx={KPI_CARD_SX}>
              <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
                <Box sx={{ color: kpi.color, mb: 0.5 }}>
                  {React.cloneElement(kpi.icon, { sx: { fontSize: '1.5rem' } })}
                </Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>
                  {kpi.value}
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mt: 0.25 }}>
                  {kpi.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Revenue by Month ── */}
      {dashboard.revenueByMonth && Object.keys(dashboard.revenueByMonth).length > 0 && (
        <Paper sx={{ ...CARD_SX, p: 2, mb: 2 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mb: 1.5 }}>
            {t('ownerPortal.revenueByMonth', 'Revenu par mois')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', height: 120 }}>
            {Object.entries(dashboard.revenueByMonth).map(([month, revenue]) => {
              const maxRevenue = Math.max(...Object.values(dashboard.revenueByMonth));
              const barHeight = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
              return (
                <Box key={month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', mb: 0.25 }}>
                    {fmtCurrency(revenue)}
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: `${barHeight}%`,
                      minHeight: 4,
                      backgroundColor: '#4A9B8E',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', mt: 0.25 }}>
                    {month.slice(-2)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {/* ── Properties Table ── */}
      {dashboard.properties && dashboard.properties.length > 0 && (
        <TableContainer component={Paper} sx={CARD_SX}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t('ownerPortal.col.property', 'Propriete')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('ownerPortal.col.revenue', 'Revenu')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('ownerPortal.col.occupancy', 'Occupation')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('ownerPortal.col.reservations', 'Reservations')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboard.properties.map((prop) => (
                <TableRow key={prop.propertyId} hover>
                  <TableCell sx={CELL_SX}>{prop.propertyName}</TableCell>
                  <TableCell sx={{ ...CELL_SX, fontWeight: 600 }} align="right">
                    {fmtCurrency(prop.revenue)}
                  </TableCell>
                  <TableCell sx={CELL_SX} align="center">
                    <Chip
                      label={fmtPercent(prop.occupancyRate)}
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 20,
                        fontWeight: 600,
                        backgroundColor: prop.occupancyRate > 0.7 ? '#4A9B8E' : prop.occupancyRate > 0.4 ? '#D4A574' : '#ef5350',
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={CELL_SX} align="center">{prop.reservationCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Statement Tab
// ═══════════════════════════════════════════════════════════════════════════

const StatementTab: React.FC<{ ownerId: number }> = ({ ownerId }) => {
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: statement, isLoading, isError } = useOwnerStatement(
    shouldFetch ? ownerId : undefined,
    shouldFetch ? from : undefined,
    shouldFetch ? to : undefined,
    ownerName,
  );

  const handleGenerate = () => {
    if (from && to) {
      setShouldFetch(true);
    }
  };

  return (
    <>
      {/* ── Filters ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          label={t('ownerPortal.form.ownerName', 'Nom proprietaire')}
          size="small"
          value={ownerName}
          onChange={(e) => { setOwnerName(e.target.value); setShouldFetch(false); }}
          InputProps={{ sx: { fontSize: '0.8125rem' } }}
          InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          sx={{ minWidth: 200 }}
        />
        <TextField
          label={t('ownerPortal.form.from', 'Du')}
          type="date"
          size="small"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setShouldFetch(false); }}
          InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
          InputProps={{ sx: { fontSize: '0.8125rem' } }}
        />
        <TextField
          label={t('ownerPortal.form.to', 'Au')}
          type="date"
          size="small"
          value={to}
          onChange={(e) => { setTo(e.target.value); setShouldFetch(false); }}
          InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
          InputProps={{ sx: { fontSize: '0.8125rem' } }}
        />
        <Button
          size="small"
          variant="contained"
          onClick={handleGenerate}
          disabled={!from || !to || isLoading}
          startIcon={isLoading ? <CircularProgress size={14} /> : <StatementIcon />}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          {t('ownerPortal.generate', 'Generer le releve')}
        </Button>
      </Paper>

      {/* ── Statement ── */}
      {isError && (
        <Alert severity="error" sx={{ fontSize: '0.8125rem', mb: 1.5 }}>
          {t('ownerPortal.statementError', 'Erreur lors de la generation du releve')}
        </Alert>
      )}

      {statement && (
        <>
          {/* ── Header totals ── */}
          <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 1 }}>
              {statement.ownerName} — {fmtDate(statement.periodStart)} → {fmtDate(statement.periodEnd)}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  {t('ownerPortal.totalRevenue', 'Revenu total')}
                </Typography>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1976d2' }}>
                  {fmtCurrency(statement.totalRevenue)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  {t('ownerPortal.totalCommissions', 'Commissions')}
                </Typography>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#D4A574' }}>
                  {fmtCurrency(statement.totalCommissions)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  {t('ownerPortal.totalExpenses', 'Depenses')}
                </Typography>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#ef5350' }}>
                  {fmtCurrency(statement.totalExpenses)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  {t('ownerPortal.netAmount', 'Montant net')}
                </Typography>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#2e7d32' }}>
                  {fmtCurrency(statement.netAmount)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* ── Statement lines ── */}
          {statement.lines && statement.lines.length > 0 && (
            <TableContainer component={Paper} sx={CARD_SX}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_CELL_SX}>{t('ownerPortal.col.date', 'Date')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX}>{t('ownerPortal.col.description', 'Description')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX}>{t('ownerPortal.col.property', 'Propriete')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX}>{t('ownerPortal.col.type', 'Type')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="right">{t('ownerPortal.col.amount', 'Montant')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="right">{t('ownerPortal.col.commission', 'Commission')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="right">{t('ownerPortal.col.net', 'Net')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statement.lines.map((line, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem' }}>{fmtDate(line.date)}</TableCell>
                      <TableCell sx={CELL_SX}>{line.description}</TableCell>
                      <TableCell sx={CELL_SX}>{line.propertyName}</TableCell>
                      <TableCell sx={CELL_SX}>
                        <Chip
                          label={line.type}
                          size="small"
                          sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell sx={CELL_SX} align="right">{fmtCurrency(line.amount)}</TableCell>
                      <TableCell sx={CELL_SX} align="right">{fmtCurrency(line.commission)}</TableCell>
                      <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">{fmtCurrency(line.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </>
  );
};

export default OwnerPortalPage;
