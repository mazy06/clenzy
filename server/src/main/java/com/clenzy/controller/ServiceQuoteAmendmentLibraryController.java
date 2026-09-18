package com.clenzy.controller;

import com.clenzy.service.ServiceQuoteAmendmentLibrary;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/service-quote-amendments")
@PreAuthorize("isAuthenticated()")
public class ServiceQuoteAmendmentLibraryController {
    private final ServiceQuoteAmendmentLibrary library;
    private final TenantContext tenant;
    public ServiceQuoteAmendmentLibraryController(ServiceQuoteAmendmentLibrary library, TenantContext tenant) {
        this.library = library; this.tenant = tenant;
    }

    @GetMapping("/archives")
    public Page<ServiceQuoteAmendmentLibrary.Entry> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String search) {
        return library.list(tenant.getRequiredOrganizationId(), jwt, page, size, search);
    }
}
