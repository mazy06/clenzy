package com.clenzy.controller;

import com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/fiscal-profile/submissions") @PreAuthorize("isAuthenticated()")
public class BaitlyFiscalSubmissionController {
    private final BaitlyEInvoiceStore store;private final OrganizationService access;private final TenantContext tenant;
    public BaitlyFiscalSubmissionController(BaitlyEInvoiceStore store,OrganizationService access,TenantContext tenant){this.store=store;this.access=access;this.tenant=tenant;}
    public record View(Long id,Long invoiceId,String invoiceNumber,String country,String provider,String status,String reference,String message){}
    @GetMapping public List<View> list(@AuthenticationPrincipal Jwt jwt){
        Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(jwt.getSubject(),org);
        return store.list(org).stream().map(s->new View(s.getId(),s.getInvoiceId(),s.getInvoiceNumber(),s.getCountryCode(),s.getProviderCode(),s.getStatus().name(),s.getExternalRef(),s.getMessage())).toList();
    }
}
