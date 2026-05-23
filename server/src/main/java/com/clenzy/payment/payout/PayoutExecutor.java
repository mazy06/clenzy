package com.clenzy.payment.payout;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;

/**
 * Strategy interface pour les exécuteurs de payouts sortants.
 *
 * <h2>Responsabilité</h2>
 * <p>Un {@code PayoutExecutor} sait exécuter un payout {@code APPROVED} pour
 * une méthode de paiement donnée (Stripe Connect, SEPA, Wise, Open Banking,
 * Manual). Il met à jour le statut du payout
 * (PROCESSING / PAID / FAILED) et déclenche les notifications.</p>
 *
 * <h2>Pattern</h2>
 * <p>Chaque exécuteur est un bean Spring auto-découvert par
 * {@link PayoutExecutorRegistry}. L'orchestrator {@code PayoutExecutionService}
 * résout l'exécuteur via la méthode déclarée dans
 * {@link OwnerPayoutConfig#getPayoutMethod()}.</p>
 *
 * <h2>Idempotence</h2>
 * <p>Les implémentations doivent être idempotentes : appeler {@code execute}
 * deux fois sur le même payout en état terminal (PAID/FAILED) doit retourner
 * l'état sans nouvel appel au provider.</p>
 */
public interface PayoutExecutor {

    /** La méthode de paiement gérée par cet exécuteur. */
    PayoutMethod getSupportedMethod();

    /**
     * Exécute le payout et retourne l'entité mise à jour (statut, références
     * de transaction, dates). Les implémentations doivent persister le résultat
     * en base elles-mêmes via le repository.
     *
     * @param payout payout à exécuter (statut APPROVED)
     * @param config configuration de payout du propriétaire (credentials, IBAN…)
     * @return payout mis à jour (statut PROCESSING / PAID / FAILED)
     * @throws PayoutExecutionException si l'exécution est rejetée en amont
     *         (config invalide, méthode non-automatisable, etc.)
     */
    OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config);

    /** Exception métier pour les erreurs d'exécution rejetées en amont. */
    class PayoutExecutionException extends RuntimeException {
        public PayoutExecutionException(String message) { super(message); }
        public PayoutExecutionException(String message, Throwable cause) { super(message, cause); }
    }
}
