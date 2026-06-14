package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.dto.MappingSuggestion;
import com.clenzy.integration.channex.dto.MappingValidationReport;
import com.clenzy.integration.channex.service.ChannexMappingSuggestionService;
import com.clenzy.integration.channex.service.ChannexMappingValidator;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Assistance au mapping Channex (CLZ Domaine 1) — controller mince (audit #4) :
 * auto-suggestion d'appariements + validation d'intégrité d'un mapping. Réservé aux admins/managers
 * (le mapping impacte la distribution OTA).
 */
@RestController
@RequestMapping("/api/integrations/channex/mappings")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class ChannexMappingAssistController {

    private final ChannexMappingSuggestionService suggestionService;
    private final ChannexMappingValidator validator;
    private final TenantContext tenantContext;

    public ChannexMappingAssistController(ChannexMappingSuggestionService suggestionService,
                                          ChannexMappingValidator validator,
                                          TenantContext tenantContext) {
        this.suggestionService = suggestionService;
        this.validator = validator;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<MappingSuggestion>> suggestions() {
        return ResponseEntity.ok(suggestionService.suggest(tenantContext.getRequiredOrganizationId()));
    }

    @GetMapping("/{propertyId}/validation")
    public ResponseEntity<MappingValidationReport> validate(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return validator.validateByProperty(orgId, propertyId)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
