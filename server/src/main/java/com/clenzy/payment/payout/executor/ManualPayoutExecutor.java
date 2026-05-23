package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import org.springframework.stereotype.Component;

/**
 * Exécuteur "Manuel" : refuse explicitement l'exécution automatique.
 *
 * <p>La méthode {@code MANUAL} signifie que le propriétaire reçoit ses
 * paiements hors-Clenzy (espèces, chèque, virement perso, etc.). Il n'y a
 * rien à automatiser. L'admin doit changer la méthode du propriétaire en
 * SEPA / Stripe Connect / Wise / Open Banking avant d'exécuter.</p>
 */
@Component
public class ManualPayoutExecutor implements PayoutExecutor {

    @Override
    public PayoutMethod getSupportedMethod() {
        return PayoutMethod.MANUAL;
    }

    @Override
    public OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config) {
        throw new PayoutExecutionException(
            "Les reversements en mode MANUEL ne peuvent pas etre executes automatiquement. "
          + "Changez la methode de paiement du proprietaire en SEPA, Stripe Connect, Wise ou Open Banking.");
    }
}
