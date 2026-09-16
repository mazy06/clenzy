package com.clenzy.controller;

import com.clenzy.service.MissionFinancialService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/service-quotes/{quoteId}/financial-case")
@PreAuthorize("isAuthenticated()")
public class MissionFinancialController {
    private final MissionFinancialService service;
    private final TenantContext tenant;
    public MissionFinancialController(MissionFinancialService service, TenantContext tenant) { this.service=service; this.tenant=tenant; }
    public record Command(@Min(0) long version, @NotBlank String action, Long paymentId, @Positive Long amount,
                          UUID decisionId, @NotBlank @Size(max=1000) String reason, @Size(max=1000) String evidence,
                          @DecimalMin("0") java.math.BigDecimal amountDue, @Positive Long allocation,
                          MissionFinancialService.ExternalEvidence external) {}
    @GetMapping public MissionFinancialService.View view(@PathVariable Long quoteId, @AuthenticationPrincipal Jwt jwt) {
        return service.view(quoteId, tenant.getRequiredOrganizationId(), jwt);
    }
    @PostMapping public MissionFinancialService.View command(@PathVariable Long quoteId, @Valid @RequestBody Command request,
                                                            @AuthenticationPrincipal Jwt jwt) {
        Long org=tenant.getRequiredOrganizationId();
        service.command(quoteId, org, jwt, request.version(), request.action(), request.paymentId(), request.amount(), request.decisionId(), request.reason(), request.evidence(),request.amountDue(),request.allocation(),request.external());
        return service.view(quoteId, org, jwt);
    }
}
