package com.clenzy.controller;

import com.clenzy.dto.yield.YieldConfigDto;
import com.clenzy.dto.yield.YieldJournalPageDto;
import com.clenzy.dto.yield.YieldPropertyBoundsDto;
import com.clenzy.dto.yield.YieldRuleV1Dto;
import com.clenzy.service.yield.YieldRuleAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Yield v1 (F8a) — règles déclaratives d'occupation, mode progressif par org,
 * bornes par bien, journal des ajustements.
 *
 * Controller mince : validation d'entrée + délégation à
 * {@link YieldRuleAdminService} (org-scopé, ownership validé au niveau service).
 */
@RestController
@RequestMapping("/api/yield")
@Tag(name = "Yield v1", description = "Règles de yield par occupation (Baitly)")
@PreAuthorize("isAuthenticated()")
public class YieldRuleController {

    private final YieldRuleAdminService yieldRuleAdminService;

    public YieldRuleController(YieldRuleAdminService yieldRuleAdminService) {
        this.yieldRuleAdminService = yieldRuleAdminService;
    }

    // ── Config org (kill-switch + mode) ─────────────────────────────────────

    @GetMapping("/config")
    @Operation(summary = "Config yield de l'org (kill-switch + mode)")
    public ResponseEntity<YieldConfigDto> getConfig() {
        return ResponseEntity.ok(yieldRuleAdminService.getConfig());
    }

    @PutMapping("/config")
    @Operation(summary = "Met à jour le kill-switch et le mode yield de l'org")
    public ResponseEntity<YieldConfigDto> updateConfig(@RequestBody YieldConfigDto request) {
        return ResponseEntity.ok(yieldRuleAdminService.updateConfig(request));
    }

    // ── Règles ──────────────────────────────────────────────────────────────

    @GetMapping("/rules")
    @Operation(summary = "Règles yield v1 de l'org")
    public ResponseEntity<List<YieldRuleV1Dto>> listRules() {
        return ResponseEntity.ok(yieldRuleAdminService.listRules());
    }

    @PostMapping("/rules")
    @Operation(summary = "Crée une règle yield v1")
    public ResponseEntity<YieldRuleV1Dto> createRule(@RequestBody YieldRuleV1Dto dto) {
        return ResponseEntity.ok(yieldRuleAdminService.createRule(dto));
    }

    @PutMapping("/rules/{id}")
    @Operation(summary = "Modifie une règle yield v1")
    public ResponseEntity<YieldRuleV1Dto> updateRule(@PathVariable Long id,
                                                     @RequestBody YieldRuleV1Dto dto) {
        return ResponseEntity.ok(yieldRuleAdminService.updateRule(id, dto));
    }

    @DeleteMapping("/rules/{id}")
    @Operation(summary = "Supprime une règle yield v1")
    public ResponseEntity<Void> deleteRule(@PathVariable Long id) {
        yieldRuleAdminService.deleteRule(id);
        return ResponseEntity.noContent().build();
    }

    // ── Bornes par bien ─────────────────────────────────────────────────────

    @GetMapping("/property-bounds")
    @Operation(summary = "Bornes plancher/plafond yield des biens de l'org")
    public ResponseEntity<List<YieldPropertyBoundsDto>> listPropertyBounds() {
        return ResponseEntity.ok(yieldRuleAdminService.listPropertyBounds());
    }

    public record UpdateBoundsRequest(BigDecimal floor, BigDecimal ceiling) {}

    @PutMapping("/properties/{propertyId}/bounds")
    @Operation(summary = "Met à jour le plancher/plafond yield d'un bien")
    public ResponseEntity<YieldPropertyBoundsDto> updatePropertyBounds(
            @PathVariable Long propertyId,
            @RequestBody UpdateBoundsRequest request) {
        return ResponseEntity.ok(yieldRuleAdminService.updatePropertyBounds(
                propertyId, request.floor(), request.ceiling()));
    }

    // ── Journal ─────────────────────────────────────────────────────────────

    @GetMapping("/journal")
    @Operation(summary = "Journal paginé des ajustements yield (replay)")
    public ResponseEntity<YieldJournalPageDto> getJournal(
            @RequestParam(required = false) Long propertyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(yieldRuleAdminService.getJournal(propertyId, page, size));
    }
}
