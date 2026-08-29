import React, { useState } from 'react';
import { Button, Spinner } from '../../../components/ui';
import { CreditCard } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { useAuth } from '../../../hooks/useAuth';
import { formatCurrency } from '../../../utils/currencyUtils';
import { paymentsApi } from '../../../services/api/paymentsApi';
import type { DepositCardPayload } from '../../../services/api/contactApi';

/**
 * Reglement de l'acompte, dans la discussion.
 *
 * <p>Le devis valide, le prestataire attend son acompte pour bloquer la date.
 * Le renvoyer vers un ecran de facturation romprait le fil : la carte porte le
 * montant et le bouton qui ouvre le paiement Stripe.</p>
 */
export default function DepositMessageCard(
  { card, threadKey }: { card: DepositCardPayload; threadKey?: string },
) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { hasAnyRole } = useAuth();
  const [paying, setPaying] = useState(false);

  // Regler l'acompte est le geste du proprietaire ou de la conciergerie, jamais
  // de l'intervenant : le lui proposer ne menait qu'a un 403. Meme perimetre
  // que `/payments/create-session`.
  const canPay = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST']);

  const pay = async () => {
    setPaying(true);
    try {
      // `purpose` porte l'intention : c'est le SERVEUR qui recalcule le montant
      // de l'acompte depuis le devis approuve, jamais ce que la carte envoie.
      const session = await paymentsApi.createSession({
        interventionId: card.interventionId,
        amount: card.amount,
        purpose: 'DEPOSIT',
        // Revenir ICI, dans LA discussion : la conversation ouverte vit dans
        // l'etat React, une adresse sans elle ramenait sur la liste vide.
        // Le serveur valide l'origine.
        returnUrl: `${window.location.origin}${window.location.pathname}`
          + (threadKey ? `?thread=${encodeURIComponent(threadKey)}` : ''),
      });
      if (session.url) {
        window.location.href = session.url;
        return;
      }
      // 200 sans URL = l'orchestrateur a rejoue une transaction deja ouverte
      // (double-clic). Ce n'est pas un echec : le dire evite de relancer.
      notify.info(t('messagingHub.deposit.alreadyOpen',
        'Un paiement est déjà en cours pour cet acompte. Patientez quelques instants avant de réessayer.'));
    } catch {
      notify.error(t('messagingHub.deposit.failed', 'Le paiement n’a pas pu être ouvert.'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <span className="flex w-full max-w-[340px] flex-col gap-2 p-3">
      <span className="flex items-center gap-2">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
          <CreditCard size={15} strokeWidth={1.75} />
        </span>
        <span className="text-2xs font-bold uppercase tracking-wider text-faint">
          {t('messagingHub.deposit.title', 'Acompte à régler')}
        </span>
      </span>

      <span className="text-[17px] font-semibold tabular-nums text-foreground">
        {formatCurrency(card.amount, card.currency)}
      </span>

      {card.percent != null && card.totalAmount != null && (
        <span className="text-xs text-muted-foreground">
          {t('messagingHub.deposit.detail', '{{percent}} % du devis de {{total}}', {
            percent: card.percent,
            total: formatCurrency(card.totalAmount, card.currency),
          })}
        </span>
      )}

      {canPay ? (
        <Button size="sm" disabled={paying} onClick={pay}>
          {paying ? <Spinner className="size-4" /> : <CreditCard size={15} strokeWidth={1.75} />}
          {t('messagingHub.deposit.pay', 'Payer l’acompte')}
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">
          {t('messagingHub.deposit.awaiting',
            'En attente du règlement par le propriétaire ou la conciergerie.')}
        </span>
      )}
    </span>
  );
}
