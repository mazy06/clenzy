package com.clenzy.controller;

import com.clenzy.model.BaitlyAffiliateAdjustment;
import com.clenzy.service.BaitlyAffiliateAdjustments;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;

@RestController @RequestMapping("/api/activities/commissions")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyAffiliateAdjustmentController {
    private final BaitlyAffiliateAdjustments service;private final TenantContext tenant;
    public BaitlyAffiliateAdjustmentController(BaitlyAffiliateAdjustments service,TenantContext tenant){this.service=service;this.tenant=tenant;}
    public record Request(@NotNull UUID requestId,@NotNull BigDecimal expectedGross,@NotNull @DecimalMin("0") BigDecimal gross,@NotBlank String currency,
            @NotBlank @Size(max=255) String proof,@NotBlank @Size(max=1000) String reason) {}
    @GetMapping("/{id}/adjustments") public List<BaitlyAffiliateAdjustment> history(@PathVariable Long id){return service.history(tenant.getRequiredOrganizationId(),id);}
    @PostMapping("/{id}/adjustments") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public BaitlyAffiliateAdjustment correct(@PathVariable Long id,@Valid @RequestBody Request body,@AuthenticationPrincipal Jwt jwt) {
        return service.correct(tenant.getRequiredOrganizationId(),id,body.requestId(),body.expectedGross(),body.gross(),body.currency(),body.proof(),body.reason(),jwt.getSubject());
    }
}
