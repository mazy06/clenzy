package com.clenzy.controller;

import com.clenzy.service.ConsumablesOverviewService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/consumables")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR')")
@Validated
public class ConsumablesController {
    private final ConsumablesOverviewService overview;
    private final TenantContext tenantContext;

    public ConsumablesController(ConsumablesOverviewService overview, TenantContext tenantContext) {
        this.overview = overview;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ConsumablesOverviewService.Overview list(
            @RequestParam(defaultValue = "pending") ConsumablesOverviewService.View view,
            @RequestParam(required = false) @Min(1) Long propertyId,
            @RequestParam(defaultValue = "") @Size(max = 200) String search,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return overview.list(tenantContext.getRequiredOrganizationId(), view, propertyId, search, page, size);
    }

    @GetMapping("/properties")
    public java.util.List<ConsumablesOverviewService.PropertyChoice> properties() {
        return overview.propertyChoices(tenantContext.getRequiredOrganizationId());
    }
}
