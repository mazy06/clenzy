package com.clenzy.controller;

import com.clenzy.service.UpsellFulfillmentService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/upsells/offers/{id}/fulfillment")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class UpsellFulfillmentController {
    private final UpsellFulfillmentService service;
    private final TenantContext tenant;
    public UpsellFulfillmentController(UpsellFulfillmentService service,TenantContext tenant) {
        this.service=service; this.tenant=tenant;
    }
    @GetMapping
    public UpsellFulfillmentService.Configuration configuration(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        return service.configuration(id,tenant.getRequiredOrganizationId(),jwt);
    }
    @GetMapping("/providers")
    public UpsellFulfillmentService.Candidates candidates(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required=false) Long propertyId,@RequestParam(required=false) LocalDateTime start,
            @RequestParam(defaultValue="60") int durationMinutes,@RequestParam(defaultValue="false") boolean availableOnly,
            @RequestParam(defaultValue="false") boolean verifiedOnly,@RequestParam(defaultValue="false") boolean urgent,
            @RequestParam(required=false) String language,@RequestParam(defaultValue="name") String sort,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="false") boolean related) {
        return service.candidates(id,tenant.getRequiredOrganizationId(),jwt,propertyId,start,durationMinutes,
                availableOnly,verifiedOnly,urgent,language,sort,page,related);
    }
    public record ConfigurationRequest(@Size(max=60) String serviceItemCode,@Positive Long preferredProviderId,Long propertyId) {}
    @PutMapping
    public UpsellFulfillmentService.Configuration configure(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ConfigurationRequest body) {
        return service.configure(id,tenant.getRequiredOrganizationId(),jwt,body.serviceItemCode(),body.preferredProviderId(),body.propertyId());
    }
}
