package com.clenzy.controller;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.service.ServiceRequestPaymentService;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.StripeService;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
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

    private final ServiceRequestService service;
    private final StripeService stripeService;
    private final ServiceRequestPaymentService serviceRequestPaymentService;

    public ServiceRequestController(ServiceRequestService service,
                                    StripeService stripeService,
                                    ServiceRequestPaymentService serviceRequestPaymentService) {
        this.service = service;
        this.stripeService = stripeService;
        this.serviceRequestPaymentService = serviceRequestPaymentService;
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
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    @Operation(summary = "Assigner manuellement une demande de service",
               description = "Un admin/manager/host assigne manuellement une équipe ou un utilisateur à une demande en attente.")
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

        List<Map<String, Object>> result = service.getPlanningServiceRequests(
                propertyIds, fromDateTime, toDateTime);

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
            return ResponseEntity.ok(serviceRequestPaymentService.checkPaymentStatus(id));
        } catch (Exception e) {
            log.error("Erreur check payment SR {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la verification: " + e.getMessage()));
        }
    }
}
