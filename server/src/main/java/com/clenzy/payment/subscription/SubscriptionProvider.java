package com.clenzy.payment.subscription;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.PaymentCapability;
import com.clenzy.payment.PaymentResult;

import java.util.Set;

/**
 * Port <strong>abonnement récurrent</strong> (ADR paiement multi-provider, décision D1).
 *
 * <p>Séparé du port paiement one-shot ({@code PaymentProvider}) car la sémantique
 * récurrente (prix récurrent, coupon d'abonnement, metadata portées par l'abonnement)
 * diffère trop du one-shot. Adaptateurs : Stripe Billing aujourd'hui, PayZone récurrent
 * (Maroc) à venir.</p>
 *
 * <p>Le résultat réutilise {@link PaymentResult} (checkout embarqué → {@code clientSecret} ;
 * hébergé → {@code redirectUrl}). La <strong>complétion</strong> reste portée par le webhook
 * (checkout.session.completed {@code type=inscription|upgrade}) : ce port ne couvre que la
 * création du checkout d'abonnement.</p>
 */
public interface SubscriptionProvider {

    /** Type de provider (pour la résolution + le ledger). */
    PaymentProviderType getProviderType();

    /** Capacités déclarées ; inclut {@link PaymentCapability#RECURRING}. */
    Set<PaymentCapability> getCapabilities();

    /**
     * Crée un checkout d'abonnement récurrent.
     *
     * @return {@link PaymentResult#embedded} (clientSecret) si {@code request.embedded()},
     *         sinon {@link PaymentResult#success} (redirectUrl) ; {@link PaymentResult#failure}
     *         en cas d'échec provider.
     */
    PaymentResult createSubscriptionCheckout(SubscriptionCheckoutRequest request);

    /** True si le provider déclare la capacité demandée. */
    default boolean supports(PaymentCapability capability) {
        return getCapabilities().contains(capability);
    }
}
