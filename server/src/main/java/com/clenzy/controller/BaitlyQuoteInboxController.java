package com.clenzy.controller;

import com.clenzy.service.BaitlyQuoteInbox;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Liste privée et paginée de tous les devis accessibles dans Baitly. */
@RestController
@RequestMapping("/api/quotes")
@PreAuthorize("isAuthenticated()")
public class BaitlyQuoteInboxController {
    private final BaitlyQuoteInbox inbox;
    private final TenantContext tenant;
    public BaitlyQuoteInboxController(BaitlyQuoteInbox inbox, TenantContext tenant) {
        this.inbox = inbox; this.tenant = tenant;
    }
    @GetMapping
    public BaitlyQuoteInbox.Result list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="ALL") String view,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return inbox.list(tenant.getRequiredOrganizationId(), jwt, view, page, size);
    }
}
