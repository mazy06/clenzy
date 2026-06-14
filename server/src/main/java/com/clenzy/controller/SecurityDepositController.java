package com.clenzy.controller;

import com.clenzy.dto.SecurityDepositDto;
import com.clenzy.dto.SecurityDepositRequests.Capture;
import com.clenzy.dto.SecurityDepositRequests.Create;
import com.clenzy.dto.SecurityDepositRequests.Hold;
import com.clenzy.service.SecurityDepositService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    private final TenantContext tenantContext;

    public SecurityDepositController(SecurityDepositService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @PostMapping
    public ResponseEntity<SecurityDepositDto> create(@RequestBody Create request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(
            service.create(orgId, request.reservationId(), request.amount(), request.currency()));
    }

    @GetMapping("/by-reservation/{reservationId}")
    public ResponseEntity<SecurityDepositDto> getByReservation(@PathVariable Long reservationId) {
        return ResponseEntity.ok(
            service.getByReservation(tenantContext.getRequiredOrganizationId(), reservationId));
    }

    @PostMapping("/{id}/hold")
    public ResponseEntity<Void> hold(@PathVariable Long id, @RequestBody Hold request) {
        service.markHeld(tenantContext.getRequiredOrganizationId(), id, request.externalRef());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/release")
    public ResponseEntity<Void> release(@PathVariable Long id) {
        service.release(tenantContext.getRequiredOrganizationId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/capture")
    public ResponseEntity<Void> capture(@PathVariable Long id, @RequestBody Capture request) {
        service.capture(tenantContext.getRequiredOrganizationId(), id, request.amount(), request.reason());
        return ResponseEntity.noContent().build();
    }
}
