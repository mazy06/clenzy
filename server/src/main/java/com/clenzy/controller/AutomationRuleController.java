package com.clenzy.controller;

import com.clenzy.dto.AutomationExecutionDto;
import com.clenzy.dto.AutomationRuleDto;
import com.clenzy.dto.CreateAutomationRuleRequest;
import com.clenzy.dto.SystemAutomationDto;
import com.clenzy.service.AutomationRuleService;
import com.clenzy.service.SystemAutomationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Règles d'automatisation. LECTURE ouverte aux membres d'organisation
 * (org-scopée) ; ÉCRITURE réservée à la plateforme (SUPER_ADMIN / SUPER_MANAGER) —
 * les organisations sont en lecture seule sur cet écran pour l'instant.
 */
@RestController
@RequestMapping("/api/automation-rules")
@PreAuthorize("isAuthenticated()")
public class AutomationRuleController {

    /** Seule la plateforme peut modifier/créer des règles. */
    private static final String WRITE_ROLES = "hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')";

    private final AutomationRuleService automationRuleService;
    private final SystemAutomationService systemAutomationService;

    public AutomationRuleController(AutomationRuleService automationRuleService,
                                    SystemAutomationService systemAutomationService) {
        this.automationRuleService = automationRuleService;
        this.systemAutomationService = systemAutomationService;
    }

    @GetMapping
    public ResponseEntity<List<AutomationRuleDto>> getAll() {
        return ResponseEntity.ok(automationRuleService.getAll());
    }

    /** Automatisations HORS hub (code / autre mécanisme), en lecture seule, avec statut réel. */
    @GetMapping("/system")
    public ResponseEntity<List<SystemAutomationDto>> getSystemAutomations() {
        return ResponseEntity.ok(systemAutomationService.listForCurrentOrg());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AutomationRuleDto> getById(@PathVariable Long id) {
        return automationRuleService.getById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<AutomationRuleDto> create(@Valid @RequestBody CreateAutomationRuleRequest request) {
        return ResponseEntity.ok(automationRuleService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<AutomationRuleDto> update(@PathVariable Long id,
                                                      @Valid @RequestBody CreateAutomationRuleRequest request) {
        return ResponseEntity.ok(automationRuleService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        automationRuleService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/toggle")
    @PreAuthorize(WRITE_ROLES)
    public ResponseEntity<AutomationRuleDto> toggle(@PathVariable Long id) {
        return ResponseEntity.ok(automationRuleService.toggle(id));
    }

    @GetMapping("/{id}/executions")
    public ResponseEntity<Page<AutomationExecutionDto>> getExecutions(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(automationRuleService.getExecutions(id, page, size));
    }
}
