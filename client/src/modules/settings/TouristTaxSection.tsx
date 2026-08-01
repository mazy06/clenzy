import React, { useMemo, useState } from 'react';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { IconButton, TextField, Tooltip } from '@mui/material';
import { Card } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
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
    <div className="pt-3">
      {error && (
        <BuiAlert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* ─── Section barèmes ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="inline-flex text-primary">
          <Gavel size={20} strokeWidth={1.75} />
        </span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('touristTax.baremes.title', 'Barèmes de taxe de séjour')}
        </h6>
        <div className="flex-1" />
        {canEdit && (
          <BuiButton
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Add strokeWidth={1.75} />
            {t('touristTax.baremes.add', 'Ajouter un barème')}
          </BuiButton>
        )}
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t(
          'touristTax.baremes.subtitle',
          'Saisis tes barèmes communaux : un barème par défaut pour l’organisation, et des barèmes spécifiques par logement si besoin.'
        )}
      </p>

      {configsQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-6" />
        </div>
      ) : (configsQuery.data ?? []).length === 0 ? (
        <BuiAlert variant="info" className="mb-4">
          <Info />
          <AlertDescription>{t(
            'touristTax.baremes.empty',
            'Aucun barème configuré : la taxe de séjour n’est calculée pour aucune réservation.'
          )}</AlertDescription>
        </BuiAlert>
      ) : (
        <Card className="gap-0 py-0 mb-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('touristTax.baremes.property', 'Logement')}</TableHead>
                <TableHead>{t('touristTax.baremes.commune', 'Commune')}</TableHead>
                <TableHead>{t('touristTax.baremes.mode', 'Mode')}</TableHead>
                <TableHead>{t('touristTax.baremes.rate', 'Tarif')}</TableHead>
                <TableHead>{t('touristTax.baremes.surcharges', 'Surtaxes')}</TableHead>
                <TableHead>{t('touristTax.baremes.status', 'Statut')}</TableHead>
                {canEdit && <TableHead className="text-end" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(configsQuery.data ?? []).map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    {config.propertyId == null ? (
                      <Badge variant="default">{t('touristTax.baremes.orgDefault', 'Défaut organisation')}</Badge>
                    ) : (
                      propertyNames.get(config.propertyId) ?? `#${config.propertyId}`
                    )}
                  </TableCell>
                  <TableCell>{config.communeName}</TableCell>
                  <TableCell>{modeLabel(config)}</TableCell>
                  <TableCell className="tabular-nums">{rateSummary(config)}</TableCell>
                  <TableCell className="tabular-nums">{surchargeSummary(config)}</TableCell>
                  <TableCell>
                    <StatusChip
                      tone={config.enabled ? 'ok' : 'neutral'}
                      label={
                        config.enabled
                          ? t('touristTax.baremes.active', 'Actif')
                          : t('touristTax.baremes.inactive', 'Inactif')
                      }
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-end whitespace-nowrap">
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
        </Card>
      )}

      {/* ─── Section rapport / export ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="inline-flex text-primary">
          <Receipt size={20} strokeWidth={1.75} />
        </span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('touristTax.report.title', 'Rapport par période')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t(
          'touristTax.report.subtitle',
          'Taxe de séjour des réservations confirmées dont le départ tombe dans la période (pour ta déclaration).'
        )}
      </p>

      <div className="flex gap-2 items-center flex-wrap mb-3">
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
        <BuiButton size="sm" onClick={loadReport} disabled={!validRange || reportLoading}>
          {reportLoading ? <Spinner className="size-4" /> : t('touristTax.report.generate', 'Générer')}
        </BuiButton>
        <BuiButton
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={!validRange || exporting}
        >
          <Download strokeWidth={1.75} />
          {t('touristTax.report.exportCsv', 'Exporter CSV')}
        </BuiButton>
      </div>

      {report && (
        <>
          {report.missingConfigCount > 0 && (
            <BuiAlert variant="warning" className="mb-3">
              <TriangleAlert />
              <AlertDescription>{t(
                'touristTax.report.missingConfigs',
                'Certaines réservations de la période n’ont aucun barème applicable et ne sont pas comptées :'
              )}{' '}{report.missingConfigCount}</AlertDescription>
            </BuiAlert>
          )}
          {report.lines.length === 0 ? (
            <BuiAlert variant="info">
              <Info />
              <AlertDescription>{t('touristTax.report.empty', 'Aucune réservation taxable sur la période.')}</AlertDescription>
            </BuiAlert>
          ) : (
            <Card className="gap-0 py-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('touristTax.report.property', 'Logement')}</TableHead>
                    <TableHead>{t('touristTax.report.guest', 'Voyageur')}</TableHead>
                    <TableHead>{t('touristTax.report.checkOut', 'Départ')}</TableHead>
                    <TableHead className="text-end">{t('touristTax.report.nights', 'Nuits')}</TableHead>
                    <TableHead className="text-end">{t('touristTax.report.persons', 'Pers.')}</TableHead>
                    <TableHead>{t('touristTax.report.commune', 'Commune')}</TableHead>
                    <TableHead className="text-end">{t('touristTax.report.tax', 'Taxe')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.lines.map((line) => (
                    <TableRow key={line.reservationId}>
                      <TableCell>{line.propertyName ?? `#${line.propertyId ?? '—'}`}</TableCell>
                      <TableCell>{line.guestName ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{line.checkOut}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {line.nights}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {line.taxablePersons}
                      </TableCell>
                      <TableCell>{line.communeName}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {num(line.taxAmount)} {line.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={6}>
                      <p className="cn-text-body2 font-semibold">
                        {t('touristTax.report.total', 'Total collecté')}
                      </p>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <p className="cn-text-body2 font-semibold">
                        {num(report.totalTax)} EUR
                      </p>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
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
    </div>
  );
}
