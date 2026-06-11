package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BookingCheckoutRequest;
import com.clenzy.booking.dto.SelectedServiceOptionDto;
import com.clenzy.booking.security.BookingPublicRateLimiter;
import com.clenzy.booking.service.BookingCheckoutQuoteService;
import com.clenzy.booking.service.BookingCheckoutQuoteService.CheckoutQuote;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.RestrictionViolationException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
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

    private final BookingCheckoutQuoteService quoteService;
    private final PublicBookingService publicBookingService;
    private final BookingPublicRateLimiter rateLimiter;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.currency:eur}")
    private String currency;

    public BookingCheckoutController(BookingCheckoutQuoteService quoteService,
                                     PublicBookingService publicBookingService,
                                     BookingPublicRateLimiter rateLimiter) {
        this.quoteService = quoteService;
        this.publicBookingService = publicBookingService;
        this.rateLimiter = rateLimiter;
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

            Session session;
            try {
                session = createStripeSession(request, quote, hold);
            } catch (Exception stripeError) {
                publicBookingService.releaseEmbeddedCheckoutHold(hold.getId());
                throw stripeError;
            }
            publicBookingService.attachStripeSessionToHold(hold.getId(), session.getId());

            log.info("Booking engine checkout session créée: {}, property={}, amount={}, serviceOptions={}, hold={}",
                session.getId(), request.propertyId(), quote.totalAmount(), quote.serviceOptionsTotal(),
                hold.getConfirmationCode());

            return ResponseEntity.ok(Map.of(
                "clientSecret", session.getClientSecret(),
                "sessionId", session.getId(),
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

    private Session createStripeSession(BookingCheckoutRequest request, CheckoutQuote quote,
                                        Reservation hold) throws Exception {
        RequestOptions stripeOptions = RequestOptions.builder().setApiKey(stripeSecretKey).build();

        long amountInCents = quote.totalAmount().multiply(BigDecimal.valueOf(100))
            .setScale(0, RoundingMode.HALF_UP).longValueExact();
        Property property = quote.property();
        String description = String.format("%s — %s au %s, %d voyageur(s)",
            property.getName(), request.checkIn(), request.checkOut(), request.guests());

        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setUiMode(SessionCreateParams.UiMode.EMBEDDED)
            .setRedirectOnCompletion(SessionCreateParams.RedirectOnCompletion.NEVER)
            .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
            // Backstop : la session devient inutilisable peu apres l'expiration du hold
            .setExpiresAt(Instant.now().plusSeconds(SESSION_LIFETIME_MINUTES * 60).getEpochSecond())
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            // Z4A-BUGS-07 : devise de la PROPRIETE (celle enregistree
                            // sur la reservation), pas la devise globale stripe.currency
                            // — sinon le guest paie X EUR mais la resa comptabilise X USD.
                            .setCurrency(resolveCurrency(property))
                            .setUnitAmount(amountInCents)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Réservation: " + property.getName())
                                    .setDescription(description)
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .setCustomerEmail(request.customerEmail())
            .putMetadata("type", "booking_engine")
            .putMetadata("property_id", request.propertyId().toString())
            .putMetadata("organization_id", String.valueOf(property.getOrganizationId()))
            .putMetadata("check_in", request.checkIn())
            .putMetadata("check_out", request.checkOut())
            .putMetadata("guests", String.valueOf(request.guests()))
            .putMetadata("service_options_total", quote.serviceOptionsTotal().toPlainString())
            // Z4A-BUGS-10 : selections d'options (id:qty) pour que le fallback
            // webhook puisse recreer les lignes snapshot si le hold est perdu
            .putMetadata("service_options", serializeServiceOptions(request.serviceOptions()))
            .putMetadata("server_total", quote.totalAmount().toPlainString())
            .putMetadata("reservation_id", hold.getId().toString())
            .build();

        return Session.create(params, stripeOptions);
    }

    /** Devise de la propriete ; repli sur la devise globale si non renseignee. */
    private String resolveCurrency(Property property) {
        String propertyCurrency = property.getDefaultCurrency();
        return (propertyCurrency != null && !propertyCurrency.isBlank())
            ? propertyCurrency.toLowerCase()
            : currency.toLowerCase();
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
