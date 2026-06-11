package com.clenzy.controller;

import com.clenzy.dto.PaymentSessionRequest;
import com.clenzy.dto.PaymentSessionResponse;
import com.clenzy.dto.PaymentSummaryDto;
import com.clenzy.exception.PaymentProcessingException;
import com.clenzy.exception.PaymentValidationException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.service.InterventionPaymentService;
import com.clenzy.service.PaymentQueryService;
import com.clenzy.service.PaymentTransactionService;
import com.stripe.exception.StripeException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Endpoints REST des paiements PMS (interventions, historique, resume,
 * statut de session/transaction, remboursement).
 *
 * <p>Refactor T-ARCH-01 : controller mince — validation d'entree, delegation
 * aux services ({@link InterventionPaymentService}, {@link PaymentQueryService},
 * {@link PaymentTransactionService}) et mapping HTTP. Aucun acces repository.</p>
 */
@RestController
@RequestMapping("/api/payments")
@PreAuthorize("isAuthenticated()")
public class PaymentController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentController.class);

    private final InterventionPaymentService interventionPaymentService;
    private final PaymentQueryService paymentQueryService;
    private final PaymentTransactionService paymentTransactionService;

    public PaymentController(InterventionPaymentService interventionPaymentService,
                             PaymentQueryService paymentQueryService,
                             PaymentTransactionService paymentTransactionService) {
        this.interventionPaymentService = interventionPaymentService;
        this.paymentQueryService = paymentQueryService;
        this.paymentTransactionService = paymentTransactionService;
    }

    /**
     * Crée une session de paiement Stripe pour une intervention
     */
    @PostMapping("/create-session")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<?> createPaymentSession(
            @Valid @RequestBody PaymentSessionRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            String customerEmail = jwt.getClaimAsString("email");
            PaymentSessionResponse response = interventionPaymentService
                .createPaymentSession(request, customerEmail);
            return ResponseEntity.ok(response);
        } catch (AccessDeniedException e) {
            throw e; // 403 via Spring Security — ne pas convertir en 500
        } catch (PaymentValidationException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (PaymentProcessingException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        } catch (Exception e) {
            logger.error("Erreur lors de la création de la session de paiement", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Erreur: " + e.getMessage());
        }
    }

    /**
     * Cree une session de paiement Stripe en mode EMBEDDED (inline).
     * Retourne un clientSecret pour le composant EmbeddedCheckout cote frontend.
     */
    @PostMapping("/create-embedded-session")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<?> createEmbeddedPaymentSession(
            @Valid @RequestBody PaymentSessionRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            String customerEmail = jwt.getClaimAsString("email");
            PaymentSessionResponse response = interventionPaymentService
                .createEmbeddedPaymentSession(request, customerEmail);
            return ResponseEntity.ok(response);
        } catch (AccessDeniedException e) {
            throw e; // 403 via Spring Security — ne pas convertir en 500
        } catch (PaymentValidationException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (StripeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Erreur lors de la creation de la session embedded: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Erreur: " + e.getMessage());
        }
    }

    /**
     * Vérifie le statut d'une session de paiement.
     * Si le paiement est encore en PROCESSING, le service interroge directement
     * l'API Stripe pour vérifier si la session a été payée (fallback webhook).
     */
    @GetMapping("/session-status/{sessionId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<?> getSessionStatus(@PathVariable String sessionId) {
        return paymentQueryService.getSessionStatus(sessionId)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Aucun paiement trouvé pour cette session: " + sessionId)));
    }

    /**
     * Statut d'une transaction provider-agnostique.
     *
     * <p>Endpoint canonique pour les nouveaux flows (PayTabs, CMI, et tout
     * provider qui ne s'appuie pas sur Stripe Checkout Session). Le polling
     * frontend apres redirect doit utiliser cet endpoint avec le
     * {@code transactionRef} retourne par {@code /create-session}.</p>
     *
     * <p>{@link #getSessionStatus(String)} reste disponible pour la
     * compatibilite Stripe legacy (lookup par {@code stripeSessionId}).</p>
     */
    @GetMapping("/transaction-status/{transactionRef}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<?> getTransactionStatus(@PathVariable String transactionRef) {
        var tx = paymentTransactionService.findByTransactionRefInCurrentOrg(transactionRef).orElse(null);
        if (tx == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Transaction introuvable: " + transactionRef));
        }
        return ResponseEntity.ok(Map.of(
            "transactionRef", tx.getTransactionRef(),
            "providerType", tx.getProviderType().name(),
            "status", tx.getStatus().name(),
            "amount", tx.getAmount(),
            "currency", tx.getCurrency(),
            "sourceType", tx.getSourceType() != null ? tx.getSourceType() : "",
            "sourceId", tx.getSourceId() != null ? tx.getSourceId() : 0L
        ));
    }

    // ─── Historique des paiements ────────────────────────────────────────────────

    /**
     * Retourne l'historique des paiements pagine.
     * HOST : voit uniquement ses propres interventions.
     * ADMIN/MANAGER : voit toutes les interventions, optionnellement filtrees par hostId.
     */
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<?> getPaymentHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long hostId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            // Resoudre le PaymentStatus optionnel
            PaymentStatus paymentStatus = null;
            if (status != null && !status.isBlank()) {
                try {
                    paymentStatus = PaymentStatus.fromString(status);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Statut de paiement invalide: " + status));
                }
            }

            // Determiner le role de l'utilisateur
            User currentUser = paymentQueryService.resolveCurrentUser(
                jwt.getSubject(), jwt.getClaimAsString("email"));
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Utilisateur non trouve"));
            }

            Map<String, Object> result = paymentQueryService.getPaymentHistory(
                currentUser, paymentStatus, hostId, page, size);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Erreur getPaymentHistory", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur: " + e.getMessage()));
        }
    }

    /**
     * Retourne un resume agrege des paiements.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<?> getPaymentSummary(
            @RequestParam(required = false) Long hostId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            User currentUser = paymentQueryService.resolveCurrentUser(
                jwt.getSubject(), jwt.getClaimAsString("email"));
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Utilisateur non trouve"));
            }

            PaymentSummaryDto summary = paymentQueryService.getPaymentSummary(currentUser, hostId);

            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            logger.error("Erreur getPaymentSummary", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur: " + e.getMessage()));
        }
    }

    /**
     * Liste legere des hosts ayant des interventions payantes (pour le filtre admin).
     */
    @GetMapping("/hosts")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> getHostsWithPayments() {
        try {
            return ResponseEntity.ok(paymentQueryService.getHostsWithPayments());
        } catch (Exception e) {
            logger.error("Erreur getHostsWithPayments", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur: " + e.getMessage()));
        }
    }

    // ─── Remboursement ─────────────────────────────────────────────────────────

    /**
     * Rembourse un paiement d'intervention. Reserve aux ADMIN et MANAGER.
     * Voir {@link InterventionPaymentService#refundIntervention(Long)} pour le
     * routage provider-agnostique + fallback legacy Stripe.
     */
    @PostMapping("/{interventionId}/refund")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> refundPayment(@PathVariable Long interventionId) {
        try {
            return ResponseEntity.ok(interventionPaymentService.refundIntervention(interventionId));
        } catch (AccessDeniedException e) {
            throw e; // 403 via Spring Security — ne pas convertir en 500
        } catch (PaymentValidationException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (PaymentProcessingException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", e.getMessage()));
        } catch (StripeException e) {
            logger.error("Erreur Stripe lors du remboursement de l'intervention {}", interventionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur Stripe: " + e.getMessage()));
        } catch (Exception e) {
            logger.error("Erreur lors du remboursement de l'intervention {}", interventionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur: " + e.getMessage()));
        }
    }
}
