package com.clenzy.controller;

import com.clenzy.service.storage.archival.ArchivalService;
import com.clenzy.service.storage.archival.ArchivalService.ArchivalResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Declencheur <b>MANUEL</b> de l'archivage froid vers le bucket OVH « Cold Archive ».
 *
 * <p>Reserve au {@code SUPER_ADMIN} plateforme (operation d'infrastructure, scope global,
 * non org-scopee). Controller mince (regle audit #4) : valide l'entree, delegue au service,
 * mappe le resultat. Aucune logique ni transaction ici.</p>
 *
 * <p><b>Inerte par defaut</b> : tant que {@code clenzy.archival.enabled=false} (defaut), cet
 * appel renvoie un resultat {@code executed=false} (no-op). Aucun export, aucune suppression.
 * L'archivage ne s'execute JAMAIS automatiquement (pas de scheduler) — uniquement via cet appel.</p>
 *
 * <p><b>Non destructif</b> : l'archivage exporte les donnees froides en lecture seule ; il
 * n'efface RIEN en base. La purge eventuelle est une etape separee, non implementee.</p>
 */
@RestController
@RequestMapping("/api/admin/archival")
@Tag(name = "Cold Archival", description = "Archivage froid manuel des donnees froides -> bucket OVH Cold Archive")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class ArchivalAdminController {

    private final ArchivalService archivalService;

    public ArchivalAdminController(ArchivalService archivalService) {
        this.archivalService = archivalService;
    }

    @PostMapping("/run")
    @Operation(summary = "Lance l'archivage froid d'une cible (export NDJSON, idempotent, non destructif)",
            description = "Exporte les donnees froides de la cible vers le bucket d'archive OVH en NDJSON. "
                    + "No-op si l'archivage est desactive (clenzy.archival.enabled=false, defaut), si la cible "
                    + "est inconnue, si le bucket d'archive n'est pas configure, ou si aucune source n'est "
                    + "enregistree pour la cible. N'efface AUCUNE donnee en base. Reserve SUPER_ADMIN. "
                    + "Declenche manuellement uniquement (aucun scheduler).")
    public ResponseEntity<Map<String, Object>> run(@RequestParam("target") String target) {
        final ArchivalResult result = archivalService.archive(target);

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("target", result.target());
        body.put("executed", result.executed());
        body.put("reason", result.reason());
        body.put("batches", result.batches());
        body.put("records", result.records());
        body.put("bytes", result.bytes());
        return ResponseEntity.ok(body);
    }
}
