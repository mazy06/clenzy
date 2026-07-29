import * as React from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, Item, ItemContent, ItemDescription, ItemGroup, ItemTitle, Separator, Spinner } from '../ui';
import { Money } from '../Money';
import type { PayoutRecap as PayoutRecapData } from '../../services/api/actionItemsApi';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — ce qu'on approuve, avant de l'approuver.
 *
 * <p>Le bouton d'approbation portait un montant et rien d'autre. Approuver
 * plusieurs milliers d'euros sans voir à qui ils vont, ce qu'ils recouvrent ni
 * par quel canal ils partiront, ce n'est pas une décision — c'est une signature
 * à l'aveugle.</p>
 *
 * <p>Trois blocs, dans l'ordre où l'on se pose les questions : <b>à qui</b>,
 * <b>combien et pourquoi</b>, <b>par quel moyen</b>. Les séjours et les
 * déductions viennent ensuite, pour qui veut vérifier le détail.</p>
 */

export interface PayoutRecapProps {
  recap?: PayoutRecapData;
  isLoading: boolean;
  isError: boolean;
}

export default function PayoutRecap({ recap, isLoading, isError }: PayoutRecapProps) {
  const { t } = useTranslation();

  if (isLoading) return <Spinner />;
  if (isError || !recap) {
    return (
      <p className="text-sm text-destructive">
        {t(
          'dashboard.payoutRecap.failed',
          'Le détail n’a pas pu être chargé. Mieux vaut ne pas approuver sans l’avoir vu.',
        )}
      </p>
    );
  }

  const currency = recap.currency ?? undefined;

  return (
    <div className="space-y-3">
      <ItemGroup>
        <Item size="sm" variant="muted">
          <ItemContent>
            <ItemDescription>
              {t('dashboard.payoutRecap.beneficiary', 'Bénéficiaire')}
            </ItemDescription>
            <ItemTitle>
              {recap.beneficiaryName
                ?? t('dashboard.payoutRecap.unknownBeneficiary', 'Propriétaire inconnu')}
            </ItemTitle>
            {recap.beneficiaryEmail && (
              <ItemDescription>{recap.beneficiaryEmail}</ItemDescription>
            )}
          </ItemContent>
        </Item>

        <Item size="sm" variant="muted">
          <ItemContent>
            <ItemDescription>{t('dashboard.payoutRecap.period', 'Période')}</ItemDescription>
            <ItemTitle className="tabular-nums">
              {recap.periodStart} → {recap.periodEnd}
            </ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>

      {/* Le calcul, ligne à ligne : c'est ce qui rend le net vérifiable. */}
      <div className="space-y-1 text-sm">
        <Line
          label={t('dashboard.payoutRecap.gross', 'Revenu des séjours')}
          value={recap.grossRevenue}
          currency={currency}
        />
        <Line
          label={t('dashboard.payoutRecap.commission', 'Commission {{rate}} %', {
            rate: recap.commissionRate ?? 0,
          })}
          value={recap.commissionAmount}
          currency={currency}
          negative
        />
        <Line
          label={t('dashboard.payoutRecap.expenses', 'Dépenses déduites')}
          value={recap.expenses}
          currency={currency}
          negative
        />
        <Separator />
        <Line
          label={t('dashboard.payoutRecap.net', 'Net à verser')}
          value={recap.netAmount}
          currency={currency}
          strong
        />
      </div>

      <ItemGroup>
        <Item size="sm" variant="muted">
          <ItemContent>
            <ItemDescription>
              {t('dashboard.payoutRecap.destination', 'Versé par')}
            </ItemDescription>
            <ItemTitle>
              {[payoutMethodLabel(recap.payoutMethod, t), recap.destination]
                .filter(Boolean)
                .join(' · ')
                || t('dashboard.payoutRecap.noDestination', 'Aucun moyen de versement configuré')}
            </ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>

      {/* Approuver un versement qui ne peut pas partir cree une attente sans
          issue : le proprietaire croit son virement lance. */}
      {!recap.destinationReady && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>
            {t(
              'dashboard.payoutRecap.notReady',
              'Aucun compte de destination utilisable : approuver ne fera pas partir le virement.',
            )}
          </AlertDescription>
        </Alert>
      )}

      {recap.stays.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {t('dashboard.payoutRecap.stays', {
              count: recap.stays.length,
              defaultValue: '{{count}} séjour(s) couvert(s)',
            })}
          </summary>
          <ul className="m-0 mt-2 list-none space-y-1 p-0">
            {recap.stays.map((stay) => (
              <li key={stay.reservationId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">
                  {[stay.guestName, stay.propertyName].filter(Boolean).join(' · ')}
                </span>
                <span className="shrink-0 tabular-nums">
                  <Money value={stay.totalPrice} from={currency} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {recap.deductions.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {t('dashboard.payoutRecap.deductions', {
              count: recap.deductions.length,
              defaultValue: '{{count}} dépense(s) déduite(s)',
            })}
          </summary>
          <ul className="m-0 mt-2 list-none space-y-1 p-0">
            {recap.deductions.map((expense) => (
              <li key={expense.expenseId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">
                  {expense.description ?? expense.category}
                </span>
                <span className="shrink-0 tabular-nums">
                  <Money value={expense.amount} from={currency} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Une ligne du calcul — libellé à gauche, montant aligné à droite. */
function Line({
  label,
  value,
  currency,
  negative,
  strong,
}: {
  label: string;
  value: number | null;
  currency?: string;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
      <span
        className={
          strong
            ? 'text-base font-semibold text-foreground tabular-nums'
            : 'text-foreground tabular-nums'
        }
      >
        {negative && value != null && value !== 0 ? '− ' : ''}
        <Money value={value} from={currency} />
      </span>
    </div>
  );
}

/** Nom lisible du moyen de versement — la clé technique n'explique rien. */
function payoutMethodLabel(
  method: string | null,
  t: (key: string, fallback: string) => string,
): string | null {
  if (!method) return null;
  if (method === 'STRIPE_CONNECT') return t('payoutMethod.stripe', 'Stripe Connect');
  if (method === 'MANUAL') return t('payoutMethod.manual', 'Virement manuel');
  if (method === 'WISE') return t('payoutMethod.wise', 'Wise');
  return method;
}
