package com.clenzy.controller;

import com.clenzy.dto.*;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.StripeService;
import com.clenzy.util.StringUtils;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payments")
@PreAuthorize("isAuthenticated()")
public class PaymentController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentController.class);

    private final StripeService stripeService;
    private final PaymentOrchestrationService orchestrationService;
    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    public PaymentController(StripeService stripeService,
                              PaymentOrchestrationService orchestrationService,
                              InterventionRepository interventionRepository,
                              ReservationRepository reservationRepository,
                              UserRepository userRepository,
                              TenantContext tenantContext) {
        this.stripeService = stripeService;
        this.orchestrationService = orchestrationService;
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
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
            // Vérifier que l'intervention existe et appartient à l'utilisateur
            Intervention intervention = interventionRepository.findById(request.getInterventionId())
                .orElseThrow(() -> new RuntimeException("Intervention non trouvée"));
            
            // Vérifier que l'intervention n'est pas annulée ou déjà terminée sans paiement
            var blockedStatuses = java.util.EnumSet.of(
                com.clenzy.model.InterventionStatus.CANCELLED,
                com.clenzy.model.InterventionStatus.COMPLETED
            );
            if (blockedStatuses.contains(intervention.getStatus())) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention ne peut pas être payée. Statut actuel: " + intervention.getStatus());
            }

            // Vérifier que l'intervention n'est pas déjà payée
            if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention est déjà payée");
            }
            
            // Récupérer l'email de l'utilisateur depuis le JWT
            String customerEmail = jwt.getClaimAsString("email");
            if (customerEmail == null || customerEmail.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("Email utilisateur non trouvé");
            }
            
            // Route all payments through the orchestrator (multi-provider)
            String currency = intervention.getCurrency() != null ? intervention.getCurrency() : "EUR";
            String idempotencyKey = "INT-" + request.getInterventionId();

            PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
                request.getAmount(),
                currency,
                "INTERVENTION",
                request.getInterventionId(),
                "Paiement intervention #" + request.getInterventionId(),
                customerEmail,
                null, // no preferred provider — orchestrator resolves automatically
                null, // successUrl — provider uses its config defaults
                null, // cancelUrl — provider uses its config defaults
                Map.of("interventionId", String.valueOf(request.getInterventionId())),
                idempotencyKey
            );

            PaymentOrchestrationResult orchResult = orchestrationService.initiatePayment(orchRequest);

            if (!orchResult.isSuccess()) {
                String errMsg = orchResult.paymentResult() != null
                    ? orchResult.paymentResult().errorMessage() : "Erreur orchestration paiement";
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Erreur orchestration: " + errMsg);
            }

            // Update intervention with provider session info
            if (orchResult.paymentResult().providerTxId() != null) {
                intervention.setStripeSessionId(orchResult.paymentResult().providerTxId());
            }
            intervention.setPaymentStatus(PaymentStatus.PROCESSING);
            interventionRepository.save(intervention);

            PaymentSessionResponse response = new PaymentSessionResponse();
            response.setSessionId(orchResult.paymentResult().providerTxId());
            response.setUrl(orchResult.paymentResult().redirectUrl());
            response.setInterventionId(intervention.getId());

            return ResponseEntity.ok(response);

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
            Intervention intervention = interventionRepository.findById(request.getInterventionId())
                .orElseThrow(() -> new RuntimeException("Intervention non trouvee"));

            // Vérifier que l'intervention n'est pas annulée ou déjà terminée
            var embeddedBlockedStatuses = java.util.EnumSet.of(
                com.clenzy.model.InterventionStatus.CANCELLED,
                com.clenzy.model.InterventionStatus.COMPLETED
            );
            if (embeddedBlockedStatuses.contains(intervention.getStatus())) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention ne peut pas etre payee. Statut actuel: " + intervention.getStatus());
            }

            if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention est deja payee");
            }

            String customerEmail = jwt.getClaimAsString("email");
            if (customerEmail == null || customerEmail.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("Email utilisateur non trouve");
            }

            Session session = stripeService.createEmbeddedCheckoutSession(
                request.getInterventionId(),
                request.getAmount(),
                customerEmail
            );

            PaymentSessionResponse response = new PaymentSessionResponse();
            response.setSessionId(session.getId());
            response.setClientSecret(session.getClientSecret());
            response.setInterventionId(intervention.getId());

            return ResponseEntity.ok(response);

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
     * Si le paiement est encore en PROCESSING, interroge directement l'API Stripe
     * pour vérifier si la session a été payée (fallback si le webhook n'a pas été reçu).
     */
    @GetMapping("/session-status/{sessionId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<?> getSessionStatus(@PathVariable String sessionId) {
        try {
            Intervention intervention = interventionRepository.findByStripeSessionId(sessionId, tenantContext.getRequiredOrganizationId())
                .orElseThrow(() -> new RuntimeException("Intervention non trouvée pour cette session"));

            // Si encore en PROCESSING, vérifier directement auprès de Stripe
            if (intervention.getPaymentStatus() == PaymentStatus.PROCESSING) {
                try {
                    Stripe.apiKey = stripeSecretKey;
                    Session stripeSession = Session.retrieve(sessionId);
                    if ("paid".equals(stripeSession.getPaymentStatus())) {
                        // Le webhook n'a pas encore été traité, on confirme manuellement
                        logger.info("Fallback: confirmation manuelle du paiement pour session {}", sessionId);
                        stripeService.confirmPayment(sessionId);
                        // Recharger l'intervention après confirmation
                        intervention = interventionRepository.findByStripeSessionId(sessionId, tenantContext.getRequiredOrganizationId())
                            .orElse(intervention);
                    }
                } catch (StripeException e) {
                    logger.warn("Impossible de vérifier la session Stripe {}: {}", sessionId, e.getMessage());
                }
            }

            return ResponseEntity.ok(Map.of(
                "paymentStatus", intervention.getPaymentStatus().name(),
                "interventionStatus", intervention.getStatus().name()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Session non trouvée: " + e.getMessage()));
        }
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
            Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

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
            User currentUser = resolveCurrentUser(jwt);
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Utilisateur non trouve"));
            }

            Long orgId = tenantContext.getRequiredOrganizationId();

            // ── 1) Charger les interventions ────────────────────────────────────
            // Use a large page to merge with reservations — real pagination is done below
            Pageable largePage = PageRequest.of(0, 10000, Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<Intervention> interventionPage;

            if (currentUser.getRole() == UserRole.HOST) {
                interventionPage = interventionRepository.findPaymentHistoryByRequestor(
                        currentUser.getId(), paymentStatus, largePage, orgId);
            } else {
                interventionPage = interventionRepository.findPaymentHistory(
                        paymentStatus, hostId, largePage, orgId);
            }

            // ── 2) Charger les reservations ─────────────────────────────────────
            Page<Reservation> reservationPage = reservationRepository.findPaymentHistory(
                    paymentStatus, largePage, orgId);

            // ── 3) Fusionner en DTOs, trier par date desc, paginer ─────────────
            List<PaymentHistoryDto> merged = new ArrayList<>();
            interventionPage.getContent().forEach(i -> merged.add(toPaymentHistoryDto(i)));
            reservationPage.getContent().forEach(r -> merged.add(toReservationPaymentDto(r)));

            // Trier par transactionDate DESC
            merged.sort(Comparator.comparing(
                (PaymentHistoryDto d) -> d.transactionDate != null ? d.transactionDate : "",
                Comparator.reverseOrder()));

            // Pagination manuelle
            int start = page * size;
            int end = Math.min(start + size, merged.size());
            List<PaymentHistoryDto> pageContent = start < merged.size()
                    ? merged.subList(start, end) : List.of();

            Map<String, Object> result = Map.of(
                "content", pageContent,
                "totalElements", merged.size(),
                "totalPages", (int) Math.ceil((double) merged.size() / size),
                "number", page,
                "size", size
            );

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
            User currentUser = resolveCurrentUser(jwt);
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Utilisateur non trouve"));
            }

            // HOST : force son propre ID
            Long effectiveHostId = (currentUser.getRole() == UserRole.HOST) ? currentUser.getId() : hostId;
            Long orgId = tenantContext.getRequiredOrganizationId();

            // Requete avec toutes les interventions payantes, paginee large
            Pageable all = PageRequest.of(0, 10000);
            Page<Intervention> interventions;
            if (effectiveHostId != null) {
                interventions = interventionRepository.findPaymentHistoryByRequestor(effectiveHostId, null, all, orgId);
            } else {
                interventions = interventionRepository.findPaymentHistory(null, null, all, orgId);
            }

            PaymentSummaryDto summary = new PaymentSummaryDto();

            // Additionner les interventions
            for (Intervention i : interventions.getContent()) {
                BigDecimal cost = i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO;
                PaymentStatus ps = i.getPaymentStatus();
                if (ps == PaymentStatus.PAID) {
                    summary.totalPaid = summary.totalPaid.add(cost);
                } else if (ps == PaymentStatus.REFUNDED) {
                    summary.totalRefunded = summary.totalRefunded.add(cost);
                } else {
                    summary.totalPending = summary.totalPending.add(cost);
                }
            }

            // Additionner les reservations
            List<Reservation> reservations = reservationRepository.findAllWithPayment(orgId);
            for (Reservation r : reservations) {
                BigDecimal cost = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
                PaymentStatus ps = r.getPaymentStatus();
                if (ps == PaymentStatus.PAID) {
                    summary.totalPaid = summary.totalPaid.add(cost);
                } else if (ps == PaymentStatus.REFUNDED) {
                    summary.totalRefunded = summary.totalRefunded.add(cost);
                } else {
                    summary.totalPending = summary.totalPending.add(cost);
                }
            }

            summary.transactionCount = (int) interventions.getTotalElements() + reservations.size();

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
            List<Object[]> rows = interventionRepository.findDistinctHostsWithPayments(tenantContext.getRequiredOrganizationId());
            List<Map<String, Object>> hosts = rows.stream().map(row -> Map.<String, Object>of(
                    "id", row[0],
                    "fullName", row[1] + " " + row[2]
            )).collect(Collectors.toList());
            return ResponseEntity.ok(hosts);
        } catch (Exception e) {
            logger.error("Erreur getHostsWithPayments", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur: " + e.getMessage()));
        }
    }

    // ─── Remboursement ─────────────────────────────────────────────────────────

    /**
     * Rembourse un paiement via Stripe. Reservé aux ADMIN et MANAGER.
     */
    @PostMapping("/{interventionId}/refund")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> refundPayment(@PathVariable Long interventionId) {
        try {
            Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new RuntimeException("Intervention non trouvée"));

            if (intervention.getPaymentStatus() != PaymentStatus.PAID) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Seuls les paiements confirmés peuvent être remboursés. Statut actuel: " + intervention.getPaymentStatus()));
            }

            stripeService.refundPayment(interventionId);

            return ResponseEntity.ok(Map.of("message", "Remboursement effectué avec succès"));
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

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private User resolveCurrentUser(Jwt jwt) {
        String keycloakId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        User user = null;
        if (keycloakId != null) {
            user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        }
        if (user == null && email != null) {
            user = userRepository.findByEmailHash(StringUtils.computeEmailHash(email)).orElse(null);
        }
        return user;
    }

    private PaymentHistoryDto toPaymentHistoryDto(Intervention i) {
        PaymentHistoryDto dto = new PaymentHistoryDto();
        dto.id = i.getId();
        dto.referenceId = i.getId();
        dto.description = i.getTitle();
        dto.propertyName = i.getProperty() != null ? i.getProperty().getName() : "N/A";
        dto.amount = i.getEstimatedCost();
        dto.status = i.getPaymentStatus() != null ? i.getPaymentStatus().name() : "PENDING";
        dto.type = "INTERVENTION";
        dto.stripeSessionId = i.getStripeSessionId();
        // transactionDate : paidAt si PAID, sinon startTime ou createdAt
        if (i.getPaidAt() != null) {
            dto.transactionDate = i.getPaidAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } else if (i.getStartTime() != null) {
            dto.transactionDate = i.getStartTime().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } else if (i.getCreatedAt() != null) {
            dto.transactionDate = i.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
        dto.createdAt = i.getCreatedAt() != null ? i.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null;
        // Host info
        if (i.getRequestor() != null) {
            dto.hostId = i.getRequestor().getId();
            dto.hostName = i.getRequestor().getFullName();
        }
        return dto;
    }

    private PaymentHistoryDto toReservationPaymentDto(Reservation r) {
        PaymentHistoryDto dto = new PaymentHistoryDto();
        dto.id = r.getId();
        dto.referenceId = r.getId();
        dto.description = "Reservation — " + (r.getProperty() != null ? r.getProperty().getName() : "N/A")
                + " (" + (r.getGuestName() != null ? r.getGuestName() : "N/A") + ")";
        dto.propertyName = r.getProperty() != null ? r.getProperty().getName() : "N/A";
        dto.amount = r.getTotalPrice();
        dto.currency = r.getCurrency() != null ? r.getCurrency() : "EUR";
        dto.status = r.getPaymentStatus() != null ? r.getPaymentStatus().name() : "PENDING";
        dto.type = "RESERVATION";
        dto.stripeSessionId = r.getStripeSessionId();
        // transactionDate : paidAt si PAID, sinon createdAt
        if (r.getPaidAt() != null) {
            dto.transactionDate = r.getPaidAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } else if (r.getCreatedAt() != null) {
            dto.transactionDate = r.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
        dto.createdAt = r.getCreatedAt() != null ? r.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null;
        // Guest name as hostName for display
        dto.hostName = r.getGuestName();
        dto.hostId = null; // reservations don't have a host user
        return dto;
    }

}
