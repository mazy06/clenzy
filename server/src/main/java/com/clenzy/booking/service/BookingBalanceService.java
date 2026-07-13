package com.clenzy.booking.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.PaymentOrchestrationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Encaissement du SOLDE d'un acompte (booking engine, P0.7) : crée une session de
 * paiement hébergée (orchestrée multi-provider) pour le montant restant. Le voyageur
 * paie via un lien ; la réservation est finalisée (PARTIALLY_PAID → PAID + ledger +
 * facture) de façon provider-agnostique par le consumer {@code PAYMENT_COMPLETED}
 * (sourceType {@code BOOKING_BALANCE}) → {@code confirmBookingEngineBalanceById}.
 *
 * <p>Org-scopé (audit #3) ; n'agit que sur une résa PARTIALLY_PAID au solde &gt; 0.
 * Ce flux est <strong>public</strong> (booking engine) : l'org et le pays sont fournis
 * explicitement à l'orchestrateur (pas de {@code TenantContext}).</p>
 */
@Service
public class BookingBalanceService {

    /** {@code sourceType} de la {@code PaymentTransaction} d'un paiement de solde (reconnu par le consumer + le webhook). */
    public static final String SOURCE_TYPE = "BOOKING_BALANCE";

    private final ReservationRepository reservationRepository;
    private final PaymentOrchestrationService orchestrationService;
    /** Lecture de la réservation dans une transaction courte (association property LAZY). */
    private final TransactionTemplate readOnlyTx;

    @Value("${stripe.currency:eur}")
    private String defaultCurrency;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public BookingBalanceService(ReservationRepository reservationRepository,
                                 PaymentOrchestrationService orchestrationService,
                                 PlatformTransactionManager transactionManager) {
        this.reservationRepository = reservationRepository;
        this.orchestrationService = orchestrationService;
        this.readOnlyTx = new TransactionTemplate(transactionManager);
        this.readOnlyTx.setReadOnly(true);
    }

    /**
     * Crée la session de paiement du solde (orchestrée) et renvoie son URL de redirection.
     *
     * @throws NotFoundException réservation introuvable dans l'org
     * @throws IllegalStateException aucun solde dû, ou échec de l'orchestrateur
     */
    public String createBalanceCheckoutUrl(Long orgId, String reservationCode) {
        // Lecture + validation dans une transaction courte (property LAZY) ; l'appel
        // provider se fait ENSUITE, hors transaction (règle money-safety #2).
        BalanceCheckout data = readOnlyTx.execute(status -> loadAndValidate(orgId, reservationCode));

        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
            data.amountDue(),                    // Z3-SEC-01 : montant serveur (solde dû de l'entité)
            data.currency(),
            SOURCE_TYPE,
            data.reservationId(),
            "Solde reservation " + data.confirmationCode(),
            data.email(),
            null,                                 // preferredProvider : résolu par l'orchestrateur
            frontendUrl + "/booking/balance/success?session_id={CHECKOUT_SESSION_ID}",
            frontendUrl + "/booking/balance/cancel",
            Map.of("reservation_id", String.valueOf(data.reservationId())),
            "BOOKING-BALANCE-" + data.reservationId());

        // Flux public : org + pays explicites (pas de TenantContext).
        PaymentOrchestrationResult result = orchestrationService.initiatePayment(orgId, data.countryCode(), request);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            throw new IllegalStateException("Echec de creation de la session de paiement du solde: " + err);
        }
        return result.paymentResult().redirectUrl();
    }

    private BalanceCheckout loadAndValidate(Long orgId, String reservationCode) {
        Reservation reservation = reservationRepository
            .findByConfirmationCodeAndOrganizationId(reservationCode, orgId)
            .orElseThrow(() -> new NotFoundException("Réservation introuvable: " + reservationCode));

        if (reservation.getPaymentStatus() != PaymentStatus.PARTIALLY_PAID
            || reservation.getAmountDue() == null
            || reservation.getAmountDue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Aucun solde à régler pour cette réservation");
        }

        String currency = (reservation.getCurrency() != null && !reservation.getCurrency().isBlank())
            ? reservation.getCurrency()
            : defaultCurrency;
        // Devise + pays de la propriété pilotent la résolution multi-provider (MAD → PayZone/CMI…).
        String countryCode = reservation.getProperty() != null ? reservation.getProperty().getCountryCode() : null;

        return new BalanceCheckout(reservation.getId(), reservation.getConfirmationCode(),
            reservation.getAmountDue(), currency, reservation.getPaymentLinkEmail(), countryCode);
    }

    /** Primitives extraites de la réservation (hors transaction pour l'appel provider). */
    private record BalanceCheckout(Long reservationId, String confirmationCode, BigDecimal amountDue,
                                   String currency, String email, String countryCode) {}
}
