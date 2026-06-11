package com.clenzy.controller;

import com.clenzy.dto.SplitConfigurationDto;
import com.clenzy.dto.SplitRatios;
import com.clenzy.service.SplitConfigurationService;
import com.clenzy.service.SplitPaymentService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Split configuration CRUD — allows SUPER_ADMIN/SUPER_MANAGER to configure
 * the platform/owner/concierge commission split ratios per organization.
 */
@RestController
@RequestMapping("/api/split-configs")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class SplitConfigurationController {

    private final SplitConfigurationService splitConfigurationService;
    private final SplitPaymentService splitPaymentService;
    private final TenantContext tenantContext;

    public SplitConfigurationController(SplitConfigurationService splitConfigurationService,
                                         SplitPaymentService splitPaymentService,
                                         TenantContext tenantContext) {
        this.splitConfigurationService = splitConfigurationService;
        this.splitPaymentService = splitPaymentService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<List<SplitConfigurationDto>> listConfigs() {
        return ResponseEntity.ok(splitConfigurationService.listConfigs());
    }

    @GetMapping("/current-ratios")
    public ResponseEntity<SplitRatios> getCurrentRatios() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(splitPaymentService.resolveSplitRatios(orgId));
    }

    @PostMapping
    public ResponseEntity<SplitConfigurationDto> createConfig(@RequestBody SplitConfigurationDto config) {
        return ResponseEntity.ok(splitConfigurationService.createConfig(config));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SplitConfigurationDto> updateConfig(
            @PathVariable Long id,
            @RequestBody SplitConfigurationDto update) {
        return ResponseEntity.ok(splitConfigurationService.updateConfig(id, update));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteConfig(@PathVariable Long id) {
        splitConfigurationService.deleteConfig(id);
        return ResponseEntity.noContent().build();
    }
}
