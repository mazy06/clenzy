package com.clenzy.controller;

import com.clenzy.dto.noise.NoiseAlertDto;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Historique et gestion des alertes bruit.
 */
@RestController
@RequestMapping("/api/noise-alerts")
@Tag(name = "Noise Alerts", description = "Historique des alertes de bruit")
@PreAuthorize("isAuthenticated()")
public class NoiseAlertController {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertController.class);

    private final NoiseAlertService alertService;
    private final TenantContext tenantContext;

    public NoiseAlertController(NoiseAlertService alertService,
                                 TenantContext tenantContext) {
        this.alertService = alertService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Historique des alertes bruit (pagine)")
    public ResponseEntity<Page<NoiseAlertDto>> getAlerts(
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) String severity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        return ResponseEntity.ok(alertService.getAlerts(orgId, propertyId, severity, pageable));
    }

    @GetMapping("/unacknowledged-count")
    @Operation(summary = "Nombre d'alertes non acquittees")
    public ResponseEntity<Map<String, Long>> getUnacknowledgedCount() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        long count = alertService.getUnacknowledgedCount(orgId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PutMapping("/{id}/acknowledge")
    @Operation(summary = "Acquitter une alerte bruit")
    public ResponseEntity<?> acknowledge(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) Map<String, String> body) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String acknowledgedBy = jwt.getSubject();
        String notes = body != null ? body.get("notes") : null;

        try {
            NoiseAlertDto dto = alertService.acknowledge(id, orgId, acknowledgedBy, notes);
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
