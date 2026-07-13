package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BookingCheckoutRequest;
import com.clenzy.booking.dto.SelectedServiceOptionDto;
import com.clenzy.booking.security.BookingPublicRateLimiter;
import com.clenzy.booking.service.BookingCheckoutQuoteService;
import com.clenzy.booking.service.BookingCheckoutQuoteService.CheckoutQuote;
import com.clenzy.booking.service.BookingPaymentPolicyService;
import com.clenzy.booking.service.BookingPaymentPolicyService.BookingPaymentPolicy;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.RestrictionViolationException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.PaymentOrchestrationService;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Crée des sessions Stripe Checkout pour les réservations via le booking engine.
 * Utilise le mode embedded (inline dans le preview/SDK).
 *
 * <p>Z4A-SEC-01 / Z4A-BUGS-01 : le montant facturé est TOUJOURS recalculé côté
 * serveur ({@link BookingCheckoutQuoteService}). Le montant fourni par le client
 * n'est qu'un cross-check : toute divergence au-delà de la tolérance d'arrondi
 * est rejetée en 400.</p>
 *
 * <p>Z4A-BUGS-03 : les dates sont retenues dès la création de session par une
 * réservation PENDING (hold) qui bloque le calendrier ; le cleanup scheduler la
 * libère après 30 min si la session n'est pas payée.</p>
 */
@RestController
@RequestMapping("/api/booking-engine/checkout")
// Acces public : gere par SecurityConfigProd.java (.requestMatchers("/api/booking-engine/checkout/**").permitAll())
public class BookingCheckoutController {

    private static final Logger log = LoggerFactory.getLogger(BookingCheckoutController.class);

    /** Durée de vie de la session Checkout (minimum Stripe : 30 min ; +1 min de marge horloge). */
    private static final long SESSION_LIFETIME_MINUTES = 31;

    /** {@code sourceType} de la {@code PaymentTransaction} d'un checkout de séjour booking engine. */
    public static final String SOURCE_TYPE = "BOOKING_CHECKOUT";

    private final BookingCheckoutQuoteService quoteService;
    private final PublicBookingService publicBookingService;
    private final BookingPublicRateLimiter rateLimiter;
    private final BookingPaymentPolicyService paymentPolicyService;
    private final PaymentOrchestrationService orchestrationService;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.currency:eur}")
    private String currency;

    public BookingCheckoutController(BookingCheckoutQuoteService quoteService,
                                     PublicBookingService publicBookingService,
                                     BookingPublicRateLimiter rateLimiter,
                                     BookingPaymentPolicyService paymentPolicyService,
                                     PaymentOrchestrationService orchestrationService) {
        this.quoteService = quoteService;
        this.publicBookingService = publicBookingService;
        this.rateLimiter = rateLimiter;
        this.paymentPolicyService = paymentPolicyService;
        this.orchestrationService = orchestrationService;
    }

    @PostMapping("/create-session")
    public ResponseEntity<?> createCheckoutSession(@Valid @RequestBody BookingCheckoutRequest request,
                                                   HttpServletRequest httpRequest) {
        // Rate-limit Redis IP+propriete (reliquat revue A3) : chaque session cree
        // un hold qui gele les dates 30 min — sans limite, DoS du calendrier.
        if (!rateLimiter.tryAcquireHold(httpRequest, request.propertyId())) {
            return ResponseEntity.status(429)
                .body(Map.of("error", "Trop de tentatives de reservation, reessayez plus tard"));
        }
        try {
            CheckoutQuote quote = quoteService.quote(request);

            // Retenue des dates pendant le paiement (Z4A-BUGS-03) + snapshot des
            // options de service sur le hold (Z4A-BUGS-10)
            Reservation hold = publicBookingService.createEmbeddedCheckoutHold(
                quote.ctx(), request.propertyId(), quote.checkIn(), quote.checkOut(), request.guests(),
                request.customerEmail(), request.customerName(), quote.availability(),
                quote.serviceOptionsTotal(), request.serviceOptions());

            PaymentOrchestrationResult orchResult;
            try {
                orchResult = initiateEmbeddedCheckout(request, quote, hold);
            } catch (Exception orchError) {
                publicBookingService.releaseEmbeddedCheckoutHold(hold.getId());
                throw orchError;
            }
            if (!orchResult.isSuccess()) {
                publicBookingService.releaseEmbeddedCheckoutHold(hold.getId());
                String err = orchResult.paymentResult() != null
                    ? orchResult.paymentResult().errorMessage() : "erreur inconnue";
                // RuntimeException (pas IllegalState/Argument) → mappé en 500 par le catch générique.
                throw new RuntimeException("Echec de creation du paiement: " + err);
            }

            String sessionId = orchResult.paymentResult().providerTxId();
            String clientSecret = orchResult.paymentResult().clientSecret();
            publicBookingService.attachStripeSessionToHold(hold.getId(), sessionId);

            log.info("Booking engine checkout session créée: {}, provider={}, property={}, amount={}, serviceOptions={}, hold={}",
                sessionId, orchResult.providerUsed(), request.propertyId(), quote.totalAmount(),
                quote.serviceOptionsTotal(), hold.getConfirmationCode());

            return ResponseEntity.ok(Map.of(
                "clientSecret", clientSecret,
                "sessionId", sessionId,
                "reservationCode", hold.getConfirmationCode()
            ));
        } catch (CalendarConflictException | RestrictionViolationException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Dates non disponibles"));
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Dates invalides"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur création session Stripe booking: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la création du paiement"));
        }
    }

    /**
     * Initie le checkout de séjour via l'orchestrateur en mode <strong>embarqué</strong>
     * (le mode embedded est une capacité Stripe → le resolver capability-aware réserve
     * ce flux à Stripe). Toutes les metadata historiques sont conservées : la
     * <strong>complétion reste inchangée</strong> (webhook legacy {@code type=booking_engine}
     * → {@code PublicBookingService.confirmBookingEngineCheckout}, qui gère hold, acompte
     * et caution à partir de la {@code Session} Stripe).
     */
    private PaymentOrchestrationResult initiateEmbeddedCheckout(BookingCheckoutRequest request,
                                                                CheckoutQuote quote, Reservation hold) {
        Property property = quote.property();
        BookingPaymentPolicy policy = paymentPolicyService.resolve(property.getOrganizationId());

        // P0.7 Acompte : si un % d'acompte (1–99) est configuré, ne charger QUE l'acompte ;
        // le solde (deposit_balance) est réclamé au voyageur plus tard (BookingBalanceService).
        BigDecimal fullTotal = quote.totalAmount();
        Integer depositPercent = policy.depositPercent();
        BigDecimal chargeNow = fullTotal;
        BigDecimal depositBalance = BigDecimal.ZERO;
        if (depositPercent != null && depositPercent >= 1 && depositPercent <= 99) {
            chargeNow = fullTotal.multiply(BigDecimal.valueOf(depositPercent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            depositBalance = fullTotal.subtract(chargeNow);
        }
        boolean isDeposit = depositBalance.compareTo(BigDecimal.ZERO) > 0;
        String description = isDeposit
            ? String.format("Acompte %d%% — %s, %s au %s, %d voyageur(s)",
                depositPercent, property.getName(), request.checkIn(), request.checkOut(), request.guests())
            : String.format("%s — %s au %s, %d voyageur(s)",
                property.getName(), request.checkIn(), request.checkOut(), request.guests());

        // P0.3 Caution : si configurée, enregistrer la carte (customer + off-session, capacité
        // CUSTOMER = Stripe-only, décision D3) → le webhook posera ensuite un hold séparé.
        BigDecimal securityDeposit = (policy.securityDepositAmount() != null
            && policy.securityDepositAmount().compareTo(BigDecimal.ZERO) > 0)
            ? policy.securityDepositAmount() : null;

        // Z4A-BUGS-07 : devise de la PROPRIETE (repli config), pas la devise globale.
        String propertyCurrency = property.getDefaultCurrency();
        String checkoutCurrency = (propertyCurrency != null && !propertyCurrency.isBlank())
            ? propertyCurrency : currency;

        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "booking_engine");
        metadata.put("property_id", request.propertyId().toString());
        metadata.put("organization_id", String.valueOf(property.getOrganizationId()));
        metadata.put("check_in", request.checkIn());
        metadata.put("check_out", request.checkOut());
        metadata.put("guests", String.valueOf(request.guests()));
        metadata.put("service_options_total", quote.serviceOptionsTotal().toPlainString());
        // Z4A-BUGS-10 : selections d'options (id:qty) pour le fallback webhook.
        metadata.put("service_options", serializeServiceOptions(request.serviceOptions()));
        metadata.put("server_total", quote.totalAmount().toPlainString());
        // P0.7 : solde restant (>0 → le webhook passe la résa en PARTIALLY_PAID).
        metadata.put("deposit_balance", depositBalance.toPlainString());
        metadata.put("reservation_id", hold.getId().toString());
        if (securityDeposit != null) {
            metadata.put("security_deposit_amount", securityDeposit.toPlainString());
        }

        // Backstop : la session devient inutilisable peu apres l'expiration du hold.
        long expiresAt = Instant.now().plusSeconds(SESSION_LIFETIME_MINUTES * 60).getEpochSecond();

        PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
            chargeNow,                          // Z3-SEC-01 : montant serveur (acompte ou total)
            checkoutCurrency,
            SOURCE_TYPE,
            hold.getId(),
            description,
            request.customerEmail(),
            null,                               // preferredProvider
            null,                               // successUrl : embedded → non utilisé
            null,                               // cancelUrl : embedded → non utilisé
            metadata,
            "BOOKING-CHECKOUT-" + hold.getId(), // idempotence par hold
            true,                               // embedded
            expiresAt,
            securityDeposit != null);           // saveCardForFutureUse (caution)

        // Flux public : org + pays de la propriété explicites (pas de TenantContext).
        return orchestrationService.initiatePayment(
            property.getOrganizationId(), property.getCountryCode(), orchRequest);
    }

    /** Format compact {@code id:qty,id:qty} (metadata Stripe limitee a 500 chars). */
    private static String serializeServiceOptions(List<SelectedServiceOptionDto> selections) {
        if (selections == null || selections.isEmpty()) {
            return "";
        }
        return selections.stream()
            .map(sel -> sel.serviceItemId() + ":" + sel.quantity())
            .collect(Collectors.joining(","));
    }

    @GetMapping("/session-status/{sessionId}")
    public ResponseEntity<?> getSessionStatus(@PathVariable String sessionId) {
        try {
            final RequestOptions stripeOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey).build();
            Session session = Session.retrieve(sessionId, stripeOptions);
            return ResponseEntity.ok(Map.of(
                "status", session.getStatus(),
                "paymentStatus", session.getPaymentStatus() != null ? session.getPaymentStatus() : "unpaid"
            ));
        } catch (Exception e) {
            log.error("Erreur vérification session Stripe: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur vérification paiement"));
        }
    }
}
