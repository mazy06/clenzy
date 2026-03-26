package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BookingCheckoutRequest;
import com.clenzy.booking.service.BookingServiceOptionsService;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Crée des sessions Stripe Checkout pour les réservations via le booking engine.
 * Utilise le mode embedded (inline dans le preview/SDK).
 */
@RestController
@RequestMapping("/api/booking-engine/checkout")
// Acces public : gere par SecurityConfigProd.java (.requestMatchers("/api/booking-engine/checkout/**").permitAll())
public class BookingCheckoutController {

    private static final Logger log = LoggerFactory.getLogger(BookingCheckoutController.class);

    private final PropertyRepository propertyRepository;
    private final BookingServiceOptionsService serviceOptionsService;
    private final TenantContext tenantContext;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.currency:eur}")
    private String currency;

    public BookingCheckoutController(PropertyRepository propertyRepository,
                                     BookingServiceOptionsService serviceOptionsService,
                                     TenantContext tenantContext) {
        this.propertyRepository = propertyRepository;
        this.serviceOptionsService = serviceOptionsService;
        this.tenantContext = tenantContext;
    }

    @PostMapping("/create-session")
    public ResponseEntity<?> createCheckoutSession(@Valid @RequestBody BookingCheckoutRequest request) {
        try {
            final RequestOptions stripeOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey).build();

            Property property = propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriété introuvable"));
            // Validate cross-tenant: property must belong to the requested organization
            Long orgId = property.getOrganizationId();
            if (!orgId.equals(request.organizationId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Propriété introuvable pour cette organisation"));
            }

            // Compute service options total server-side (never trust client amount)
            java.math.BigDecimal serviceOptionsTotal = java.math.BigDecimal.ZERO;
            if (request.serviceOptions() != null && !request.serviceOptions().isEmpty()) {
                int nights = Math.max(1, (int) java.time.temporal.ChronoUnit.DAYS.between(
                    java.time.LocalDate.parse(request.checkIn()),
                    java.time.LocalDate.parse(request.checkOut())));
                serviceOptionsTotal = serviceOptionsService.computeServiceOptionsTotal(
                    request.serviceOptions(), request.guests(), nights, orgId);
            }

            java.math.BigDecimal totalAmount = request.amount().add(serviceOptionsTotal);
            long amountInCents = totalAmount.multiply(java.math.BigDecimal.valueOf(100)).longValue();

            String description = String.format("%s — %s au %s, %d voyageur(s)",
                property.getName(), request.checkIn(), request.checkOut(), request.guests());

            SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setUiMode(SessionCreateParams.UiMode.EMBEDDED)
                .setRedirectOnCompletion(SessionCreateParams.RedirectOnCompletion.NEVER)
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .addLineItem(
                    SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                            SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(currency.toLowerCase())
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
                .putMetadata("organization_id", String.valueOf(orgId))
                .putMetadata("check_in", request.checkIn())
                .putMetadata("check_out", request.checkOut())
                .putMetadata("guests", String.valueOf(request.guests()))
                .putMetadata("service_options_total", serviceOptionsTotal.toPlainString())
                .build();

            Session session = Session.create(params, stripeOptions);

            log.info("Booking engine checkout session créée: {}, property={}, amount={}, serviceOptions={}",
                session.getId(), request.propertyId(), totalAmount, serviceOptionsTotal);

            return ResponseEntity.ok(Map.of(
                "clientSecret", session.getClientSecret(),
                "sessionId", session.getId()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur création session Stripe booking: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la création du paiement"));
        }
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
