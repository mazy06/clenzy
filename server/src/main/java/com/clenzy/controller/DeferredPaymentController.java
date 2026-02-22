package com.clenzy.controller;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.service.DeferredPaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/deferred-payments")
@Tag(name = "Deferred Payments", description = "Gestion des paiements differes et cumul des impayes par host")
@PreAuthorize("isAuthenticated()")
public class DeferredPaymentController {

    private static final Logger logger = LoggerFactory.getLogger(DeferredPaymentController.class);

    private final DeferredPaymentService deferredPaymentService;

    public DeferredPaymentController(DeferredPaymentService deferredPaymentService) {
        this.deferredPaymentService = deferredPaymentService;
    }

    /**
     * Retourne le cumul des impayes d'un host, groupe par propriete.
     */
    @GetMapping("/balance/{hostId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Consulter le solde impaye d'un host",
            description = "Retourne le cumul des interventions impayees, groupees par propriete.")
    public ResponseEntity<?> getHostBalance(@PathVariable Long hostId) {
        try {
            HostBalanceSummaryDto summary = deferredPaymentService.getHostBalance(hostId);
            return ResponseEntity.ok(summary);
        } catch (RuntimeException e) {
            logger.error("Erreur lors de la recuperation du solde impaye pour host {}: {}", hostId, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Cree un lien de paiement Stripe groupe pour toutes les interventions impayees du host.
     * L'admin/manager peut ensuite envoyer ce lien au host.
     */
    @PostMapping("/send-payment-link/{hostId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Creer un lien de paiement groupe",
            description = "Cree une session Stripe regroupant toutes les interventions impayees du host. Retourne l'URL de paiement.")
    public ResponseEntity<?> createPaymentLink(@PathVariable Long hostId) {
        try {
            String sessionUrl = deferredPaymentService.createGroupedPaymentSession(hostId);
            return ResponseEntity.ok(Map.of("sessionUrl", sessionUrl));
        } catch (RuntimeException e) {
            logger.warn("Impossible de creer le lien de paiement pour host {}: {}", hostId, e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            logger.error("Erreur Stripe lors de la creation du lien de paiement pour host {}", hostId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la creation de la session Stripe: " + e.getMessage()));
        }
    }
}
