package com.clenzy.controller;

import com.clenzy.service.ServiceQuoteCancellationService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/service-quotes/{quoteId}/cancellation")
@PreAuthorize("isAuthenticated()")
public class ServiceQuoteCancellationController {
    private final ServiceQuoteCancellationService service;
    private final TenantContext tenant;
    public ServiceQuoteCancellationController(ServiceQuoteCancellationService service, TenantContext tenant) {
        this.service = service; this.tenant = tenant;
    }
    public record Request(Long missionVersion, @NotBlank @Size(max = 1000) String reason) {}
    @GetMapping
    public ServiceQuoteCancellationService.View view(@PathVariable Long quoteId, @AuthenticationPrincipal Jwt jwt) {
        return service.view(quoteId, tenant.getRequiredOrganizationId(), jwt);
    }
    @PostMapping
    public ServiceQuoteCancellationService.View cancel(@PathVariable Long quoteId, @Valid @RequestBody Request request,
                                                       @AuthenticationPrincipal Jwt jwt) {
        return service.cancel(quoteId, tenant.getRequiredOrganizationId(), jwt, request.missionVersion(), request.reason());
    }
}
