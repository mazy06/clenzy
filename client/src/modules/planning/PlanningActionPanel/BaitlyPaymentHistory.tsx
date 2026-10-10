import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import { Alert as UiAlert, AlertDescription, Dialog, DialogContent, DialogHeader, DialogTitle,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Payment, Info } from '../../../icons';
import { Money } from '../../../components/Money';
import { DomainStatusChip } from './BaitlyFinancialPrimitives';

export interface BaitlyHistoryPayment {
  id: number;
  amount: number;
  method: string;
  date: string;
  status: 'PAID' | 'PENDING' | 'REFUNDED';
  reference?: string;
}

/** Historique de lecture séparé des formulaires et des mutations financières. */
export function BaitlyPaymentHistory({ open, onOpenChange, payments, paymentMethods,
  fmtCurrency, totalPaid, totalRefunded, balanceDue }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: BaitlyHistoryPayment[];
  paymentMethods: { value: string; label: string }[];
  fmtCurrency: (amount: number) => React.ReactNode;
  totalPaid: number;
  totalRefunded: number;
  balanceDue: number;
}) {
  const { t } = useTranslation();
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <span className="inline-flex text-[var(--brand-ink)]"><Payment size={20} strokeWidth={1.75} /></span>
              <span>{t('planning.panel.fin.historyTitle', 'Historique des paiements')}</span>
            </DialogTitle>
          </DialogHeader>
          {payments.length === 0 ? (
            <UiAlert variant="info" className="text-[0.8125rem]">
              <Info />
              <AlertDescription>{t('planning.panel.fin.noPayments')}</AlertDescription>
            </UiAlert>
          ) : (
            // La modale du kit est une grille : sans ce conteneur, un tableau
            // large ferait deborder la page au lieu de defiler chez lui.
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('planning.panel.fin.colDate', 'Date')}</TableHead>
                  <TableHead>{t('planning.panel.fin.colMethod', 'Méthode')}</TableHead>
                  <TableHead>{t('planning.panel.fin.colReference', 'Référence')}</TableHead>
                  <TableHead className="text-end">{t('planning.panel.fin.colAmount', 'Montant')}</TableHead>
                  <TableHead>{t('planning.panel.fin.colStatus', 'Statut')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums">{p.date}</TableCell>
                    <TableCell>{paymentMethods.find((m) => m.value === p.method)?.label || p.method}</TableCell>
                    <TableCell className="text-[var(--bui-muted-foreground)]">{p.reference || '-'}</TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {p.status === 'REFUNDED' ? '-' : ''}{fmtCurrency(p.amount)}
                    </TableCell>
                    <TableCell><DomainStatusChip status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
          {payments.length > 0 && (
            <div className="mt-2 pt-1.5 border-t border-[var(--bui-border)]">
              <div className="flex justify-between mb-0.5">
                <span className="cn-text-caption font-semibold text-[0.75rem]">{t('planning.panel.fin.totalPaid', 'Total payé')}</span>
                <span className="cn-text-caption font-bold text-[0.75rem] text-[var(--bui-success-ink)]">{fmtCurrency(totalPaid)}</span>
              </div>
              {totalRefunded > 0 && (
                <div className="flex justify-between mb-0.5">
                  <span className="cn-text-caption font-semibold text-[0.75rem]">{t('planning.panel.fin.totalRefunded', 'Total remboursé')}</span>
                  <span className="cn-text-caption font-bold text-[0.75rem] text-[var(--bui-destructive-ink)]">-{fmtCurrency(totalRefunded)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="cn-text-caption font-semibold text-[0.75rem]">{t('planning.panel.fin.balanceDue', 'Reste à payer')}</span>
                <span className={cn('cn-text-caption font-bold text-[0.75rem] tabular-nums', balanceDue > 0 ? 'text-[var(--bui-warning-ink)]' : 'text-[var(--bui-success-ink)]')}>
                  <Money value={Math.max(0, balanceDue)} from="EUR" />
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

  );
}
