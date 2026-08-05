import React, { useState, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Badge as BuiBadge } from '../../components/ui';
import { Button, Spinner, Field, FieldLabel, Textarea } from '../../components/ui';
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  NativeSelect,
  NativeSelectOption,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import {
  History,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '../../icons';
import {
  useNoiseAlerts,
  useUnacknowledgedAlertCount,
  useAcknowledgeAlert,
  type NoiseAlertDto,
} from '../../hooks/useNoiseAlerts';
import PagePagination from '../../components/PagePagination';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function SeverityChip({ severity }: { severity: string }) {
  const isWarning = severity === 'WARNING';
  return (
    <StatusChip
      icon={isWarning ? <Warning size={12} strokeWidth={1.75} /> : <ErrorIcon size={12} strokeWidth={1.75} />}
      label={isWarning ? 'Avertissement' : 'Critique'}
      tone={isWarning ? 'warn' : 'err'}
    />
  );
}

function SourceChip({ source }: { source: string }) {
  const label = source === 'WEBHOOK' ? 'Temps reel' : source === 'SCHEDULER' ? 'Poll' : source;
  return (
    <BuiBadge variant="outline" className="h-[20px] text-[0.625rem] px-0.5">{label}</BuiBadge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NoiseAlertHistoryProps {
  /** Filtre les alertes sur un logement (vue détail d'un appareil). */
  propertyId?: number;
}

const NoiseAlertHistory: React.FC<NoiseAlertHistoryProps> = ({ propertyId }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [severityFilter, setSeverityFilter] = useState<string>('');

  // Acknowledge dialog
  const [ackDialog, setAckDialog] = useState<{ open: boolean; alertId: number | null }>({
    open: false,
    alertId: null,
  });
  const [ackNotes, setAckNotes] = useState('');

  const alertsQuery = useNoiseAlerts({
    propertyId,
    severity: severityFilter || undefined,
    page,
    size: rowsPerPage,
  });
  const countQuery = useUnacknowledgedAlertCount();
  const ackMutation = useAcknowledgeAlert();

  const handleAcknowledge = useCallback(() => {
    if (ackDialog.alertId == null) return;
    ackMutation.mutate(
      { id: ackDialog.alertId, notes: ackNotes || undefined },
      {
        onSuccess: () => {
          setAckDialog({ open: false, alertId: null });
          setAckNotes('');
        },
      },
    );
  }, [ackDialog.alertId, ackNotes, ackMutation]);

  const alerts = alertsQuery.data?.content ?? [];
  const totalElements = alertsQuery.data?.totalElements ?? 0;
  const unacknowledgedCount = countQuery.data ?? 0;

  return (
    <Card>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {/* Pastille de compteur posee a la main : le kit n'a pas d'equivalent
                au Badge « overlay » de MUI (badgeContent sur un enfant). */}
            <span className="relative inline-flex text-primary">
              <History size={18} strokeWidth={1.75} />
              {unacknowledgedCount > 0 && (
                <BuiBadge
                  variant="destructive"
                  className="absolute -top-1.5 -end-2 h-[16px] min-w-[16px] px-1 text-[0.625rem] tabular-nums"
                >
                  {unacknowledgedCount > 99 ? '99+' : unacknowledgedCount}
                </BuiBadge>
              )}
            </span>
            <h6 className="text-sm font-semibold text-foreground">
              Historique des alertes
            </h6>
          </div>

          <NativeSelect
            size="sm"
            aria-label="Filtrer par severite"
            className="min-w-[140px] [&>select]:text-[0.75rem]"
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
          >
            <NativeSelectOption value="">Toutes severites</NativeSelectOption>
            <NativeSelectOption value="WARNING">Avertissement</NativeSelectOption>
            <NativeSelectOption value="CRITICAL">Critique</NativeSelectOption>
          </NativeSelect>
        </div>

        {alertsQuery.isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-6" />
          </div>
        ) : alerts.length === 0 ? (
          <Empty className="border-none p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>Aucune alerte enregistree</EmptyTitle>
              <EmptyDescription className="text-xs">
                Les depassements de seuil apparaitront ici des qu'un capteur en remontera.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={HEADER_CELL_CLASS}>Date</TableHead>
                    <TableHead className={HEADER_CELL_CLASS}>Propriete</TableHead>
                    <TableHead className={HEADER_CELL_CLASS}>Severite</TableHead>
                    <TableHead className={`${HEADER_CELL_CLASS} text-end`}>Mesure</TableHead>
                    <TableHead className={`${HEADER_CELL_CLASS} text-end`}>Seuil</TableHead>
                    <TableHead className={HEADER_CELL_CLASS}>Creneau</TableHead>
                    <TableHead className={HEADER_CELL_CLASS}>Source</TableHead>
                    <TableHead className={`${HEADER_CELL_CLASS} text-center`}>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert: NoiseAlertDto) => (
                    <TableRow key={alert.id}>
                      <TableCell className={CELL_CLASS}>{formatDate(alert.createdAt)}</TableCell>
                      <TableCell className={CELL_CLASS}>{alert.propertyName || `#${alert.propertyId}`}</TableCell>
                      <TableCell className={CELL_CLASS}><SeverityChip severity={alert.severity} /></TableCell>
                      <TableCell className={`${CELL_CLASS} text-end`}>
                        {/* Encre `-ink` : la teinte vive ne passe pas AA en texte (§2.4). */}
                        <p className={cn('text-xs font-semibold tabular-nums', alert.severity === 'CRITICAL' ? 'text-destructive-ink' : 'text-warning-ink')}>
                          {alert.measuredDb.toFixed(0)} dB
                        </p>
                      </TableCell>
                      <TableCell className={`${CELL_CLASS} text-end`}>{alert.thresholdDb} dB</TableCell>
                      <TableCell className={CELL_CLASS}>{alert.timeWindowLabel || '—'}</TableCell>
                      <TableCell className={CELL_CLASS}><SourceChip source={alert.source} /></TableCell>
                      <TableCell className={`${CELL_CLASS} text-center`}>
                        {alert.acknowledged ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex text-success-ink"><CheckCircle size={16} strokeWidth={1.75} /></span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {`Acquittee par ${alert.acknowledgedBy || '?'}${alert.notes ? ` — ${alert.notes}` : ''}`}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          // Le Button du kit est une fonction : il ne transmet pas de ref
                          // (React 18). Le span porte l'ancrage de l'infobulle.
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Acquitter"
                                  className="text-warning"
                                  onClick={() => setAckDialog({ open: true, alertId: alert.id })}
                                >
                                  <CheckCircle size={16} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Acquitter</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PagePagination
              count={totalElements}
              page={page}
              onPageChange={(p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
              onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setPage(0); }}
            />
          </>
        )}

        {/* Acknowledge Dialog */}
        <Dialog
          open={ackDialog.open}
          onOpenChange={(next) => { if (!next) setAckDialog({ open: false, alertId: null }); }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="pe-8 text-[0.95rem]">Acquitter l'alerte</DialogTitle>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="noise-alert-ack-notes">Notes (optionnel)</FieldLabel>
              {/* min-h en `lh` : le primitif pose field-sizing:content, qui neutralise `rows`. */}
              <Textarea
                id="noise-alert-ack-notes"
                className="w-full text-[0.8125rem] min-h-[3lh]"
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAckDialog({ open: false, alertId: null })}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleAcknowledge}
                disabled={ackMutation.isPending}
              >
                {ackMutation.isPending ? 'Acquittement...' : 'Acquitter'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

// ─── Style helpers ───────────────────────────────────────────────────────────

// Ecarts assumes vs le gabarit du kit (qui porte deja 700 / majuscules / filet) :
// cette table est plus dense et son en-tete un cran plus lisible que le defaut.
const HEADER_CELL_CLASS = 'py-[4.5px] text-[0.6875rem] tracking-wide text-muted-foreground';

const CELL_CLASS = 'py-[3px] text-[0.75rem]';

export default NoiseAlertHistory;
