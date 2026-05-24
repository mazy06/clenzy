package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service Stripe Tokenization via Channex (paid app).
 *
 * <p>Channex stocke en PCI vault les cartes de credit fournies par certains OTAs
 * (Booking.com notamment). Cette app expose 2 endpoints pour transferer la CC
 * du vault Channex vers le Stripe Connect Clenzy sans qu'on ait besoin d'etre
 * certifie PCI DSS.</p>
 *
 * <p><b>Use case principal</b> : reservation Booking.com -> le payload booking
 * contient un payment_collect=PROPERTY. Au moment de pre-autoriser/charger le
 * client, on appelle {@link #tokenize} qui retourne un payment_method_id Stripe
 * utilisable dans nos {@code PaymentIntent}/{@code SetupIntent}.</p>
 *
 * <p><b>Pre-requis</b> : Stripe Tokenization App achetee + activee cote
 * dashboard Channex. Le {@code stripeAccountId} = Stripe Connect account ID
 * de l'organisation Clenzy.</p>
 */
@Service
public class ChannexStripeTokenizationService {

    private static final Logger log = LoggerFactory.getLogger(ChannexStripeTokenizationService.class);

    private final ChannexClient channexClient;
    private final String defaultStripeAccountId;

    public ChannexStripeTokenizationService(ChannexClient channexClient,
                                              @Value("${clenzy.stripe.connect-account-id:}")
                                              String defaultStripeAccountId) {
        this.channexClient = channexClient;
        this.defaultStripeAccountId = defaultStripeAccountId;
    }

    /**
     * Tokenize la CC d'un booking en PaymentMethod Stripe.
     *
     * <p>Retourne le PaymentMethod ID Stripe (forme {@code pm_xxx}) qui pourra
     * etre utilise comme {@code payment_method} dans un {@code PaymentIntent}
     * Stripe pour pre-auth / charge / refund.</p>
     *
     * @param bookingId        ID du booking Channex (avec CC dans le vault)
     * @param stripeAccountId  override optionnel du Stripe Connect account
     *                         (default = {@code clenzy.stripe.connect-account-id})
     * @return PaymentMethod ID Stripe, ou {@code Optional.empty} si la CC n'est
     *         pas disponible (booking sans CC, app non installee, etc.)
     */
    public Optional<String> tokenize(String bookingId, String stripeAccountId) {
        String effectiveAccountId = stripeAccountId != null && !stripeAccountId.isBlank()
            ? stripeAccountId : defaultStripeAccountId;
        if (effectiveAccountId == null || effectiveAccountId.isBlank()) {
            log.warn("ChannexStripeTokenization: pas de Stripe account ID configure (clenzy.stripe.connect-account-id)");
            return Optional.empty();
        }
        Optional<JsonNode> response = channexClient.stripeTokenizeBookingPaymentMethod(
            bookingId, effectiveAccountId);
        if (response.isEmpty()) {
            log.warn("ChannexStripeTokenization: tokenize KO booking={} (app pas installee ou pas de CC)",
                bookingId);
            return Optional.empty();
        }
        String paymentMethodId = response.get().path("data").path("payment_method_id").asText(null);
        if (paymentMethodId == null || paymentMethodId.isBlank()) {
            paymentMethodId = response.get().path("data").path("id").asText(null);
        }
        if (paymentMethodId == null || paymentMethodId.isBlank()) {
            log.warn("ChannexStripeTokenization: reponse Channex sans payment_method_id booking={}",
                bookingId);
            return Optional.empty();
        }
        log.info("ChannexStripeTokenization: tokenize OK booking={} payment_method={} stripe_account={}",
            bookingId, paymentMethodId, effectiveAccountId);
        return Optional.of(paymentMethodId);
    }

    /**
     * Variante legacy : tokenize en {@code Token} Stripe (l'ancienne API Charges).
     * Preferer {@link #tokenize} qui utilise PaymentMethod (PaymentIntents API).
     */
    public Optional<String> tokenizeLegacy(String bookingId, String stripeAccountId) {
        String effectiveAccountId = stripeAccountId != null && !stripeAccountId.isBlank()
            ? stripeAccountId : defaultStripeAccountId;
        Optional<JsonNode> response = channexClient.stripeTokenizeBooking(
            bookingId, effectiveAccountId);
        if (response.isEmpty()) return Optional.empty();
        String token = response.get().path("data").path("token").asText(null);
        return Optional.ofNullable(token != null && !token.isBlank() ? token : null);
    }
}
