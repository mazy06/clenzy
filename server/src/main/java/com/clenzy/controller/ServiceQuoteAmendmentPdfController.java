package com.clenzy.controller;

import com.clenzy.service.ServiceQuoteAmendmentPdfService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/service-quote-amendments")
@PreAuthorize("isAuthenticated()")
public class ServiceQuoteAmendmentPdfController {
    private final ServiceQuoteAmendmentPdfService pdf;
    private final TenantContext tenant;

    public ServiceQuoteAmendmentPdfController(ServiceQuoteAmendmentPdfService pdf, TenantContext tenant) {
        this.pdf = pdf;
        this.tenant = tenant;
    }

    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> download(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        byte[] content = pdf.download(id, tenant.getRequiredOrganizationId(), jwt);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("baitly-avenant-" + id + ".pdf").build().toString())
                .contentType(MediaType.APPLICATION_PDF).body(content);
    }

    @ExceptionHandler(ServiceQuoteAmendmentPdfService.ArchivePendingException.class)
    public ResponseEntity<Void> preparing() {
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.RETRY_AFTER, "60").build();
    }
}
