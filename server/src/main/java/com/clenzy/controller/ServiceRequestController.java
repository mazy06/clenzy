package com.clenzy.controller;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.model.PaymentStatus;
import com.clenzy.service.StripeService;
import com.clenzy.tenant.TenantContext;
import com.stripe.Stripe;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import com.clenzy.dto.validation.Create;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/service-requests")
@Tag(name = "Service Requests", description = "Gestion des demandes de service")
@PreAuthorize("isAuthenticated()")
public class ServiceRequestController {
    private static final Logger log = LoggerFactory.getLogger(ServiceRequestController.class);

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    private final ServiceRequestService service;
    private final StripeService stripeService;
    private final ServiceRequestRepository serviceRequestRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TenantContext tenantContext;

    public ServiceRequestController(ServiceRequestService service,
                                    StripeService stripeService,
                                    ServiceRequestRepository serviceRequestRepository,
                                    UserRepository userRepository,
                                    TeamRepository teamRepository,
                                    TenantContext tenantContext) {
        this.service = service;
        this.stripeService = stripeService;
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.tenantContext = tenantContext;
    }

    @PostMapping
    @Operation(summary = "Créer une demande de service")
    public ResponseEntity<ServiceRequestDto> create(@Validated(Create.class) @RequestBody ServiceRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Mettre à jour une demande de service")
    public ServiceRequestDto update(@PathVariable Long id, @RequestBody ServiceRequestDto dto) {
        return service.update(id, dto);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    @Operation(summary = "Obtenir une demande de service par ID")
    public ServiceRequestDto get(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping
    @Operation(summary = "Lister les demandes de service")
    public Page<ServiceRequestDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                        @RequestParam(required = false) Long userId,
                                        @RequestParam(required = false) Long propertyId,
                                        @RequestParam(required = false) Long reservationId,
                                        @RequestParam(required = false) com.clenzy.model.RequestStatus status,
                                        @RequestParam(required = false) com.clenzy.model.ServiceType serviceType,
                                        @AuthenticationPrincipal Jwt jwt) {
        return service.searchWithRoleBasedAccess(pageable, userId, propertyId, reservationId, status, serviceType, jwt);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Supprimer une demande de service")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/refuse")
    @Operation(summary = "Refuser une assignation",
               description = "L'équipe ou l'utilisateur assigné refuse la demande de service. " +
                           "La demande revient en PENDING et une re-assignation est tentée automatiquement.")
    public ResponseEntity<ServiceRequestDto> refuse(@PathVariable Long id) {
        ServiceRequestDto result = service.refuse(id);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Assigner manuellement une demande de service",
               description = "Un admin/manager assigne manuellement une équipe ou un utilisateur à une demande en attente.")
    public ResponseEntity<ServiceRequestDto> manualAssign(
            @PathVariable Long id,
            @RequestParam Long assignedToId,
            @RequestParam String assignedToType) {
        ServiceRequestDto result = service.manualAssign(id, assignedToId, assignedToType);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/planning")
    @Operation(summary = "SR en attente de paiement pour le planning",
               description = "Retourne les demandes de service en AWAITING_PAYMENT pour affichage sur le Gantt.")
    public ResponseEntity<List<Map<String, Object>>> getPlanningServiceRequests(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) List<Long> propertyIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        if (from == null) from = LocalDate.now().minusMonths(3);
        if (to == null) to = LocalDate.now().plusMonths(6);

        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<ServiceRequest> srList;
        if (propertyIds != null && !propertyIds.isEmpty()) {
            srList = serviceRequestRepository.findByStatusAndPropertyIdsAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, propertyIds, fromDateTime, toDateTime, orgId);
        } else {
            srList = serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, fromDateTime, toDateTime, orgId);
        }

        // Pre-load team names to avoid N+1
        List<Long> teamIds = srList.stream()
                .filter(sr -> "team".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null)
                .map(ServiceRequest::getAssignedToId)
                .distinct()
                .collect(Collectors.toList());
        final Map<Long, String> teamNameMap = !teamIds.isEmpty()
                ? teamRepository.findAllById(teamIds).stream()
                    .collect(Collectors.toMap(Team::getId, Team::getName, (a, b) -> a))
                : Map.of();

        // Pre-load user names
        List<Long> userIds = srList.stream()
                .filter(sr -> "user".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null)
                .map(ServiceRequest::getAssignedToId)
                .distinct()
                .collect(Collectors.toList());
        final Map<Long, String> userNameMap = !userIds.isEmpty()
                ? userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId,
                        u -> (u.getFirstName() + " " + u.getLastName()).trim(), (a, b) -> a))
                : Map.of();

        List<Map<String, Object>> result = srList.stream().map(sr -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", sr.getId());
            map.put("propertyId", sr.getProperty() != null ? sr.getProperty().getId() : null);
            map.put("propertyName", sr.getProperty() != null ? sr.getProperty().getName() : "");
            map.put("serviceType", sr.getServiceType() != null ? sr.getServiceType().name() : null);
            map.put("title", sr.getTitle());
            map.put("status", "AWAITING_PAYMENT");
            map.put("estimatedDurationHours", sr.getEstimatedDurationHours());
            map.put("estimatedCost", sr.getEstimatedCost());

            // Resolve assignee name
            String assigneeName = null;
            if ("user".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null) {
                assigneeName = userNameMap.getOrDefault(sr.getAssignedToId(), "Utilisateur #" + sr.getAssignedToId());
            } else if ("team".equals(sr.getAssignedToType()) && sr.getAssignedToId() != null) {
                assigneeName = teamNameMap.getOrDefault(sr.getAssignedToId(), "Équipe #" + sr.getAssignedToId());
            }
            map.put("assignedToName", assigneeName);

            // Date/time from desiredDate
            if (sr.getDesiredDate() != null) {
                map.put("startDate", sr.getDesiredDate().toLocalDate().toString());
                map.put("startTime", sr.getDesiredDate().toLocalTime().toString());
                if (sr.getEstimatedDurationHours() != null) {
                    LocalTime endTime = sr.getDesiredDate().toLocalTime()
                            .plusHours(sr.getEstimatedDurationHours());
                    map.put("endTime", endTime.toString());
                } else {
                    map.put("endTime", null);
                }
            } else {
                map.put("startDate", null);
                map.put("startTime", null);
                map.put("endTime", null);
            }

            // Linked reservation
            map.put("reservationId", sr.getReservationId());

            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/create-payment-session")
    @Operation(summary = "Créer une session de paiement Stripe pour la demande de service",
               description = "Le demandeur paie le montant estimé de la demande de service. " +
                           "La demande doit être en statut AWAITING_PAYMENT. Retourne l'URL de paiement Stripe.")
    public ResponseEntity<Map<String, String>> createPaymentSession(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            String email = jwt.getClaimAsString("email");
            Session session = stripeService.createServiceRequestCheckoutSession(id, email);
            return ResponseEntity.ok(Map.of("checkoutUrl", session.getUrl()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/create-embedded-session")
    @Operation(summary = "Créer une session de paiement Stripe embedded pour la demande de service",
               description = "Retourne un clientSecret pour le composant EmbeddedCheckout cote frontend.")
    public ResponseEntity<?> createEmbeddedPaymentSession(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            String email = jwt.getClaimAsString("email");
            Session session = stripeService.createServiceRequestEmbeddedCheckoutSession(id, email);
            return ResponseEntity.ok(Map.of(
                "sessionId", session.getId(),
                "clientSecret", session.getClientSecret()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/check-payment")
    @Operation(summary = "Verifier le statut du paiement Stripe pour une SR",
               description = "Verifie directement aupres de Stripe si le paiement a ete effectue. " +
                       "Confirme automatiquement + cree l'intervention si Stripe indique paid.")
    public ResponseEntity<?> checkPaymentStatus(@PathVariable Long id) {
        try {
            ServiceRequest sr = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Demande de service non trouvee: " + id));

            // Already paid?
            if (sr.getPaymentStatus() == PaymentStatus.PAID) {
                return ResponseEntity.ok(Map.of(
                    "paymentStatus", "PAID",
                    "message", "Paiement deja confirme"
                ));
            }

            String sessionId = sr.getStripeSessionId();
            if (sessionId == null || sessionId.isBlank()) {
                return ResponseEntity.ok(Map.of(
                    "paymentStatus", "NO_SESSION",
                    "message", "Aucune session de paiement Stripe associee"
                ));
            }

            // Query Stripe API directly
            Stripe.apiKey = stripeSecretKey;
            Session stripeSession = Session.retrieve(sessionId);
            String stripePaymentStatus = stripeSession.getPaymentStatus();

            log.info("Check payment SR {}: Stripe session {} paymentStatus={}",
                    id, sessionId, stripePaymentStatus);

            if ("paid".equals(stripePaymentStatus)) {
                // Webhook missed — confirm manually (creates intervention too)
                stripeService.confirmServiceRequestPayment(sessionId);
                return ResponseEntity.ok(Map.of(
                    "paymentStatus", "PAID",
                    "message", "Paiement confirme (webhook rattrape)"
                ));
            } else {
                return ResponseEntity.ok(Map.of(
                    "paymentStatus", stripePaymentStatus != null ? stripePaymentStatus.toUpperCase() : "UNKNOWN",
                    "message", "Paiement non encore confirme sur Stripe"
                ));
            }
        } catch (Exception e) {
            log.error("Erreur check payment SR {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la verification: " + e.getMessage()));
        }
    }
}


