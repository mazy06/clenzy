package com.clenzy.controller;

import com.clenzy.dto.SecurityDepositDto;
import com.clenzy.dto.SecurityDepositRequests.Capture;
import com.clenzy.dto.SecurityDepositRequests.Create;
import com.clenzy.service.SecurityDepositPaymentService;
import com.clenzy.service.SecurityDepositService;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Caution / dépôt de garantie (Phase 4) — controller mince (audit #4) : délègue au
 * {@link SecurityDepositService} qui valide l'ownership et applique les transitions par CAS.
 */
@RestController
@RequestMapping("/api/security-deposits")
@PreAuthorize("isAuthenticated()")
public class SecurityDepositController {

    private final SecurityDepositService service;
    private final SecurityDepositPaymentService paymentService;
    private final TenantContext tenantContext;
    private final OrganizationService organizationAccess;

    public SecurityDepositController(SecurityDepositService service,
                                     SecurityDepositPaymentService paymentService,
                                     TenantContext tenantContext, OrganizationService organizationAccess) {
        this.service = service;
        this.paymentService = paymentService;
        this.tenantContext = tenantContext;
        this.organizationAccess = organizationAccess;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<SecurityDepositDto> create(@RequestBody Create request, @AuthenticationPrincipal Jwt jwt) {
        Long orgId = requireManager(jwt);
        return ResponseEntity.ok(
            service.create(orgId, request.reservationId(), request.amount(), request.currency()));
    }

    @GetMapping("/by-reservation/{reservationId}")
    public ResponseEntity<SecurityDepositDto> getByReservation(@PathVariable Long reservationId) {
        return ResponseEntity.ok(
            service.getByReservation(tenantContext.getRequiredOrganizationId(), reservationId));
    }

    /**
     * Pré-autorise (hold Stripe) la caution sur la carte enregistrée à la réservation. Avant le jour
     * de l'arrivée, la caution reste PENDING (hold posé ce jour-là par le scheduler) ; un refus
     * revient en FAILED avec son motif ({@code holdError}).
     */
    @PostMapping("/{id}/hold")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<SecurityDepositDto> hold(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(paymentService.placeHold(requireManager(jwt), id));
    }

    @PostMapping("/{id}/release")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<Void> release(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        paymentService.releaseHold(requireManager(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/capture")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<Void> capture(@PathVariable Long id, @RequestBody Capture request, @AuthenticationPrincipal Jwt jwt) {
        paymentService.captureHold(requireManager(jwt), id, request.amount(), request.reason());
        return ResponseEntity.noContent().build();
    }

    private Long requireManager(Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        organizationAccess.validateOrgManagement(jwt.getSubject(), orgId);
        return orgId;
    }
}
