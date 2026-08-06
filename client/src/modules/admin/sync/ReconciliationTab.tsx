import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Button, Field, FieldLabel, Input } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui';
import {
  PlayArrow,
  CompareArrows,
  CheckCircle,
  ErrorOutline,
  WarningAmber,
  Tune,
  AutoFixHigh,
} from '../../../icons';
import { syncAdminApi, ReconciliationRun, ReconciliationStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import StatTile from '../../../components/baitly/StatTile';
import { useSyncAdminHeader } from '../SyncAdminPage';
import PagePagination from '../../../components/PagePagination';

type ReconciliationStatus = 'SUCCESS' | 'FAILED' | 'DIVERGENCE' | 'RUNNING';

// Teinte vive de chaque option : FilterChipRow la passe dans un color-mix évalué
// à l'exécution → valeur CSS `--bui-*`, une utility Tailwind ne serait pas générée.
const STATUS_OPTIONS: { value: ReconciliationStatus; label: string; color: string }[] = [
  { value: 'SUCCESS',    label: 'Success',    color: 'var(--bui-success)' },
  { value: 'FAILED',     label: 'Failed',     color: 'var(--bui-destructive)' },
  { value: 'DIVERGENCE', label: 'Divergence', color: 'var(--bui-warning)' },
  { value: 'RUNNING',    label: 'Running',    color: 'var(--bui-info)' },
];

// Statut de run → ton sémantique. Le couple encre/fond conforme AA est tenu par
// StatusChip (STATUS_TONES) : ici on ne dit que le SENS, pas la couleur.
const STATUS_TONE: Record<string, StatusTone> = {
  SUCCESS: 'ok',
  FAILED: 'err',
  DIVERGENCE: 'warn',
  RUNNING: 'info',
};

const formatDuration = (startedAt: string | null, completedAt: string | null): string => {
  if (!startedAt || !completedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const ReconciliationTab: React.FC = () => {
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | ''>('');
  const [propertyIdFilter, setPropertyIdFilter] = useState('');
  const { setHeaderFilters, setHeaderActions } = useSyncAdminHeader();

  // Trigger dialog
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [triggerPropertyId, setTriggerPropertyId] = useState('');
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const data = await syncAdminApi.getReconciliationStats();
      setStats(data);
    } catch {
      // Stats non-critical
    }
  };

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await syncAdminApi.getReconciliationRuns({
        propertyId: propertyIdFilter ? Number(propertyIdFilter) : undefined,
        status: statusFilter || undefined,
        page,
        size: rowsPerPage,
      });
      setRuns(data.content);
      setTotalElements(data.totalElements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des reconciliations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, propertyIdFilter, page, rowsPerPage]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Register Property ID + Status filters in the page header.
  useEffect(() => {
    setHeaderFilters(
      <div className="flex items-end gap-2 flex-wrap">
        <Field className="w-[150px]">
          <FieldLabel htmlFor="reconciliation-property-filter">Property ID</FieldLabel>
          <Input
            id="reconciliation-property-filter"
            value={propertyIdFilter}
            onChange={(e) => { setPropertyIdFilter(e.target.value); setPage(0); }}
            type="number"
          />
        </Field>
        <FilterChipRow
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as ReconciliationStatus | ''); setPage(0); }}
          allLabel="Tous"
          size="compact"
        />
      </div>,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, propertyIdFilter, statusFilter]);

  // Register Trigger Reconciliation button in the page header actions.
  useEffect(() => {
    setHeaderActions(
      <Button size="sm" onClick={() => setTriggerDialogOpen(true)}>
        <PlayArrow />
        Trigger Reconciliation
      </Button>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (rows: number) => {
    setRowsPerPage(rows);
    setPage(0);
  };

  const handleTrigger = async () => {
    if (!triggerPropertyId) return;
    try {
      setTriggerLoading(true);
      setTriggerMessage(null);
      const result = await syncAdminApi.triggerReconciliation(Number(triggerPropertyId));
      setTriggerMessage(result.message);
      setTriggerDialogOpen(false);
      setTriggerPropertyId('');
      // Refresh after a short delay to let the async reconciliation start
      setTimeout(() => {
        fetchRuns();
        fetchStats();
      }, 2000);
    } catch (err) {
      setTriggerMessage(err instanceof Error ? err.message : 'Erreur lors du declenchement');
    } finally {
      setTriggerLoading(false);
    }
  };

  return (
    <div>
      {/* Stats — StatTile (carte plate hairline, valeur display tabular-nums) */}
      {stats && (
        <div className="grid grid-cols-12 gap-3 mb-[18px]">
          <div className="col-span-6 min-[600px]:col-span-2">
            <StatTile icon={<CompareArrows />} label="Total Runs" value={stats.totalRuns} iconClassName="text-primary" />
          </div>
          <div className="col-span-6 min-[600px]:col-span-2">
            <StatTile icon={<CheckCircle />} label="Success" value={stats.successRuns} iconClassName="text-success" />
          </div>
          <div className="col-span-6 min-[600px]:col-span-2">
            <StatTile icon={<ErrorOutline />} label="Failed" value={stats.failedRuns} iconClassName="text-destructive" />
          </div>
          <div className="col-span-6 min-[600px]:col-span-2">
            <StatTile icon={<WarningAmber />} label="Divergence" value={stats.divergenceRuns} iconClassName="text-warning" />
          </div>
          <div className="col-span-6 min-[600px]:col-span-2">
            <StatTile icon={<Tune />} label="Discrepancies" value={stats.totalDiscrepancies} iconClassName="text-info" />
          </div>
          <div className="col-span-6 min-[600px]:col-span-2">
            <StatTile icon={<AutoFixHigh />} label="Fixes" value={stats.totalFixes} iconClassName="text-success" />
          </div>
        </div>
      )}

      {error && <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}
      {triggerMessage && <Alert variant="info" className="mb-3">
        <Info />
        <AlertDescription>{triggerMessage}</AlertDescription>
      </Alert>}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PMS Days</TableHead>
                  <TableHead>Channel Days</TableHead>
                  <TableHead>Discrepancies</TableHead>
                  <TableHead>Fixed</TableHead>
                  <TableHead>Divergence</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-[18px]">
                      Aucune reconciliation
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="tabular-nums">{run.id}</TableCell>
                      <TableCell>
                        <StatusChip tone="neutral" label={run.channel} />
                      </TableCell>
                      <TableCell className="tabular-nums">{run.propertyId}</TableCell>
                      <TableCell>
                        <StatusChip
                          tone={STATUS_TONE[run.status] ?? 'neutral'}
                          label={run.status}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">{run.pmsDaysChecked}</TableCell>
                      <TableCell className="tabular-nums">{run.channelDaysChecked}</TableCell>
                      <TableCell>
                        {/* Encre `-ink` : la teinte vive plafonne à ~2,2:1 sur une carte claire. */}
                        <p className={cn('text-xs tabular-nums', run.discrepanciesFound > 0 ? 'text-warning-ink font-semibold' : 'text-foreground font-normal')}>
                          {run.discrepanciesFound}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className={cn('text-xs tabular-nums', run.discrepanciesFixed > 0 ? 'text-success-ink' : 'text-foreground')}>
                          {run.discrepanciesFixed}
                        </p>
                      </TableCell>
                      <TableCell>
                        {run.divergencePct ? `${run.divergencePct}%` : '0%'}
                      </TableCell>
                      <TableCell>{formatDuration(run.startedAt, run.completedAt)}</TableCell>
                      <TableCell>
                        {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={run.errorMessage || undefined}>
                          {run.errorMessage || '—'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PagePagination
            count={totalElements}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}

      {/* Trigger Dialog */}
      <Dialog open={triggerDialogOpen} onOpenChange={(next) => { if (!next) setTriggerDialogOpen(false); }}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger Reconciliation</DialogTitle>
          <DialogDescription>
            Declencher une reconciliation manuelle pour une propriete.
            Tous les mappings actifs de cette propriete seront reconcilies.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Field className="mt-1.5">
            <FieldLabel htmlFor="reconciliation-trigger-property">Property ID</FieldLabel>
            <Input
              id="reconciliation-trigger-property"
              autoFocus
              type="number"
              value={triggerPropertyId}
              onChange={(e) => setTriggerPropertyId(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTriggerDialogOpen(false)}>Annuler</Button>
          <Button
            onClick={handleTrigger}
            disabled={!triggerPropertyId || triggerLoading}
          >
            {triggerLoading ? <Spinner className="size-4" /> : <PlayArrow />}
            Lancer
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReconciliationTab;
