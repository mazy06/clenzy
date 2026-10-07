package com.clenzy.controller;

import com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/invoices/{id}/fiscal-document") @PreAuthorize("isAuthenticated()")
public class BaitlyInvoiceFiscalController {
    private final BaitlyInvoiceFiscalDocuments documents;private final OrganizationService access;private final TenantContext tenant;
    public BaitlyInvoiceFiscalController(BaitlyInvoiceFiscalDocuments documents,OrganizationService access,TenantContext tenant){this.documents=documents;this.access=access;this.tenant=tenant;}
    private Long org(Jwt jwt){var org=tenant.getRequiredOrganizationId();access.validateOrgManagement(jwt.getSubject(),org);return org;}
    @GetMapping public BaitlyInvoiceFiscalDocuments.View view(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id){return documents.view(org(jwt),id);}
    @PostMapping("/check") public BaitlyInvoiceFiscalDocuments.Check check(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id,@Valid @RequestBody BaitlyInvoiceFiscalDocuments.Request body){return documents.check(org(jwt),id,body);}
    @PostMapping public BaitlyInvoiceFiscalDocuments.View archive(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id,@Valid @RequestBody BaitlyInvoiceFiscalDocuments.Request body){return documents.archive(org(jwt),id,body,jwt.getSubject());}
    @GetMapping("/xml") public ResponseEntity<byte[]> download(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id){
        var bytes=documents.document(org(jwt),id);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"baitly-invoice-"+id+".xml\"").body(bytes);
    }
}
