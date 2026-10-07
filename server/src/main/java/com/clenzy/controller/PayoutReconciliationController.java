package com.clenzy.controller;

import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.service.payout.PayoutReconciliationService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;

@RestController
@RequestMapping("/api/accounting/payout-transfers/{id}/reconciliation")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class PayoutReconciliationController {
    private final PayoutReconciliationService service;
    private final TenantContext tenant;
    public PayoutReconciliationController(PayoutReconciliationService service, TenantContext tenant) {
        this.service = service; this.tenant = tenant;
    }
    public record Request(@NotBlank @Pattern(regexp = "tr_[A-Za-z0-9]{1,61}") String reference) {}
    public record Verification(String reference, String destination, boolean livemode, Instant createdAt) {}
    @PostMapping("/verify")
    public Verification verify(@PathVariable Long id, @Valid @RequestBody Request request) {
        var proof = service.verify(tenant.getRequiredOrganizationId(), id, request.reference());
        return new Verification(proof.reference(), proof.destination(), proof.livemode(), proof.createdAt());
    }
    @PostMapping("/confirm")
    public PayoutTransferDto confirm(@PathVariable Long id, @Valid @RequestBody Request request, @AuthenticationPrincipal Jwt jwt) {
        return service.confirm(tenant.getRequiredOrganizationId(), id, request.reference(), jwt == null ? null : jwt.getSubject());
    }
}
