package com.clenzy.controller;

import com.clenzy.dto.RlsAuditFindingDto;
import com.clenzy.dto.RlsAuditSummaryDto;
import com.clenzy.service.RlsAuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inventaire des chemins échappant à la Row-Level Security — audit sécurité 2026-07-26,
 * plan REM-T-01.
 *
 * <p>Remplace le relevé manuel par workflow, qu'il fallait penser à lancer. Un contrôle
 * qu'on doit se rappeler d'exécuter finit par ne plus l'être — et le personnel plateforme
 * est en outre alerté à chaque chemin nouveau.
 *
 * <p>Réservé au personnel plateforme : ces constats désignent du code, pas des données de
 * tenant, et servent une décision d'infrastructure.
 */
@RestController
@RequestMapping("/api/admin/rls-audit")
@Tag(name = "RLS Audit", description = "Inventaire des chemins sans contexte tenant")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class RlsAuditController {

    private final RlsAuditService rlsAuditService;

    public RlsAuditController(RlsAuditService rlsAuditService) {
        this.rlsAuditService = rlsAuditService;
    }

    @GetMapping
    @Operation(summary = "Etat de l'inventaire RLS",
            description = "Chemins dont les requetes s'executent sans contexte tenant. "
                    + "Zero chemin ouvert est la condition d'activation de la RLS.")
    public ResponseEntity<RlsAuditSummaryDto> etat() {
        return ResponseEntity.ok(rlsAuditService.etat());
    }

    @PostMapping("/{id}/resolve")
    @Operation(summary = "Marquer un chemin comme traite")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<RlsAuditFindingDto> marquerTraite(@PathVariable Long id) {
        return rlsAuditService.marquerTraite(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
