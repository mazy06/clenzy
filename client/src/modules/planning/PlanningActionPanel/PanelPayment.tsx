import { getBaitlyServiceCost } from '../utils/baitlyFinancial';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import StatusChip from '../../../components/StatusChip';
import { Alert, AlertDescription, Button } from '../../../components/ui';
import { Info, TriangleAlert } from '../../../icons/glyphs';
import { Spinner } from '../../../components/ui';
import { Field, FieldLabel, Input } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import {
  Payment,
  CheckCircle,
  Schedule,
  AttachMoney,
  Receipt,
  MoneyOff,
  Gavel,
} from '../../../icons';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { usePanelPayment } from './usePanelPayment';
import PanelPaymentCart from './PanelPaymentCart';
import { STATUS_TONES, toneTokensSx, type ToneTokens } from '../../../components/StatusChip';
import { Money } from '../../../components/Money';

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error: string | null };

/** Statuts paiement → tons sémantiques partagés (REFUNDED = info ici, distinct de PanelFinancial). */
const STATUS_TOKENS: Record<string, ToneTokens> = {
  PAID: STATUS_TONES.ok,
  PENDING: STATUS_TONES.warn,
  AWAITING_PAYMENT: STATUS_TONES.warn,
  PROCESSING: STATUS_TONES.info,
  FAILED: STATUS_TONES.err,
  REFUNDED: STATUS_TONES.info,
  CANCELLED: STATUS_TONES.neutral,
  COMPLETED: STATUS_TONES.ok,
  SCHEDULED: STATUS_TONES.info,
  IN_PROGRESS: STATUS_TONES.info,
};

const NEUTRAL_TOKENS = STATUS_TONES.neutral;

/** Chip statut pilule — même pattern que PanelReservationInfo (texte couleur + fond soft). */

/** Report en classes de l'ancien `OVERLINE_SX` (variante body1 par defaut de Typography). */
const OVERLINE_CLASS =
  'cn-text-body1 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)]';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PanelPaymentProps {
  event: PlanningEvent;
  interventions?: PlanningIntervention[];
  onCreatePaymentSession?: (interventionIds: number[], total: number) => Promise<{ url: string; sessionId: string }>;
  onValidateIntervention?: (interventionId: number, estimatedCost: number) => Promise<ActionResult>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PanelPayment: React.FC<PanelPaymentProps> = ({
  event,
  interventions,
  onCreatePaymentSession,
  onValidateIntervention,
}) => {
  const { t } = useTranslation();
  // Les dates de l'historique suivent le calendrier de la langue.
  const fmt = useDateFormat();
  const { user } = useAuth();
  const intervention = event.intervention;

  const canValidate = user?.roles?.some((r: string) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) || user?.orgRole === 'ADMIN';

  // Validate dialog state
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [validateCost, setValidateCost] = useState('');
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);

  // Payment hook
  const payment = usePanelPayment(
    event.propertyId,
    interventions,
    onCreatePaymentSession,
  );

  const handleValidate = useCallback(async () => {
    if (!intervention || !onValidateIntervention) return;
    const cost = parseFloat(validateCost);
    if (isNaN(cost) || cost <= 0) {
      setValidateError(t('payments.enterValidCost'));
      return;
    }
    setValidating(true);
    setValidateError(null);
    const result = await onValidateIntervention(intervention.id, cost);
    if (!result.success) setValidateError(result.error);
    else setValidateDialogOpen(false);
    setValidating(false);
  }, [intervention, validateCost, onValidateIntervention]);

  if (!intervention) {
    return (
      <Alert variant="info" className="text-[0.75rem]">
        <Info />
        <AlertDescription>{t('planning.panel.intervention.noData')}</AlertDescription>
      </Alert>
    );
  }

  const estimatedCost = getBaitlyServiceCost(intervention);

  return (
    <div>
      {/* Payment status */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="inline-flex text-[var(--brand-ink)]"><Payment size={18} strokeWidth={1.75} /></span>
        <p className={OVERLINE_CLASS}>{t('planning.panel.payment.status', 'Statut paiement')}</p>
        {(() => { const tone = STATUS_TOKENS[(intervention.paymentStatus || intervention.status)?.toUpperCase()] || NEUTRAL_TOKENS; return (
        <StatusChip pill tokens={{ color: tone.color, bg: tone.bg }} label={intervention.paymentStatus || intervention.status} className="ms-auto" />
        ); })()}
      </div>

      {/* Cost details */}
      <div className="p-2 border border-[var(--bui-border)] rounded-[10px] mb-3">
        <div className="flex justify-between items-center mb-0.5">
          <div className="flex items-center gap-0.5">
            <span className="inline-flex text-[var(--muted)]"><Schedule size={14} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)]">{t('planning.panel.payment.duration', 'Durée estimée')}</p>
          </div>
          <p className="cn-text-body1 text-[0.6875rem] font-semibold text-[var(--ink)] tabular-nums">
            {intervention.estimatedDurationHours
              ? t('planning.panel.payment.hours', { count: intervention.estimatedDurationHours })
              : t('planning.panel.payment.hoursUnknown', '— h')}
          </p>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-0.5">
            <span className="inline-flex text-[var(--muted)]"><AttachMoney size={14} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)]">{t('planning.panel.payment.cost', 'Coût estimé')}</p>
          </div>
          <p className="cn-text-body1 text-[0.9375rem] font-semibold text-[var(--ink)] font-[family-name:var(--font-display)] tabular-nums">
            <Money value={estimatedCost} from="EUR" />
          </p>
        </div>
      </div>

      {/* Pay button for AWAITING_PAYMENT */}
      {intervention.status === 'awaiting_payment' && (
        <>
          <PanelPaymentCart payment={payment} />
          <Separator className="my-3" />
        </>
      )}

      {/* Manager validation */}
      {canValidate && intervention.status === 'awaiting_validation' && (
        <>
          <div className="flex items-center gap-0.5 mb-1.5">
            <span className="inline-flex text-[var(--warn)]"><Gavel size={16} strokeWidth={1.75} /></span>
            <p className={OVERLINE_CLASS}>
              {t('planning.panel.payment.managerReview', 'Validation manager')}
            </p>
          </div>
          <Alert variant="warning" className="text-[0.6875rem] mb-1.5">
            <TriangleAlert />
            <AlertDescription>{t('planning.panel.payment.awaitingReview')}</AlertDescription>
          </Alert>
          {/* `color="warning"` n'a pas de variante dediee : outline teinte --warn. */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mb-3 text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)] shrink"
            onClick={() => {
              setValidateCost(estimatedCost.toFixed(2));
              setValidateDialogOpen(true);
            }}
          >
            <CheckCircle size={14} strokeWidth={1.75} />
            {t('planning.panel.payment.validate', "Valider l'intervention")}
          </Button>
          <Separator className="my-3" />
        </>
      )}

      {/* Payment history */}
      <div className="flex items-center gap-0.5 mb-1.5">
        <span className="inline-flex text-[var(--muted)]"><Receipt size={16} strokeWidth={1.75} /></span>
        <p className={OVERLINE_CLASS}>
          {t('planning.panel.payment.history', 'Historique paiements')}
        </p>
      </div>

      {payment.loadingHistory ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-5" />
        </div>
      ) : payment.paymentHistory.length === 0 ? (
        <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] italic">
          {t('planning.panel.payment.noHistory', 'Aucun paiement enregistré')}
        </p>
      ) : (
        <div className="overflow-x-auto mb-1.5">
          {/* p-[3px] : le panneau lateral est etroit, l'ancien sx compressait
              deja les cellules bien en deca du gabarit du primitif. */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="p-[3px]">{t('planning.panel.payment.date', 'Date')}</TableHead>
                <TableHead className="p-[3px]">{t('planning.panel.payment.amount', 'Montant')}</TableHead>
                <TableHead className="p-[3px]">{t('planning.panel.payment.statusCol', 'Statut')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payment.paymentHistory.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="p-[3px] tabular-nums">
                    {fmt.formatShortDate(new Date(record.transactionDate))}
                  </TableCell>
                  <TableCell className="p-[3px] font-semibold tabular-nums">
                    <Money value={record.amount} from="EUR" />
                  </TableCell>
                  <TableCell className="p-[3px]">
                    {(() => { const tone = STATUS_TOKENS[record.status] || NEUTRAL_TOKENS; return (
                    <StatusChip pill tokens={{ color: tone.color, bg: tone.bg }} label={record.status} className="h-[18px] text-[0.625rem]" />
                    ); })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Validate dialog */}
      <Dialog open={validateDialogOpen} onOpenChange={(next) => { if (!next) setValidateDialogOpen(false); }}>
        <DialogContent aria-describedby={undefined} className="max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('planning.panel.payment.validate', "Valider l'intervention")}</DialogTitle>
          </DialogHeader>
          <div>
            <p className="cn-text-body1 text-[0.75rem] mb-3">
              {t('planning.panel.payment.interventionLine', { title: intervention.title })}
            </p>
            <Field>
              <FieldLabel htmlFor="validate-final-cost">{t('planning.panel.payment.finalCost', 'Coût final estimé (€)')}</FieldLabel>
              <Input
                id="validate-final-cost"
                className="w-full tabular-nums"
                type="number"
                value={validateCost}
                onChange={(e) => setValidateCost(e.target.value)}
                min={0}
                step={0.01}
              />
            </Field>
            {validateError && <Alert variant="destructive" className="text-[0.6875rem] mt-1.5">
              <TriangleAlert />
              <AlertDescription>{validateError}</AlertDescription>
            </Alert>}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setValidateDialogOpen(false)}>{t('planning.panel.payment.cancel', 'Annuler')}</Button>
            <Button size="sm" onClick={handleValidate} disabled={validating}>
              {validating && <Spinner className="size-3.5" />}
              {t('planning.panel.payment.confirm', 'Valider')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PanelPayment;
