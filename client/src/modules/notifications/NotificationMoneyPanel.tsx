import React from 'react';
import { Badge, Skeleton } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { Money } from '../../components/baitly/Money';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { accountingApi, type OwnerPayout } from '../../services/api/accountingApi';
import { invoicesApi, type Invoice } from '../../services/api/invoicesApi';
import { Caption, Figure, ObservationBand } from './NotificationFieldParts';
import { deepLinkId, factId, formatFactDate } from './notificationMeta';
import type { Notification } from '../../services/api';

/**
 * Les fiches d'ARGENT : un reversement, une facture, un lot a approuver.
 *
 * <p>« Le reversement #4 (4960.00 EUR) a ete approuve. » — un montant brut dans
 * une phrase, sans dire de quoi il est fait ni sur quelle periode. Or un
 * reversement se relit precisement pour ca : ce que le proprietaire a encaisse,
 * ce que la gestion a preleve, ce qui reste. La ventilation existe en base
 * depuis toujours ; elle ne sortait nulle part.</p>
 *
 * <p>Meme chose pour une facture impayee : le numero et l'anciennete du retard
 * disent qu'il faut relancer, pas COMBIEN ni QUI. Ici le total, l'echeance, le
 * client et le detail des lignes sont sous les yeux au moment de decider.</p>
 */

/** Cles portant un REVERSEMENT identifie. */
const PAYOUT_KEYS = new Set([
  'PAYOUT_APPROVED', 'PAYOUT_EXECUTED', 'PAYOUT_FAILED',
  'PAYOUT_PENDING_APPROVAL', 'PAYOUT_CONFIG_SUBMITTED',
]);
/** Cles portant une FACTURE. */
const INVOICE_KEYS = new Set(['PAYMENT_DEFERRED_OVERDUE', 'PAYMENT_DEFERRED_REMINDER']);
/** Cle portant un LOT de reversements, sans identifiant : c'est la file qui compte. */
const BATCH_KEY = 'PAYOUT_BATCH_GENERATED';

export type MoneySubject =
  | { kind: 'payout'; id: number }
  | { kind: 'invoice'; id: number }
  | { kind: 'batch' };

/** Objet d'argent designe par une notification, ou `null`. */
export function moneySubjectOf(notification: Notification): MoneySubject | null {
  const key = notification.notificationKey ?? '';
  if (key === BATCH_KEY) return { kind: 'batch' };
  if (PAYOUT_KEYS.has(key)) {
    const id = factId(notification, 'payoutId') ?? deepLinkId(notification, { param: 'highlight' });
    return id === null ? null : { kind: 'payout', id };
  }
  if (INVOICE_KEYS.has(key)) {
    const id = factId(notification, 'invoiceId') ?? deepLinkId(notification, { param: 'highlight' });
    return id === null ? null : { kind: 'invoice', id };
  }
  return null;
}

export type MoneyDossier =
  | { kind: 'payout'; payout: OwnerPayout }
  | { kind: 'invoice'; invoice: Invoice }
  | { kind: 'batch'; pending: OwnerPayout[] };

/**
 * Charge l'objet designe.
 *
 * <p>Le LOT n'a pas d'identifiant — il n'existe que comme evenement. Ce qui
 * reste a en faire, en revanche, existe : les reversements encore EN ATTENTE
 * d'approbation. C'est un etat lu MAINTENANT, pas le lot fige, et l'intitule le
 * dit — sans quoi une liste deja traitee se relirait comme un rappel.</p>
 */
export function useNotificationMoney(subject: MoneySubject | null) {
  const [dossier, setDossier] = React.useState<MoneyDossier | null>(null);
  const [loading, setLoading] = React.useState(subject !== null);

  const kind = subject?.kind ?? null;
  const id = subject && 'id' in subject ? subject.id : null;

  React.useEffect(() => {
    if (kind === null) {
      setDossier(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    const load: Promise<MoneyDossier> =
      kind === 'batch'
        ? accountingApi.getPayouts(undefined, 'PENDING').then((pending) => ({ kind: 'batch', pending }))
        : kind === 'invoice'
          ? invoicesApi.get(id!).then((invoice) => ({ kind: 'invoice', invoice }))
          : accountingApi.getPayout(id!).then((payout) => ({ kind: 'payout', payout }));

    load
      .then((loaded) => { if (active) setDossier(loaded); })
      .catch(() => { if (active) setDossier(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, id]);

  return { dossier, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationMoneySkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-7 w-28" />
      </div>
      <Skeleton className="h-[104px] w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}

/** Une ligne de ventilation : intitule a gauche, montant a droite. */
function Line({
  label,
  value,
  sign,
  strong,
}: {
  label: React.ReactNode;
  value: number;
  /** `minus` prefixe d'un signe et met en retrait — c'est un prelevement. */
  sign?: 'minus';
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className={cn('min-w-0 truncate', strong ? 'font-medium text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span className={cn('shrink-0 tabular-nums', strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
        {sign === 'minus' && '− '}
        <Money value={Math.abs(value)} from="EUR" />
      </span>
    </div>
  );
}

/** Teinte d'un statut de reversement. */
const PAYOUT_BADGE: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  PAID: 'success',
  APPROVED: 'info',
  PENDING: 'warning',
  FAILED: 'destructive',
  CANCELLED: 'secondary',
};

/** Teinte d'un statut de facture. */
const INVOICE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  PAID: 'success',
  ISSUED: 'info',
  DRAFT: 'secondary',
  OVERDUE: 'destructive',
  CANCELLED: 'secondary',
  VOID: 'secondary',
};

/** Jours entiers de retard sur une echeance, ou `null`. */
function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - due.getTime()) / 86_400_000);
  return days > 0 ? days : null;
}

function PayoutPanel({ payout }: { payout: OwnerPayout }) {
  const { t, currentLanguage } = useTranslation();

  // Ce que la ventilation ne couvre pas — frais de canal, ajustements. Calcule
  // plutot que suppose : le detail renvoye n'expose pas toutes ses composantes,
  // et une somme qui ne tombe pas juste est pire qu'une ligne « autres ».
  const residual = payout.grossRevenue - payout.commissionAmount - payout.expenses - payout.netAmount;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Caption>{t('notifications.detail.money.netPayout', 'Montant reversé')}</Caption>
          <p className="m-0 mt-1 text-2xl leading-none font-semibold tabular-nums text-foreground">
            <Money value={payout.netAmount} from="EUR" symbolSize={16} />
          </p>
          <p className="m-0 mt-2 text-xs tabular-nums text-muted-foreground">
            {t('notifications.detail.money.period', 'Période du {{from}} au {{to}}', {
              from: formatFactDate(payout.periodStart.slice(0, 10), currentLanguage),
              to: formatFactDate(payout.periodEnd.slice(0, 10), currentLanguage),
            })}
          </p>
        </div>
        <Badge variant={PAYOUT_BADGE[payout.status] ?? 'secondary'}>
          {t(`accounting.payoutStatus.${payout.status}`, payout.status)}
        </Badge>
      </header>

      {payout.ownerName && (
        <div className="flex items-center gap-2.5">
          <GuestAvatar name={payout.ownerName} size={28} />
          <div className="min-w-0">
            <Caption>{t('notifications.detail.money.owner', 'Bénéficiaire')}</Caption>
            <p className="m-0 truncate text-sm font-medium text-foreground">{payout.ownerName}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg bg-card px-3.5 py-3">
        <Caption>{t('notifications.detail.money.breakdown', 'Ce dont il est fait')}</Caption>
        <Line label={t('notifications.detail.money.gross', 'Revenus bruts')} value={payout.grossRevenue} />
        <Line
          label={
            <>
              {t('notifications.detail.money.commission', 'Commission de gestion')}
              {payout.commissionRate > 0 && (
                <span className="ms-1.5 tabular-nums text-muted-foreground">
                  {Math.round(payout.commissionRate * (payout.commissionRate <= 1 ? 100 : 1))} %
                </span>
              )}
            </>
          }
          value={payout.commissionAmount}
          sign="minus"
        />
        {payout.expenses > 0 && (
          <Line label={t('notifications.detail.money.expenses', 'Dépenses')} value={payout.expenses} sign="minus" />
        )}
        {Math.abs(residual) >= 0.01 && (
          <Line
            label={t('notifications.detail.money.other', 'Frais de canal et ajustements')}
            value={residual}
            sign={residual > 0 ? 'minus' : undefined}
          />
        )}
        <div className="mt-1 border-t border-border pt-2">
          <Line label={t('notifications.detail.money.net', 'Net reversé')} value={payout.netAmount} strong />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {payout.payoutMethod && (
          <Figure label={t('notifications.detail.money.method', 'Moyen')}>
            {t(`accounting.payoutMethod.${payout.payoutMethod}`, payout.payoutMethod)}
          </Figure>
        )}
        {payout.paidAt && (
          <Figure label={t('notifications.detail.money.paidAt', 'Versé le')}>
            {formatFactDate(payout.paidAt.slice(0, 10), currentLanguage)}
          </Figure>
        )}
        {payout.paymentReference && (
          <Figure label={t('notifications.detail.money.reference', 'Référence')}>
            {payout.paymentReference}
          </Figure>
        )}
      </div>

      {payout.failureReason && (
        <div className="rounded-lg bg-destructive-soft px-3.5 py-3">
          <Caption>{t('notifications.detail.money.failure', 'Motif de l’échec')}</Caption>
          <p className="m-0 mt-1 text-sm leading-relaxed text-pretty text-destructive-ink">
            {payout.failureReason}
          </p>
        </div>
      )}
    </section>
  );
}

function InvoicePanel({ invoice }: { invoice: Invoice }) {
  const { t, currentLanguage } = useTranslation();
  const late = invoice.status !== 'PAID' ? daysOverdue(invoice.dueDate) : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Caption>{t('notifications.detail.money.invoiceTotal', 'Montant dû')}</Caption>
          <p className="m-0 mt-1 text-2xl leading-none font-semibold tabular-nums text-foreground">
            <Money value={invoice.totalTtc} from={invoice.currency} symbolSize={16} />
          </p>
          <p className="m-0 mt-2 truncate text-xs tabular-nums text-muted-foreground">
            {invoice.invoiceNumber}
          </p>
        </div>
        <Badge variant={late ? 'destructive' : INVOICE_BADGE[invoice.status] ?? 'secondary'}>
          {late
            ? t('notifications.detail.money.overdue', 'En retard de {{count}} j', { count: late })
            : t(`invoices.status.${invoice.status}`, invoice.status)}
        </Badge>
      </header>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {invoice.buyerName && (
          <Figure label={t('notifications.detail.money.buyer', 'Client')}>{invoice.buyerName}</Figure>
        )}
        <Figure label={t('notifications.detail.money.issuedOn', 'Émise le')}>
          {formatFactDate(invoice.invoiceDate.slice(0, 10), currentLanguage)}
        </Figure>
        {invoice.dueDate && (
          <Figure label={t('notifications.detail.money.dueOn', 'Échéance')}>
            {formatFactDate(invoice.dueDate.slice(0, 10), currentLanguage)}
          </Figure>
        )}
      </div>

      {invoice.lines.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-card px-3.5 py-3">
          <Caption>{t('notifications.detail.money.lines', 'Détail')}</Caption>
          {invoice.lines.map((line, index) => (
            <Line
              key={`${line.description}-${index}`}
              label={line.description}
              value={line.totalTtc ?? line.totalHt ?? 0}
            />
          ))}
          <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
            <Line label={t('notifications.detail.money.ht', 'Total HT')} value={invoice.totalHt} />
            <Line label={t('notifications.detail.money.tax', 'TVA')} value={invoice.totalTax} />
            <Line label={t('notifications.detail.money.ttc', 'Total TTC')} value={invoice.totalTtc} strong />
          </div>
        </div>
      )}
    </section>
  );
}

function BatchPanel({ pending }: { pending: OwnerPayout[] }) {
  const { t, currentLanguage } = useTranslation();
  const total = pending.reduce((sum, payout) => sum + payout.netAmount, 0);

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {/* L'intitule dit « en attente », pas « du lot » : c'est l'etat LU
              MAINTENANT. Un lot deja traite ne doit pas se relire en rappel. */}
          <Caption>{t('notifications.detail.money.pending', 'Reversements en attente d’approbation')}</Caption>
          <p className="m-0 mt-1 text-2xl leading-none font-semibold tabular-nums text-foreground">
            <Money value={total} from="EUR" symbolSize={16} />
          </p>
        </div>
        <Badge variant={pending.length > 0 ? 'warning' : 'success'}>
          {t('notifications.detail.money.pendingCount', '{{count}} reversement', { count: pending.length })}
        </Badge>
      </header>

      {pending.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-lg bg-card px-3.5 py-3 p-0">
          {pending.slice(0, 8).map((payout) => (
            <li key={payout.id} className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-foreground">
                {payout.ownerName ?? `#${payout.id}`}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatFactDate(payout.periodEnd.slice(0, 10), currentLanguage)}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-foreground">
                <Money value={payout.netAmount} from="EUR" />
              </span>
            </li>
          ))}
          {pending.length > 8 && (
            <li className="pt-1 text-xs tabular-nums text-muted-foreground">
              {t('notifications.detail.money.more', '+ {{count}} autres', { count: pending.length - 8 })}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export default function NotificationMoneyPanel({
  dossier,
  observation,
}: {
  dossier: MoneyDossier;
  /** Motif de l'evenement — ce que le panneau ne montre pas de lui-meme. */
  observation?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {dossier.kind === 'payout' && <PayoutPanel payout={dossier.payout} />}
      {dossier.kind === 'invoice' && <InvoicePanel invoice={dossier.invoice} />}
      {dossier.kind === 'batch' && <BatchPanel pending={dossier.pending} />}
      <ObservationBand text={observation} />
    </div>
  );
}
