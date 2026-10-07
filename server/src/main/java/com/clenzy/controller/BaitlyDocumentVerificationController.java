package com.clenzy.controller;

import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/document-verification") @PreAuthorize("isAuthenticated()")
public class BaitlyDocumentVerificationController {
    private final BaitlyInvoiceVerification verification;private final OrganizationService access;private final TenantContext tenant;
    public BaitlyDocumentVerificationController(BaitlyInvoiceVerification verification,OrganizationService access,TenantContext tenant){this.verification=verification;this.access=access;this.tenant=tenant;}
    private Long org(Jwt jwt){var org=tenant.getRequiredOrganizationId();access.validateOrgManagement(jwt.getSubject(),org);return org;}
    @GetMapping public List<BaitlyInvoiceVerification.Row> list(@AuthenticationPrincipal Jwt jwt){return verification.list(org(jwt));}
    @GetMapping("/{id}") public BaitlyInvoiceVerification.View view(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id){return verification.view(org(jwt),id);}
    @PostMapping("/{id}/check") public BaitlyInvoiceVerification.View check(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id){return verification.check(org(jwt),id,jwt.getSubject());}
    @PutMapping("/{id}/draft") public BaitlyInvoiceVerification.View draft(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id,@RequestBody BaitlyInvoiceVerification.Draft data){return verification.updateDraft(org(jwt),id,data,jwt.getSubject());}
}
