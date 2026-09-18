package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.QuoteRequestDto;
import com.clenzy.marketplace.service.MarketplaceReplacementService;
import com.clenzy.marketplace.service.QuoteRequestAssembler;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/service-quotes/{quoteId}/replacement")
@PreAuthorize("isAuthenticated()")
public class MarketplaceReplacementController {
    private final MarketplaceReplacementService service;
    private final QuoteRequestAssembler assembler;
    private final TenantContext tenant;
    public MarketplaceReplacementController(MarketplaceReplacementService service, QuoteRequestAssembler assembler, TenantContext tenant) {
        this.service = service; this.assembler = assembler; this.tenant = tenant;
    }
    public record Request(@NotNull @Positive Long providerId, LocalDate desiredDate,
                          @jakarta.validation.constraints.Size(max = 40) String categoryCode,
                          @jakarta.validation.constraints.Size(max = 60) String serviceItemCode) {}
    @GetMapping
    public MarketplaceReplacementService.Context context(@PathVariable Long quoteId, @AuthenticationPrincipal Jwt jwt) {
        return service.context(quoteId, tenant.getRequiredOrganizationId(), jwt);
    }
    @PostMapping
    public QuoteRequestDto replace(@PathVariable Long quoteId, @Valid @RequestBody Request request, @AuthenticationPrincipal Jwt jwt) {
        return assembler.toDto(service.replace(quoteId, tenant.getRequiredOrganizationId(), jwt, request.providerId(), request.desiredDate(), request.categoryCode(), request.serviceItemCode()));
    }
}
