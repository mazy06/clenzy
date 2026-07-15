import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gavel, Add, Edit, Delete, Download, Receipt } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';
import {
  touristTaxApi,
  type TouristTaxConfig,
  type TouristTaxConfigRequest,
  type TouristTaxReport,
} from '../../services/api/touristTaxApi';
import TouristTaxBaremeDialog from './TouristTaxBaremeDialog';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TouristTaxSectionProps {
  canEdit: boolean;
}

const num = (v: number | null | undefined) => (v != null ? v.toFixed(2) : '—');

/** Premier jour du mois courant (défaut du rapport). */
function firstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const rateSummary = (config: TouristTaxConfig): string => {
  if (config.calculationMode === 'PERCENTAGE_OF_RATE') {
    const pct = config.percentageRate != null ? (config.percentageRate * 100).toFixed(2) : '—';
    const cap = config.capPerPersonNight != null ? ` (≤ ${num(config.capPerPersonNight)} €)` : '';
    return `${pct} %${cap}`;
  }
  return config.ratePerPerson != null ? `${num(config.ratePerPerson)} €` : '—';
};

const surchargeSummary = (config: TouristTaxConfig): string => {
  const dep = config.departmentalSurchargePct ?? 0;
  const reg = config.regionalSurchargePct ?? 0;
  if (dep === 0 && reg === 0) return '—';
  return `${dep > 0 ? `+${dep} %` : ''}${dep > 0 && reg > 0 ? ' ' : ''}${reg > 0 ? `+${reg} %` : ''}`;
};

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Taxe de séjour Baitly : saisie des barèmes de l'organisation (défaut org +
 * overrides par bien) et rapport/export CSV par période (par date de check-out).
 */
export default function TouristTaxSection({ canEdit }: TouristTaxSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // ─── Barèmes ────────────────────────────────────────────────────────────
  const configsQuery = useQuery({
    queryKey: ['touristTax', 'configs'],
    queryFn: () => touristTaxApi.getConfigs(),
    staleTime: 60_000,
  });
  const propertiesQuery = useQuery({
    queryKey: ['touristTax', 'properties'],
    queryFn: () => propertiesApi.getAll(),
    staleTime: 300_000,
  });

  const propertyNames = useMemo(() => {
    const map = new Map<number, string>();
    (propertiesQuery.data ?? []).forEach((p: Property) => map.set(p.id, p.name));
    return map;
  }, [propertiesQuery.data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TouristTaxConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (request: TouristTaxConfigRequest) => touristTaxApi.saveConfig(request),
    onSuccess: () => {
      setDialogOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['touristTax', 'configs'] });
    },
    onError: () => setError(t('touristTax.errors.save', 'Impossible d’enregistrer le barème.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => touristTaxApi.deleteConfig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['touristTax', 'configs'] }),
    onError: () => setError(t('touristTax.errors.delete', 'Impossible de supprimer le barème.')),
  });

  const modeLabel = (config: TouristTaxConfig): string => {
    switch (config.calculationMode) {
      case 'PER_PERSON_PER_NIGHT':
        return t('touristTax.mode.perPersonPerNightShort', 'Fixe / pers. / nuit');
      case 'PERCENTAGE_OF_RATE':
        return t('touristTax.mode.percentageOfRateShort', '% plafonné');
      case 'FLAT_PER_NIGHT':
        return t('touristTax.mode.flatPerNightShort', 'Forfait / nuit');
      default:
        return config.calculationMode;
    }
  };

  // ─── Rapport ────────────────────────────────────────────────────────────
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<TouristTaxReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const validRange = from !== '' && to !== '' && from <= to;

  const loadReport = async () => {
    if (!validRange) return;
    setReportLoading(true);
    setError(null);
    try {
      setReport(await touristTaxApi.getReport(from, to));
    } catch {
      setError(t('touristTax.errors.report', 'Impossible de générer le rapport.'));
    } finally {
      setReportLoading(false);
    }
  };

  const exportCsv = async () => {
    if (!validRange) return;
    setExporting(true);
    setError(null);
    try {
      await touristTaxApi.downloadCsv(from, to);
    } catch {
      setError(t('touristTax.errors.export', 'Impossible d’exporter le CSV.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ pt: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ─── Section barèmes ─────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
          <Gavel size={20} strokeWidth={1.75} />
        </Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('touristTax.baremes.title', 'Barèmes de taxe de séjour')}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {canEdit && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add size={16} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            {t('touristTax.baremes.add', 'Ajouter un barème')}
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'touristTax.baremes.subtitle',
          'Saisis tes barèmes communaux : un barème par défaut pour l’organisation, et des barèmes spécifiques par logement si besoin.'
        )}
      </Typography>

      {configsQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (configsQuery.data ?? []).length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t(
            'touristTax.baremes.empty',
            'Aucun barème configuré : la taxe de séjour n’est calculée pour aucune réservation.'
          )}
        </Alert>
      ) : (
        <Paper variant="outlined" sx={{ mb: 3, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('touristTax.baremes.property', 'Logement')}</TableCell>
                <TableCell>{t('touristTax.baremes.commune', 'Commune')}</TableCell>
                <TableCell>{t('touristTax.baremes.mode', 'Mode')}</TableCell>
                <TableCell>{t('touristTax.baremes.rate', 'Tarif')}</TableCell>
                <TableCell>{t('touristTax.baremes.surcharges', 'Surtaxes')}</TableCell>
                <TableCell>{t('touristTax.baremes.status', 'Statut')}</TableCell>
                {canEdit && <TableCell align="right" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {(configsQuery.data ?? []).map((config) => (
                <TableRow key={config.id} hover>
                  <TableCell>
                    {config.propertyId == null ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={t('touristTax.baremes.orgDefault', 'Défaut organisation')}
                      />
                    ) : (
                      propertyNames.get(config.propertyId) ?? `#${config.propertyId}`
                    )}
                  </TableCell>
                  <TableCell>{config.communeName}</TableCell>
                  <TableCell>{modeLabel(config)}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{rateSummary(config)}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{surchargeSummary(config)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={config.enabled ? 'success' : 'default'}
                      variant="outlined"
                      label={
                        config.enabled
                          ? t('touristTax.baremes.active', 'Actif')
                          : t('touristTax.baremes.inactive', 'Inactif')
                      }
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('common.edit', 'Modifier')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditing(config);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit size={16} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete', 'Supprimer')}>
                        <IconButton
                          size="small"
                          onClick={() => deleteMutation.mutate(config.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Delete size={16} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ─── Section rapport / export ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
          <Receipt size={20} strokeWidth={1.75} />
        </Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('touristTax.report.title', 'Rapport par période')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'touristTax.report.subtitle',
          'Taxe de séjour des réservations confirmées dont le départ tombe dans la période (pour ta déclaration).'
        )}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          type="date"
          label={t('touristTax.report.from', 'Du')}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label={t('touristTax.report.to', 'Au')}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button size="small" variant="contained" onClick={loadReport} disabled={!validRange || reportLoading}>
          {reportLoading ? <CircularProgress size={16} color="inherit" /> : t('touristTax.report.generate', 'Générer')}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Download size={16} strokeWidth={1.75} />}
          onClick={exportCsv}
          disabled={!validRange || exporting}
        >
          {t('touristTax.report.exportCsv', 'Exporter CSV')}
        </Button>
      </Box>

      {report && (
        <>
          {report.missingConfigCount > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t(
                'touristTax.report.missingConfigs',
                'Certaines réservations de la période n’ont aucun barème applicable et ne sont pas comptées :'
              )}{' '}
              {report.missingConfigCount}
            </Alert>
          )}
          {report.lines.length === 0 ? (
            <Alert severity="info">
              {t('touristTax.report.empty', 'Aucune réservation taxable sur la période.')}
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('touristTax.report.property', 'Logement')}</TableCell>
                    <TableCell>{t('touristTax.report.guest', 'Voyageur')}</TableCell>
                    <TableCell>{t('touristTax.report.checkOut', 'Départ')}</TableCell>
                    <TableCell align="right">{t('touristTax.report.nights', 'Nuits')}</TableCell>
                    <TableCell align="right">{t('touristTax.report.persons', 'Pers.')}</TableCell>
                    <TableCell>{t('touristTax.report.commune', 'Commune')}</TableCell>
                    <TableCell align="right">{t('touristTax.report.tax', 'Taxe')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.lines.map((line) => (
                    <TableRow key={line.reservationId} hover>
                      <TableCell>{line.propertyName ?? `#${line.propertyId ?? '—'}`}</TableCell>
                      <TableCell>{line.guestName ?? '—'}</TableCell>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{line.checkOut}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {line.nights}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {line.taxablePersons}
                      </TableCell>
                      <TableCell>{line.communeName}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {num(line.taxAmount)} {line.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" fontWeight={600}>
                        {t('touristTax.report.total', 'Total collecté')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {num(report.totalTax)} EUR
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      <TouristTaxBaremeDialog
        open={dialogOpen}
        config={editing}
        properties={propertiesQuery.data ?? []}
        saving={saveMutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSave={(request) => saveMutation.mutate(request)}
      />
    </Box>
  );
}
