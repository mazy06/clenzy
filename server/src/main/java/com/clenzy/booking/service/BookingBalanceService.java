package com.clenzy.booking.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.ReservationRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Encaissement du SOLDE d'un acompte (booking engine, P0.7) : crée une session Stripe Checkout
 * hébergée pour le montant restant. Le voyageur paie via un lien ; le webhook
 * ({@code type=booking_engine_balance}) finalise ensuite la réservation (PARTIALLY_PAID → PAID +
 * ledger + facture). Org-scopé (audit #3) ; n'agit que sur une résa PARTIALLY_PAID au solde > 0.
 */
@Service
public class BookingBalanceService {

    private final ReservationRepository reservationRepository;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.currency:eur}")
    private String defaultCurrency;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public BookingBalanceService(ReservationRepository reservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    /** Crée la session Checkout du solde et renvoie son URL (hébergée, redirection). */
    @Transactional(readOnly = true)
    public String createBalanceCheckoutUrl(Long orgId, String reservationCode) throws StripeException {
        Reservation reservation = reservationRepository
            .findByConfirmationCodeAndOrganizationId(reservationCode, orgId)
            .orElseThrow(() -> new NotFoundException("Réservation introuvable: " + reservationCode));

        if (reservation.getPaymentStatus() != PaymentStatus.PARTIALLY_PAID
            || reservation.getAmountDue() == null
            || reservation.getAmountDue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Aucun solde à régler pour cette réservation");
        }

        String currency = (reservation.getCurrency() != null && !reservation.getCurrency().isBlank())
            ? reservation.getCurrency().toLowerCase(Locale.ROOT)
            : defaultCurrency.toLowerCase(Locale.ROOT);

        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
            .setSuccessUrl(frontendUrl + "/booking/balance/success?session_id={CHECKOUT_SESSION_ID}")
            .setCancelUrl(frontendUrl + "/booking/balance/cancel")
            .setCustomerEmail(reservation.getPaymentLinkEmail())
            .addLineItem(SessionCreateParams.LineItem.builder()
                .setQuantity(1L)
                .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                    .setCurrency(currency)
                    .setUnitAmount(StripeAmounts.toMinorUnits(reservation.getAmountDue()))
                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                        .setName("Solde réservation " + reservation.getConfirmationCode())
                        .build())
                    .build())
                .build())
            .putMetadata("type", "booking_engine_balance")
            .putMetadata("reservation_id", String.valueOf(reservation.getId()))
            .build();

        RequestOptions options = RequestOptions.builder().setApiKey(stripeSecretKey).build();
        return Session.create(params, options).getUrl();
    }
}
