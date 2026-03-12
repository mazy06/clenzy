package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BookingEngineAdminConfigDto;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.service.BookingEngineAdminService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Internal admin endpoints for Booking Engine management.
 * Requires JWT authentication (standard PMS flow).
 * Supports multi-template CRUD.
 */
@RestController
@RequestMapping("/api/booking-engine")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BookingEngineAdminController {

    private final BookingEngineAdminService adminService;
    private final BookingEngineConfigRepository configRepository;
    private final TenantContext tenantContext;

    public BookingEngineAdminController(BookingEngineAdminService adminService,
                                         BookingEngineConfigRepository configRepository,
                                         TenantContext tenantContext) {
        this.adminService = adminService;
        this.configRepository = configRepository;
        this.tenantContext = tenantContext;
    }

    // ─── Lightweight status (used by dashboard widget) ───────────────────

    /**
     * GET /api/booking-engine/status
     * Returns whether the booking engine is configured and enabled for this org.
     * Lightweight endpoint — does NOT auto-create config.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        var configs = configRepository.findAllByOrganizationId(orgId);
        if (configs.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                "configured", false,
                "enabled", false,
                "templateCount", 0
            ));
        }
        boolean anyEnabled = configs.stream().anyMatch(c -> c.isEnabled());
        return ResponseEntity.ok(Map.<String, Object>of(
            "configured", true,
            "enabled", anyEnabled,
            "templateCount", configs.size(),
            "apiKey", maskApiKey(configs.get(0).getApiKey())
        ));
    }

    // ─── Multi-template CRUD ─────────────────────────────────────────────

    /**
     * GET /api/booking-engine/configs
     * Lists all templates for the current org.
     */
    @GetMapping("/configs")
    public ResponseEntity<List<BookingEngineAdminConfigDto>> listConfigs() {
        return ResponseEntity.ok(adminService.listConfigs());
    }

    /**
     * GET /api/booking-engine/configs/{id}
     * Returns a single template by ID.
     */
    @GetMapping("/configs/{id}")
    public ResponseEntity<BookingEngineAdminConfigDto> getConfigById(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.getConfigById(id));
    }

    /**
     * POST /api/booking-engine/configs
     * Creates a new template.
     */
    @PostMapping("/configs")
    public ResponseEntity<BookingEngineAdminConfigDto> createConfig(
            @RequestBody BookingEngineAdminConfigDto dto) {
        return ResponseEntity.ok(adminService.createConfig(dto));
    }

    /**
     * PUT /api/booking-engine/configs/{id}
     * Updates an existing template.
     */
    @PutMapping("/configs/{id}")
    public ResponseEntity<BookingEngineAdminConfigDto> updateConfig(
            @PathVariable Long id,
            @RequestBody BookingEngineAdminConfigDto dto) {
        return ResponseEntity.ok(adminService.updateConfig(id, dto));
    }

    /**
     * DELETE /api/booking-engine/configs/{id}
     * Deletes a template.
     */
    @DeleteMapping("/configs/{id}")
    public ResponseEntity<Void> deleteConfig(@PathVariable Long id) {
        adminService.deleteConfig(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * PUT /api/booking-engine/configs/{id}/toggle
     * Enables or disables a template.
     */
    @PutMapping("/configs/{id}/toggle")
    public ResponseEntity<BookingEngineAdminConfigDto> toggleEnabled(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        return ResponseEntity.ok(adminService.toggleEnabled(id, enabled));
    }

    /**
     * POST /api/booking-engine/configs/{id}/regenerate-key
     * Generates a new API key for a template.
     */
    @PostMapping("/configs/{id}/regenerate-key")
    public ResponseEntity<BookingEngineAdminConfigDto> regenerateApiKey(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.regenerateApiKey(id));
    }

    // ─── Legacy endpoints (backward compat) ──────────────────────────────

    /**
     * GET /api/booking-engine/config
     * Legacy — returns the first config. Auto-creates if none exists.
     */
    @GetMapping("/config")
    public ResponseEntity<BookingEngineAdminConfigDto> getConfig() {
        return ResponseEntity.ok(adminService.getConfig());
    }

    /**
     * PUT /api/booking-engine/config
     * Legacy — updates the first config.
     */
    @PutMapping("/config")
    public ResponseEntity<BookingEngineAdminConfigDto> updateConfig(
            @RequestBody BookingEngineAdminConfigDto dto) {
        // Get the first config, then update by ID
        BookingEngineAdminConfigDto existing = adminService.getConfig();
        return ResponseEntity.ok(adminService.updateConfig(existing.id(), dto));
    }

    /**
     * PUT /api/booking-engine/toggle
     * Legacy — toggles the first config.
     */
    @PutMapping("/toggle")
    public ResponseEntity<BookingEngineAdminConfigDto> toggleEnabled(
            @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        BookingEngineAdminConfigDto existing = adminService.getConfig();
        return ResponseEntity.ok(adminService.toggleEnabled(existing.id(), enabled));
    }

    /**
     * POST /api/booking-engine/regenerate-key
     * Legacy — regenerates the first config's API key.
     */
    @PostMapping("/regenerate-key")
    public ResponseEntity<BookingEngineAdminConfigDto> regenerateApiKey() {
        BookingEngineAdminConfigDto existing = adminService.getConfig();
        return ResponseEntity.ok(adminService.regenerateApiKey(existing.id()));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.length() < 12) return "****";
        return apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length() - 4);
    }
}
