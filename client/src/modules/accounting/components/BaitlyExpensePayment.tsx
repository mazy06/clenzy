import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { providerExpensesApi, type ExpenseBeneficiary, type ExpenseTransferConfirmation, type ProviderExpense } from '../../../services/api/providerExpensesApi';
import { getErrorMessage } from '../../../utils/getErrorMessage';

/** Le bénéficiaire et le montant sont ceux de la dépense sélectionnée, jamais ceux de l'opérateur. */
export default function BaitlyExpensePayment({ expense }: { expense: ProviderExpense }) {
  const { user, hasRole } = useAuth();
  if (!user || !(hasRole('SUPER_ADMIN') || hasRole('SUPER_MANAGER'))) return null;
  return <ExpensePayment key={`${user.id}:${user.organizationId}:${expense.id}`} expense={expense} scope={`${user.id}:${user.organizationId}`} />;
}

function ExpensePayment({ expense, scope }: { expense: ProviderExpense; scope: string }) {
  const { t, currentLanguage } = useTranslation();
  const queries = useQueryClient();
  const [confirmation, setConfirmation] = useState<ExpenseBeneficiary | null>(null);
  const [companyConfirmation, setCompanyConfirmation] = useState<ExpenseBeneficiary | null>(null);
  const sending = useRef(false);
  const key = ['expense-transfer', scope, expense.id, expense.status];
  const preview = useQuery({ queryKey: key, queryFn: () => providerExpensesApi.previewTransfer(expense.id),
    enabled: expense.status === 'INCLUDED', staleTime: 0 });
  const pay = useMutation({ mutationFn: (recipient: ExpenseTransferConfirmation) => providerExpensesApi.transfer(expense.id, recipient), retry: false,
    onSuccess: () => setConfirmation(null),
    onSettled: async () => {
      await Promise.all(['provider-expenses', 'expense-transfer', 'payout-transfers'].map(root => queries.invalidateQueries({ queryKey: [root] })));
      sending.current = false;
    },
  });
  const company = useMutation({ mutationFn: (id: number) => providerExpensesApi.selectCompany(expense.id, id), retry: false,
    onSuccess: () => { setCompanyConfirmation(null); setConfirmation(null); },
    onSettled: async () => {
      await queries.invalidateQueries({ queryKey: ['expense-transfer'] });
      sending.current = false;
    },
  });
  const amount = new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: expense.currency }).format(expense.amountTtc);
  const paid = expense.status === 'PAID' || pay.data?.state === 'TRANSFERRED';
  const recipient = preview.data?.beneficiary;
  const ready = !!recipient && !preview.isFetching && !preview.isError && !company.isPending;
  const eligible = preview.data?.eligible === true && ready;
  const unchanged = !!confirmation && confirmation.userId === recipient?.userId && confirmation.organizationId === recipient?.organizationId;
  if (expense.status === 'CANCELLED') return null;
  return <section className="border-t border-border pt-4 text-sm" aria-label={t('expenseTransfer.title')}>
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold">{t('expenseTransfer.title')}</h3>
      {!paid && !confirmation && !companyConfirmation && eligible && <Tooltip><TooltipTrigger asChild>
        <Button size="icon-sm" variant="outline" className="cursor-pointer" aria-label={t('expenseTransfer.prepare')}
          onClick={() => { pay.reset(); setConfirmation(recipient!); }}><Send size={16} aria-hidden="true" /></Button>
      </TooltipTrigger><TooltipContent>{t('expenseTransfer.prepare')}</TooltipContent></Tooltip>}
    </div>
    {paid ? <p role="status" className="mt-2 text-success-ink">{t('expenseTransfer.sent')} <bdi>{pay.data?.externalReference || expense.paymentReference}</bdi></p>
      : expense.status !== 'INCLUDED' ? <p className="mt-2 text-muted-foreground">{t('expenseTransfer.notRetained')}</p>
      : preview.isPending ? <Skeleton className="mt-2 h-8 w-full" />
      : preview.isError ? <div className="mt-2"><p role="alert">{t('expenseTransfer.unavailable')}</p><Button variant="ghost" onClick={() => { void preview.refetch(); }}>{t('common.retry', 'Réessayer')}</Button></div>
      : <p className="mt-2 text-muted-foreground">{preview.data?.reason || t('expenseTransfer.retained')}</p>}
    {!paid && expense.status === 'INCLUDED' && ready && <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground">{t('expenseTransfer.beneficiary')} <span className="font-medium text-foreground">{recipient.name}</span></p>
      {recipient.companyId && !recipient.locked && !confirmation && !companyConfirmation && <Button variant="outline" className="cursor-pointer"
        onClick={() => { company.reset(); setCompanyConfirmation(recipient); }}>{t('expenseTransfer.chooseCompany')}</Button>}
    </div>}
    {companyConfirmation && !paid && <div className="mt-3 rounded-lg bg-primary-soft p-3">
      <p>{t('expenseTransfer.companyConfirm', { company: companyConfirmation.companyName })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="baitly-hitl-primary cursor-pointer" disabled={!ready || pay.isPending || company.isPending || recipient?.locked || recipient?.companyId !== companyConfirmation.companyId}
          onClick={() => { if (sending.current || !companyConfirmation.companyId) return; sending.current = true; company.mutate(companyConfirmation.companyId); }}>{t('expenseTransfer.selectCompany')}</Button>
        <Button variant="ghost" disabled={company.isPending} onClick={() => setCompanyConfirmation(null)}>{t('common.cancel', 'Annuler')}</Button>
      </div>
    </div>}
    {confirmation && !paid && <div className="mt-3 rounded-lg bg-primary-soft p-3">
      <p className="tabular-nums">{t(confirmation.organizationId ? 'expenseTransfer.confirmCompany' : 'expenseTransfer.confirm', { amount, provider: confirmation.name })}</p>
      {!unchanged && <p role="alert" className="mt-2 text-destructive-ink">{t('expenseTransfer.changed')}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="baitly-hitl-primary cursor-pointer" disabled={pay.isPending || !eligible || !unchanged}
          onClick={() => { if (sending.current) return; sending.current = true; pay.mutate({ userId: confirmation.userId, organizationId: confirmation.organizationId }); }}>
          {pay.isPending ? t('expenseTransfer.sending') : t('expenseTransfer.pay', { amount })}
        </Button>
        <Button variant="ghost" disabled={pay.isPending} onClick={() => setConfirmation(null)}>{t('common.cancel', 'Annuler')}</Button>
      </div>
    </div>}
    {pay.isError && <p role="alert" className="mt-2 text-destructive-ink">{getErrorMessage(pay.error, t('expenseTransfer.unavailable'))}</p>}
    {company.isError && <p role="alert" className="mt-2 text-destructive-ink">{getErrorMessage(company.error, t('expenseTransfer.unavailable'))}</p>}
    {(paid || expense.status === 'INCLUDED') && <Link className="mt-3 inline-flex text-primary underline underline-offset-4" to="/billing?tab=payout-tracking">{t('expenseTransfer.tracking')}</Link>}
  </section>;
}
