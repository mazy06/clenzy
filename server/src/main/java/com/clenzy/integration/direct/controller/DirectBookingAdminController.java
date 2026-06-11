package com.clenzy.integration.direct.controller;

import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.model.PromoCode;
import com.clenzy.integration.direct.service.DirectBookingAdminService;
import com.clenzy.integration.direct.service.DirectBookingWidgetService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints d'administration pour la configuration du Direct Booking.
 *
 * Accessible uniquement aux utilisateurs authentifies avec le role HOST ou superieur.
 * Les proprietaires gerent la configuration de leur widget et les codes promo.
 */
@RestController
@RequestMapping("/api/admin/direct-booking")
@Tag(name = "Direct Booking (Admin)", description = "Administration du widget de reservation directe")
@PreAuthorize("isAuthenticated()")
public class DirectBookingAdminController {

    private static final Logger log = LoggerFactory.getLogger(DirectBookingAdminController.class);

    private final DirectBookingAdminService adminService;
    private final DirectBookingWidgetService widgetService;
    private final TenantContext tenantContext;

    public DirectBookingAdminController(DirectBookingAdminService adminService,
                                         DirectBookingWidgetService widgetService,
                                         TenantContext tenantContext) {
        this.adminService = adminService;
        this.widgetService = widgetService;
        this.tenantContext = tenantContext;
    }

    // ── Configuration du widget ──────────────────────────────────────────

    @GetMapping("/config/{propertyId}")
    @Operation(summary = "Obtenir la configuration du widget pour une propriete")
    public ResponseEntity<Map<String, Object>> getWidgetConfig(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("GET /api/admin/direct-booking/config/{}: orgId={}", propertyId, orgId);
        Map<String, Object> config = widgetService.getWidgetConfig(propertyId, orgId);
        return ResponseEntity.ok(config);
    }

    @PutMapping("/config/{propertyId}")
    @Operation(summary = "Mettre a jour la configuration du widget")
    public ResponseEntity<DirectBookingConfiguration> updateWidgetConfig(
            @PathVariable Long propertyId,
            @RequestBody DirectBookingConfiguration update) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("PUT /api/admin/direct-booking/config/{}: orgId={}", propertyId, orgId);
        DirectBookingConfiguration saved = adminService.updateWidgetConfig(propertyId, orgId, update);
        return ResponseEntity.ok(saved);
    }

    // ── Codes promo ──────────────────────────────────────────────────────

    @GetMapping("/promo-codes")
    @Operation(summary = "Lister les codes promo de l'organisation")
    public ResponseEntity<List<PromoCode>> listPromoCodes() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("GET /api/admin/direct-booking/promo-codes: orgId={}", orgId);
        List<PromoCode> codes = adminService.listPromoCodes(orgId);
        return ResponseEntity.ok(codes);
    }

    @PostMapping("/promo-codes")
    @Operation(summary = "Creer un code promo")
    public ResponseEntity<PromoCode> createPromoCode(@RequestBody PromoCode promoCode) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("POST /api/admin/direct-booking/promo-codes: code={}, orgId={}",
                promoCode.getCode(), orgId);
        PromoCode saved = adminService.createPromoCode(orgId, promoCode);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/promo-codes/{id}")
    @Operation(summary = "Mettre a jour un code promo")
    public ResponseEntity<PromoCode> updatePromoCode(@PathVariable Long id,
                                                       @RequestBody PromoCode update) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("PUT /api/admin/direct-booking/promo-codes/{}: orgId={}", id, orgId);
        PromoCode saved = adminService.updatePromoCode(orgId, id, update);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/promo-codes/{id}")
    @Operation(summary = "Desactiver un code promo")
    public ResponseEntity<Void> deactivatePromoCode(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("DELETE /api/admin/direct-booking/promo-codes/{}: orgId={}", id, orgId);
        adminService.deactivatePromoCode(orgId, id);
        return ResponseEntity.noContent().build();
    }

    // ── Code d'integration ──────────────────────────────────────────────

    @GetMapping("/embed/{propertyId}")
    @Operation(summary = "Obtenir le code d'integration du widget")
    public ResponseEntity<Map<String, String>> getEmbedCode(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("GET /api/admin/direct-booking/embed/{}: orgId={}", propertyId, orgId);
        String embedCode = widgetService.getEmbedCode(propertyId, orgId);
        return ResponseEntity.ok(Map.of("embedCode", embedCode));
    }
}
