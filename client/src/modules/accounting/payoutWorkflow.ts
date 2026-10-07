import type { OwnerPayout, OwnerPayoutConfig } from '../../services/api/accountingApi';

export type PayoutBlocker = 'legacy' | 'funding' | 'amount' | 'beneficiary' | 'retryLimit' | 'tracking';

/** L'approbation valide le calcul ; seul le PSP peut confirmer un transfert. */
export function getPayoutWorkflow(payout: OwnerPayout, config?: OwnerPayoutConfig) {
  const legacyRoute = payout.payoutMethod != null && payout.payoutMethod !== 'STRIPE_CONNECT';
  const stripeReady = config?.payoutMethod === 'STRIPE_CONNECT' && config.verified
    && config.stripeOnboardingComplete && !!config.stripeConnectedAccountId;
  const hasTransfer = !!payout.stripeTransferId;
  const actionable = ['PENDING', 'APPROVED', 'FAILED'].includes(payout.status);
  let blocker: PayoutBlocker | null = null;
  if (actionable) {
    if (hasTransfer) blocker = 'tracking';
    else if (legacyRoute) blocker = 'legacy';
    else if (payout.fundingVersion !== 1) blocker = 'funding';
    else if (!Number.isFinite(payout.netAmount) || payout.netAmount <= 0) blocker = 'amount';
    else if (payout.status !== 'PENDING' && !stripeReady) blocker = 'beneficiary';
    else if (payout.status === 'FAILED' && payout.retryCount >= 3) blocker = 'retryLimit';
  }
  return {
    blocker,
    canApprove: payout.status === 'PENDING' && !blocker,
    canSend: payout.status === 'APPROVED' && !blocker,
    canRetry: payout.status === 'FAILED' && !blocker,
    canTrack: !legacyRoute && (hasTransfer || (payout.payoutMethod === 'STRIPE_CONNECT'
      && ['PROCESSING', 'PAID', 'FAILED'].includes(payout.status))),
    hint: blocker ?? (payout.status === 'PAID'
      ? payout.payoutMethod === 'STRIPE_CONNECT' ? 'transferred' : 'recorded'
      : payout.status.toLowerCase()),
  };
}
