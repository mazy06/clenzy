package com.clenzy.controller;

import com.clenzy.dto.SplitRatios;
import com.clenzy.model.SplitConfiguration;
import com.clenzy.repository.SplitConfigurationRepository;
import com.clenzy.service.SplitPaymentService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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
        validateShares(config);
        config.setOrganizationId(orgId);
        config.setId(null);
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

        validateShares(update);

        existing.setName(update.getName());
        existing.setOwnerShare(update.getOwnerShare());
        existing.setPlatformShare(update.getPlatformShare());
        existing.setConciergeShare(update.getConciergeShare());
        existing.setIsDefault(update.getIsDefault());
        existing.setActive(update.getActive());

        return ResponseEntity.ok(repository.save(existing));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteConfig(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        SplitConfiguration existing = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("Split config not found: " + id));

        if (!existing.getOrganizationId().equals(orgId)) {
            throw new RuntimeException("Access denied");
        }

        if (Boolean.TRUE.equals(existing.getIsDefault())) {
            throw new RuntimeException("Cannot delete the default split configuration");
        }

        repository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    /**
     * Validates that the three shares sum to exactly 1.0000 (100%).
     */
    private void validateShares(SplitConfiguration config) {
        if (config.getOwnerShare() == null || config.getPlatformShare() == null || config.getConciergeShare() == null) {
            throw new RuntimeException("All shares (owner, platform, concierge) are required");
        }
        BigDecimal total = config.getOwnerShare()
            .add(config.getPlatformShare())
            .add(config.getConciergeShare());
        if (total.compareTo(BigDecimal.ONE) != 0) {
            throw new RuntimeException("Shares must sum to 1.0000 (100%). Current total: " + total);
        }
    }
}
