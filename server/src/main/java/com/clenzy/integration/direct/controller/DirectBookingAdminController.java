package com.clenzy.integration.direct.controller;

import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.model.PromoCode;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import com.clenzy.integration.direct.repository.PromoCodeRepository;
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

    private final DirectBookingConfigRepository configRepository;
    private final PromoCodeRepository promoCodeRepository;
    private final DirectBookingWidgetService widgetService;
    private final TenantContext tenantContext;

    public DirectBookingAdminController(DirectBookingConfigRepository configRepository,
                                         PromoCodeRepository promoCodeRepository,
                                         DirectBookingWidgetService widgetService,
                                         TenantContext tenantContext) {
        this.configRepository = configRepository;
        this.promoCodeRepository = promoCodeRepository;
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

        DirectBookingConfiguration existing = configRepository
                .findByPropertyIdAndOrganizationId(propertyId, orgId)
                .orElseGet(() -> {
                    DirectBookingConfiguration newConfig = new DirectBookingConfiguration(orgId, propertyId);
                    return newConfig;
                });

        existing.setEnabled(update.isEnabled());
        existing.setWidgetThemeColor(update.getWidgetThemeColor());
        existing.setWidgetLogo(update.getWidgetLogo());
        existing.setCustomCss(update.getCustomCss());
        existing.setTermsAndConditionsUrl(update.getTermsAndConditionsUrl());
        existing.setCancellationPolicyText(update.getCancellationPolicyText());
        existing.setConfirmationEmailTemplate(update.getConfirmationEmailTemplate());
        existing.setAutoConfirm(update.isAutoConfirm());
        existing.setRequirePayment(update.isRequirePayment());
        existing.setAllowedCurrencies(update.getAllowedCurrencies());

        DirectBookingConfiguration saved = configRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    // ── Codes promo ──────────────────────────────────────────────────────

    @GetMapping("/promo-codes")
    @Operation(summary = "Lister les codes promo de l'organisation")
    public ResponseEntity<List<PromoCode>> listPromoCodes() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("GET /api/admin/direct-booking/promo-codes: orgId={}", orgId);
        List<PromoCode> codes = promoCodeRepository.findAllByOrganizationId(orgId);
        return ResponseEntity.ok(codes);
    }

    @PostMapping("/promo-codes")
    @Operation(summary = "Creer un code promo")
    public ResponseEntity<PromoCode> createPromoCode(@RequestBody PromoCode promoCode) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("POST /api/admin/direct-booking/promo-codes: code={}, orgId={}",
                promoCode.getCode(), orgId);

        promoCode.setOrganizationId(orgId);
        promoCode.setCurrentUses(0);
        PromoCode saved = promoCodeRepository.save(promoCode);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/promo-codes/{id}")
    @Operation(summary = "Mettre a jour un code promo")
    public ResponseEntity<PromoCode> updatePromoCode(@PathVariable Long id,
                                                       @RequestBody PromoCode update) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("PUT /api/admin/direct-booking/promo-codes/{}: orgId={}", id, orgId);

        PromoCode existing = promoCodeRepository.findById(id)
                .filter(p -> orgId.equals(p.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Code promo introuvable: " + id));

        existing.setCode(update.getCode());
        existing.setDiscountType(update.getDiscountType());
        existing.setDiscountValue(update.getDiscountValue());
        existing.setValidFrom(update.getValidFrom());
        existing.setValidUntil(update.getValidUntil());
        existing.setMinNights(update.getMinNights());
        existing.setMaxUses(update.getMaxUses());
        existing.setPropertyId(update.getPropertyId());
        existing.setActive(update.isActive());

        PromoCode saved = promoCodeRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/promo-codes/{id}")
    @Operation(summary = "Desactiver un code promo")
    public ResponseEntity<Void> deactivatePromoCode(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.debug("DELETE /api/admin/direct-booking/promo-codes/{}: orgId={}", id, orgId);

        PromoCode existing = promoCodeRepository.findById(id)
                .filter(p -> orgId.equals(p.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Code promo introuvable: " + id));

        existing.setActive(false);
        promoCodeRepository.save(existing);
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
