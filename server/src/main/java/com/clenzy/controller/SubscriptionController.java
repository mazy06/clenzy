package com.clenzy.controller;

import com.clenzy.service.SubscriptionService;
import com.stripe.exception.StripeException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/subscription")
@Tag(name = "Subscription", description = "Gestion des abonnements et upgrades de forfait")
@PreAuthorize("isAuthenticated()")
public class SubscriptionController {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionController.class);

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @PostMapping("/upgrade")
    @Operation(summary = "Upgrader son forfait",
            description = "Cree une session Stripe Checkout pour passer a un forfait superieur. "
                    + "Retourne l'URL de checkout pour rediriger l'utilisateur.")
    public ResponseEntity<Map<String, String>> upgrade(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, String> body) {

        String targetForfait = body.get("targetForfait");
        if (targetForfait == null || targetForfait.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Le champ targetForfait est requis"));
        }

        try {
            Map<String, String> result = subscriptionService.createUpgradeCheckout(jwt.getSubject(), targetForfait);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("Upgrade refuse pour {}: {}", jwt.getSubject(), e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (StripeException e) {
            log.error("Erreur Stripe pour upgrade de {}: {}", jwt.getSubject(), e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur de paiement: " + e.getMessage()));
        }
    }
}
