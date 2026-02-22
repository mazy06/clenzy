package com.clenzy.controller;

import com.clenzy.dto.noise.NoiseAlertConfigDto;
import com.clenzy.dto.noise.SaveNoiseAlertConfigDto;
import com.clenzy.service.NoiseAlertConfigService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * CRUD configuration des alertes bruit par propriete.
 */
@RestController
@RequestMapping("/api/noise-alert-config")
@Tag(name = "Noise Alert Config", description = "Configuration des alertes de bruit")
@PreAuthorize("isAuthenticated()")
public class NoiseAlertConfigController {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertConfigController.class);

    private final NoiseAlertConfigService configService;
    private final TenantContext tenantContext;

    public NoiseAlertConfigController(NoiseAlertConfigService configService,
                                       TenantContext tenantContext) {
        this.configService = configService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Lister les configurations d'alertes bruit")
    public ResponseEntity<List<NoiseAlertConfigDto>> getAll() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(configService.getAllForOrg(orgId));
    }

    @GetMapping("/{propertyId}")
    @Operation(summary = "Config d'alertes pour une propriete")
    public ResponseEntity<NoiseAlertConfigDto> getByProperty(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        NoiseAlertConfigDto dto = configService.getByProperty(orgId, propertyId);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @PutMapping("/{propertyId}")
    @Operation(summary = "Creer ou mettre a jour la config d'alertes")
    public ResponseEntity<?> save(@PathVariable Long propertyId,
                                   @Valid @RequestBody SaveNoiseAlertConfigDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        try {
            NoiseAlertConfigDto saved = configService.save(orgId, propertyId, dto);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{propertyId}")
    @Operation(summary = "Supprimer la config d'alertes d'une propriete")
    public ResponseEntity<Void> delete(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        configService.delete(orgId, propertyId);
        return ResponseEntity.noContent().build();
    }
}
