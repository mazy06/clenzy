package com.clenzy.controller;

import com.clenzy.dto.BillingSummaryDto;
import com.clenzy.dto.OrganizationDto;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.service.OrganizationBillingService;
import com.clenzy.service.OrganizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Controller pour la gestion des organisations.
 * Restreint au staff plateforme (SUPER_ADMIN, SUPER_MANAGER).
 *
 * Endpoints :
 *   GET    /api/organizations       → Lister toutes les organisations
 *   GET    /api/organizations/{id}  → Detail d'une organisation
 *   POST   /api/organizations       → Creer une organisation (SUPER_ADMIN)
 *   PUT    /api/organizations/{id}  → Modifier une organisation
 *   DELETE /api/organizations/{id}  → Supprimer une organisation (SUPER_ADMIN)
 */
@RestController
@RequestMapping("/api/organizations")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
@Tag(name = "Organizations", description = "Gestion des organisations")
public class OrganizationController {

    private final OrganizationService organizationService;
    private final OrganizationBillingService organizationBillingService;

    public OrganizationController(OrganizationService organizationService,
                                  OrganizationBillingService organizationBillingService) {
        this.organizationService = organizationService;
        this.organizationBillingService = organizationBillingService;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GET — Lister toutes les organisations
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping
    @Operation(summary = "Lister toutes les organisations")
    public ResponseEntity<List<OrganizationDto>> listAll() {
        List<Organization> organizations = organizationService.findAll();
        List<OrganizationDto> dtos = organizations.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GET — Detail d'une organisation
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir le detail d'une organisation")
    public ResponseEntity<OrganizationDto> getById(@PathVariable Long id) {
        Organization org = organizationService.findById(id)
                .orElseThrow(() -> new RuntimeException("Organisation non trouvee: " + id));
        return ResponseEntity.ok(toDto(org));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // POST — Creer une organisation (SUPER_ADMIN uniquement)
    // ═══════════════════════════════════════════════════════════════════════════

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Creer une organisation")
    public ResponseEntity<OrganizationDto> create(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String typeStr = body.get("type");

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        OrganizationType type = OrganizationType.INDIVIDUAL;
        if (typeStr != null) {
            try {
                type = OrganizationType.valueOf(typeStr);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        }

        Organization org = organizationService.createStandalone(name.trim(), type);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(org));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUT — Modifier une organisation
    // ═══════════════════════════════════════════════════════════════════════════

    @PutMapping("/{id}")
    @Operation(summary = "Modifier une organisation")
    public ResponseEntity<OrganizationDto> update(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String name = body.get("name");
        String typeStr = body.get("type");

        OrganizationType type = null;
        if (typeStr != null) {
            try {
                type = OrganizationType.valueOf(typeStr);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        }

        Organization org = organizationService.updateOrganization(id, name != null ? name.trim() : null, type);
        return ResponseEntity.ok(toDto(org));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DELETE — Supprimer une organisation (SUPER_ADMIN uniquement)
    // ═══════════════════════════════════════════════════════════════════════════

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer une organisation")
    public void delete(@PathVariable Long id) {
        organizationService.deleteOrganization(id);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GET — Résumé de facturation per-seat
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping("/{id}/billing-summary")
    @Operation(summary = "Obtenir le resume de facturation per-seat d'une organisation")
    public ResponseEntity<BillingSummaryDto> getBillingSummary(@PathVariable Long id) {
        return ResponseEntity.ok(organizationBillingService.getBillingSummary(id));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Mapping
    // ═══════════════════════════════════════════════════════════════════════════

    private OrganizationDto toDto(Organization org) {
        long count = organizationService.countMembers(org.getId());
        return new OrganizationDto(
                org.getId(),
                org.getName(),
                org.getSlug(),
                org.getType().name(),
                (int) count,
                org.getCreatedAt(),
                org.getUpdatedAt()
        );
    }
}
