package com.clenzy.controller;

import com.clenzy.dto.PaymentHistoryDto;
import com.clenzy.dto.PaymentSessionRequest;
import com.clenzy.dto.PaymentSessionResponse;
import com.clenzy.dto.PaymentSummaryDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.StripeService;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentController.class);

    private final StripeService stripeService;
    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Autowired
    public PaymentController(StripeService stripeService,
                              InterventionRepository interventionRepository,
                              UserRepository userRepository,
                              TenantContext tenantContext) {
        this.stripeService = stripeService;
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }
    
    /**
     * Crée une session de paiement Stripe pour une intervention
     */
    @PostMapping("/create-session")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'HOST')")
    public ResponseEntity<?> createPaymentSession(
            @Valid @RequestBody PaymentSessionRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            // Vérifier que l'intervention existe et appartient à l'utilisateur
            Intervention intervention = interventionRepository.findById(request.getInterventionId())
                .orElseThrow(() -> new RuntimeException("Intervention non trouvée"));
            
            // Vérifier que l'intervention est en attente de paiement
            if (intervention.getStatus() != com.clenzy.model.InterventionStatus.AWAITING_PAYMENT) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention n'est pas en attente de paiement. Statut actuel: " + intervention.getStatus());
            }
            
            // Vérifier que l'intervention n'est pas déjà payée
            if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention est déjà payée");
            }
            
            // Vérifier que le montant correspond
            if (intervention.getEstimatedCost() == null || 
                intervention.getEstimatedCost().compareTo(request.getAmount()) != 0) {
                return ResponseEntity.badRequest()
                    .body("Le montant ne correspond pas au coût estimé de l'intervention");
            }
            
            // Récupérer l'email de l'utilisateur depuis le JWT
            String customerEmail = jwt.getClaimAsString("email");
            if (customerEmail == null || customerEmail.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("Email utilisateur non trouvé");
            }
            
            // Créer la session de paiement
            Session session = stripeService.createCheckoutSession(
                request.getInterventionId(),
                request.getAmount(),
                customerEmail
            );
            
            PaymentSessionResponse response = new PaymentSessionResponse();
            response.setSessionId(session.getId());
            response.setUrl(session.getUrl());
            response.setInterventionId(intervention.getId());
            
            return ResponseEntity.ok(response);
            
        } catch (StripeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Erreur lors de la création de la session de paiement: " + e.getMessage());
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
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'HOST')")
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
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'HOST')")
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

            Page<Intervention> interventionPage;

            if (currentUser.getRole() == UserRole.HOST) {
                // HOST : force ses propres interventions
                interventionPage = interventionRepository.findPaymentHistoryByRequestor(
                        currentUser.getId(), paymentStatus, pageable, tenantContext.getRequiredOrganizationId());
            } else {
                // ADMIN / MANAGER : toutes, optionnellement filtrees par host
                interventionPage = interventionRepository.findPaymentHistory(
                        paymentStatus, hostId, pageable, tenantContext.getRequiredOrganizationId());
            }

            // Mapper vers DTOs
            Page<PaymentHistoryDto> dtoPage = interventionPage.map(this::toPaymentHistoryDto);

            return ResponseEntity.ok(dtoPage);
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
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'HOST')")
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

            // Requete avec toutes les interventions payantes, paginee large
            Pageable all = PageRequest.of(0, 10000);
            Page<Intervention> interventions;
            if (effectiveHostId != null) {
                interventions = interventionRepository.findPaymentHistoryByRequestor(effectiveHostId, null, all, tenantContext.getRequiredOrganizationId());
            } else {
                interventions = interventionRepository.findPaymentHistory(null, null, all, tenantContext.getRequiredOrganizationId());
            }

            PaymentSummaryDto summary = new PaymentSummaryDto();
            summary.transactionCount = (int) interventions.getTotalElements();

            for (Intervention i : interventions.getContent()) {
                BigDecimal cost = i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO;
                PaymentStatus ps = i.getPaymentStatus();
                if (ps == PaymentStatus.PAID) {
                    summary.totalPaid = summary.totalPaid.add(cost);
                } else if (ps == PaymentStatus.REFUNDED) {
                    summary.totalRefunded = summary.totalRefunded.add(cost);
                } else {
                    // PENDING, PROCESSING, FAILED, CANCELLED → totalPending
                    summary.totalPending = summary.totalPending.add(cost);
                }
            }

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
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
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
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
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
            user = userRepository.findByEmail(email).orElse(null);
        }
        return user;
    }

    private PaymentHistoryDto toPaymentHistoryDto(Intervention i) {
        PaymentHistoryDto dto = new PaymentHistoryDto();
        dto.id = i.getId();
        dto.interventionId = i.getId();
        dto.interventionTitle = i.getTitle();
        dto.propertyName = i.getProperty() != null ? i.getProperty().getName() : "N/A";
        dto.amount = i.getEstimatedCost();
        dto.status = i.getPaymentStatus() != null ? i.getPaymentStatus().name() : "PENDING";
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
}
