package com.clenzy.payment;

import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Coupon;
import com.stripe.model.Customer;
import com.stripe.model.EphemeralKey;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Price;
import com.stripe.model.Refund;
import com.stripe.model.Subscription;
import com.stripe.model.Transfer;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.CouponCreateParams;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.EphemeralKeyCreateParams;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.PaymentIntentUpdateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.SubscriptionCancelParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.TransferCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Point d'entree unique vers le SDK Stripe (T-SOLID-3 / Z3-SEC-05).
 *
 * <p>La cle API est transmise a chaque appel via {@link RequestOptions} au lieu
 * de muter l'etat statique global {@code Stripe.apiKey} : c'est thread-safe et
 * compatible avec une future introduction de cles par tenant (Stripe Connect
 * multi-comptes) sans risque de fuite de cle entre threads concurrents.</p>
 *
 * <p>Les methodes acceptant une {@code idempotencyKey} garantissent qu'un
 * re-essai du meme appel (apres timeout, crash ou echec de persistance locale)
 * ne produit pas un second effet de bord cote Stripe : Stripe renvoie la
 * reponse de la premiere requete.</p>
 */
@Component
public class StripeGateway {

    private final String stripeSecretKey;

    public StripeGateway(@Value("${stripe.secret-key:}") String stripeSecretKey) {
        this.stripeSecretKey = stripeSecretKey;
    }

    public Session createSession(SessionCreateParams params) throws StripeException {
        return Session.create(params, requestOptions(null));
    }

    public Session retrieveSession(String sessionId) throws StripeException {
        return Session.retrieve(sessionId, requestOptions(null));
    }

    public Refund createRefund(RefundCreateParams params, String idempotencyKey) throws StripeException {
        return Refund.create(params, requestOptions(idempotencyKey));
    }

    public Transfer createTransfer(TransferCreateParams params, String idempotencyKey) throws StripeException {
        return Transfer.create(params, requestOptions(idempotencyKey));
    }

    public Coupon createCoupon(CouponCreateParams params) throws StripeException {
        return Coupon.create(params, requestOptions(null));
    }

    public Customer createCustomer(CustomerCreateParams params) throws StripeException {
        return Customer.create(params, requestOptions(null));
    }

    public Customer retrieveCustomer(String customerId) throws StripeException {
        return Customer.retrieve(customerId, requestOptions(null));
    }

    public EphemeralKey createEphemeralKey(EphemeralKeyCreateParams params) throws StripeException {
        return EphemeralKey.create(params, requestOptions(null));
    }

    public Price createPrice(PriceCreateParams params) throws StripeException {
        return Price.create(params, requestOptions(null));
    }

    public PaymentIntent createPaymentIntent(PaymentIntentCreateParams params) throws StripeException {
        return PaymentIntent.create(params, requestOptions(null));
    }

    /** Cree un PaymentIntent avec cle d'idempotence (pre-autorisation / hold de caution). */
    public PaymentIntent createPaymentIntent(PaymentIntentCreateParams params, String idempotencyKey)
            throws StripeException {
        return PaymentIntent.create(params, requestOptions(idempotencyKey));
    }

    /** Capture (totale ou partielle) un PaymentIntent en pre-autorisation manuelle. */
    public PaymentIntent capturePaymentIntent(PaymentIntent paymentIntent,
                                              com.stripe.param.PaymentIntentCaptureParams params,
                                              String idempotencyKey) throws StripeException {
        return paymentIntent.capture(params, requestOptions(idempotencyKey));
    }

    /** Annule un PaymentIntent (libere un hold de caution). */
    public PaymentIntent cancelPaymentIntent(PaymentIntent paymentIntent, String idempotencyKey)
            throws StripeException {
        return paymentIntent.cancel(requestOptions(idempotencyKey));
    }

    public PaymentIntent retrievePaymentIntent(String paymentIntentId) throws StripeException {
        return PaymentIntent.retrieve(paymentIntentId, requestOptions(null));
    }

    public PaymentIntent updatePaymentIntent(PaymentIntent paymentIntent, PaymentIntentUpdateParams params)
            throws StripeException {
        return paymentIntent.update(params, requestOptions(null));
    }

    public Subscription createSubscription(SubscriptionCreateParams params) throws StripeException {
        return Subscription.create(params, requestOptions(null));
    }

    public Subscription retrieveSubscription(String subscriptionId) throws StripeException {
        return Subscription.retrieve(subscriptionId, requestOptions(null));
    }

    public Subscription cancelSubscription(Subscription subscription, SubscriptionCancelParams params)
            throws StripeException {
        return subscription.cancel(params, requestOptions(null));
    }

    public Account createAccount(AccountCreateParams params) throws StripeException {
        return Account.create(params, requestOptions(null));
    }

    public AccountLink createAccountLink(AccountLinkCreateParams params) throws StripeException {
        return AccountLink.create(params, requestOptions(null));
    }

    private RequestOptions requestOptions(String idempotencyKey) {
        RequestOptions.RequestOptionsBuilder builder = RequestOptions.builder()
            .setApiKey(stripeSecretKey);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            builder.setIdempotencyKey(idempotencyKey);
        }
        return builder.build();
    }
}
