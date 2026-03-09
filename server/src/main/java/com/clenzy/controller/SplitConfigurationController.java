package com.clenzy.controller;

import com.clenzy.dto.SplitRatios;
import com.clenzy.model.SplitConfiguration;
import com.clenzy.repository.SplitConfigurationRepository;
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

    private final SplitConfigurationRepository repository;
    private final SplitPaymentService splitPaymentService;
    private final TenantContext tenantContext;

    public SplitConfigurationController(SplitConfigurationRepository repository,
                                         SplitPaymentService splitPaymentService,
                                         TenantContext tenantContext) {
        this.repository = repository;
        this.splitPaymentService = splitPaymentService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<List<SplitConfiguration>> listConfigs() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(repository.findByOrganizationId(orgId));
    }

    @GetMapping("/current-ratios")
    public ResponseEntity<SplitRatios> getCurrentRatios() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(splitPaymentService.resolveSplitRatios(orgId));
    }

    @PostMapping
    public ResponseEntity<SplitConfiguration> createConfig(@RequestBody SplitConfiguration config) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        config.setOrganizationId(orgId);
        config.setId(null); // Ensure new record
        return ResponseEntity.ok(repository.save(config));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SplitConfiguration> updateConfig(
            @PathVariable Long id,
            @RequestBody SplitConfiguration update) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        SplitConfiguration existing = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("Split config not found: " + id));

        if (!existing.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Access denied");
        }

        existing.setName(update.getName());
        existing.setOwnerShare(update.getOwnerShare());
        existing.setPlatformShare(update.getPlatformShare());
        existing.setConciergeShare(update.getConciergeShare());
        existing.setIsDefault(update.getIsDefault());
        existing.setActive(update.getActive());

        return ResponseEntity.ok(repository.save(existing));
    }
}
