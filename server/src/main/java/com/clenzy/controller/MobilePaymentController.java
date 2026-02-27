package com.clenzy.controller;

import com.clenzy.service.MobilePaymentService;
import com.stripe.exception.StripeException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour les paiements natifs mobiles via Stripe Payment Sheet.
 * Fournit les endpoints necessaires pour initialiser le Payment Sheet
 * (Apple Pay, Google Pay, carte bancaire) directement dans l'application mobile.
 */
@RestController
@RequestMapping("/api/mobile")
@Tag(name = "Mobile Payment", description = "Paiements natifs via Stripe Payment Sheet (Apple Pay, Google Pay)")
@PreAuthorize("isAuthenticated()")
public class MobilePaymentController {

    private static final Logger log = LoggerFactory.getLogger(MobilePaymentController.class);

    private final MobilePaymentService mobilePaymentService;

    @Value("${stripe.publishable-key}")
    private String publishableKey;

    public MobilePaymentController(MobilePaymentService mobilePaymentService) {
        this.mobilePaymentService = mobilePaymentService;
    }

    /**
     * Cree les elements necessaires pour le Payment Sheet natif.
     * Retourne le client secret du PaymentIntent, l'EphemeralKey, le Customer ID
     * et la cle publique Stripe.
     *
     * Request body:
     * - type: "subscription" ou "intervention"
     * - forfait: forfait cible (pour type=subscription, ex: "confort", "premium")
     * - interventionId: ID de l'intervention (pour type=intervention)
     * - amount: montant en centimes (pour type=intervention, optionnel)
     */
    @PostMapping("/payment-sheet")
    @Operation(summary = "Creer un Payment Sheet natif",
            description = "Initialise les elements necessaires pour afficher le Payment Sheet "
                    + "Stripe natif dans l'application mobile (Apple Pay, Google Pay, carte bancaire). "
                    + "Retourne paymentIntent (client secret), ephemeralKey, customer et publishableKey.")
    public ResponseEntity<Map<String, String>> createPaymentSheet(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, Object> body) {

        String type = (String) body.get("type");
        if (type == null || type.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Le champ 'type' est requis (subscription ou intervention)"));
        }

        String forfait = (String) body.get("forfait");
        Long interventionId = body.get("interventionId") != null
                ? ((Number) body.get("interventionId")).longValue() : null;
        Long amount = body.get("amount") != null
                ? ((Number) body.get("amount")).longValue() : null;

        try {
            Map<String, String> result = mobilePaymentService.createPaymentSheet(
                    jwt.getSubject(), type, forfait, interventionId, amount);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("Payment Sheet refuse pour {}: {}", jwt.getSubject(), e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (StripeException e) {
            log.error("Erreur Stripe Payment Sheet pour {}: {}", jwt.getSubject(), e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur de paiement: " + e.getMessage()));
        }
    }

    /**
     * Retourne la cle publique Stripe pour l'initialisation du SDK mobile.
     */
    @GetMapping("/stripe-config")
    @Operation(summary = "Configuration Stripe pour le mobile",
            description = "Retourne la cle publique Stripe necessaire pour initialiser le SDK Stripe React Native.")
    public ResponseEntity<Map<String, String>> getStripeConfig() {
        return ResponseEntity.ok(Map.of("publishableKey", publishableKey));
    }
}
