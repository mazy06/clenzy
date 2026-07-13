package com.clenzy.payment.payout;

import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.Transfer;
import com.stripe.param.TransferCreateParams;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Client d'émission de transferts Stripe Connect vers un compte connecté —
 * couche adaptateur unique du versement Stripe Connect.
 *
 * <p>Partagé par les deux flux de versement Stripe Connect : les payouts
 * propriétaire ({@code StripeConnectPayoutExecutor}) et les versements ménage
 * ({@code HousekeeperPayoutService}). Ainsi les services métier ne manipulent
 * plus les types du SDK Stripe ({@code TransferCreateParams}, {@code Transfer}) :
 * seul cet adaptateur les connaît.</p>
 *
 * <p>Idempotence : la clé fournie (ex. {@code payout-<id>},
 * {@code payout-intervention-<id>}) neutralise un double virement sur re-essai.
 * Conversion euros→centimes via {@link StripeAmounts#toMinorUnits} (HALF_UP,
 * jamais de troncature — Z3-BUGS-09).</p>
 */
@Component
public class StripeConnectTransferClient {

    private final StripeGateway stripeGateway;

    public StripeConnectTransferClient(StripeGateway stripeGateway) {
        this.stripeGateway = stripeGateway;
    }

    /**
     * Émet un transfert Stripe Connect et retourne l'identifiant du transfert.
     *
     * @param amount               montant (unités majeures)
     * @param currency             devise ISO
     * @param destinationAccountId compte connecté destinataire
     * @param description          description du transfert
     * @param idempotencyKey       clé d'idempotence stable (anti double-virement)
     * @return l'identifiant du transfert Stripe créé
     * @throws StripeException en cas d'échec de l'appel Stripe
     */
    public String createTransfer(BigDecimal amount, String currency, String destinationAccountId,
                                 String description, String idempotencyKey) throws StripeException {
        TransferCreateParams params = TransferCreateParams.builder()
            .setAmount(StripeAmounts.toMinorUnits(amount))
            .setCurrency(currency.toLowerCase())
            .setDestination(destinationAccountId)
            .setDescription(description)
            .build();
        Transfer transfer = stripeGateway.createTransfer(params, idempotencyKey);
        return transfer.getId();
    }
}
