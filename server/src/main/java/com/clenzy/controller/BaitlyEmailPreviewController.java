package com.clenzy.controller;

import com.clenzy.service.messaging.BaitlyEmailPreviewService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Rendu sans envoi, sans écriture et sans résolution de données métier. */
@RestController
@RequestMapping("/api/document-previews/email")
@PreAuthorize("isAuthenticated()")
public class BaitlyEmailPreviewController {
    private final BaitlyEmailPreviewService previews;
    private final TenantContext tenant;
    public BaitlyEmailPreviewController(BaitlyEmailPreviewService previews, TenantContext tenant) {
        this.previews = previews; this.tenant = tenant;
    }

    @PostMapping
    public BaitlyEmailPreviewService.Preview preview(@Valid @RequestBody Request request) {
        tenant.getRequiredOrganizationId();
        return previews.render(request.subject(), request.body(), request.wrapperStyle(), request.language());
    }

    public record Request(@NotNull @Size(max=255) String subject, @NotNull @Size(max=100000) String body,
        @Pattern(regexp="NOTIFICATION_OWNER|NOTIFICATION_GUEST|INVITATION|INTERNAL_FORM|INTERNAL_URGENT") String wrapperStyle,
        @Pattern(regexp="fr|en|ar") String language) {}
}
