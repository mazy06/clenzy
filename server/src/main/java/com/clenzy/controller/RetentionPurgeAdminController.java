package com.clenzy.controller;

import com.clenzy.service.retention.RetentionPurgeService;
import com.clenzy.service.retention.RetentionPurgeService.PurgeResult;
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
 * Declencheur <b>MANUEL</b> de la purge de retention (suppression des donnees expirees).
 *
 * <p>Reserve au {@code SUPER_ADMIN} plateforme (operation d'infrastructure irreversible, scope
 * global non org-scopee). Controller mince (regle audit #4) : valide l'entree, delegue au service,
 * mappe le resultat. Aucune logique, aucun repository, aucune transaction ici.</p>
 *
 * <p><b>Inerte par defaut</b> : tant que {@code clenzy.retention.purge.enabled=false} (defaut),
 * cet appel renvoie {@code executed=false} (no-op). De plus, {@code dryRun} vaut {@code true} par
 * defaut si le parametre est absent : un appel sans {@code dryRun=false} explicite <b>ne supprime
 * RIEN</b> (comptage seul). La suppression reelle exige un {@code dryRun=false} explicite.</p>
 *
 * <p><b>Recommandation</b> : toujours lancer un dry-run d'abord ({@code dryRun=true}, ou sans
 * parametre) pour verifier le volume de candidats AVANT toute suppression reelle.</p>
 */
@RestController
@RequestMapping("/api/admin/retention")
@Tag(name = "Retention Purge",
        description = "Purge manuelle des donnees expirees (suppression irreversible, SUPER_ADMIN)")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class RetentionPurgeAdminController {

    private final RetentionPurgeService purgeService;

    public RetentionPurgeAdminController(RetentionPurgeService purgeService) {
        this.purgeService = purgeService;
    }

    @PostMapping("/purge")
    @Operation(summary = "Purge une cible (suppression des enregistrements expires ; dry-run par defaut)",
            description = "Supprime les enregistrements de la cible plus vieux que (now - retentionDays). "
                    + "dryRun=true par defaut (param absent) => comptage seul, AUCUNE suppression. "
                    + "Passer dryRun=false EXPLICITEMENT pour supprimer reellement. No-op si la purge est "
                    + "desactivee (clenzy.retention.purge.enabled=false, defaut), si la cible est inconnue, "
                    + "si aucune PurgeSource n'est enregistree, ou si retentionDays n'est pas configure. "
                    + "Reserve SUPER_ADMIN. Declenche manuellement.")
    public ResponseEntity<Map<String, Object>> purge(
            @RequestParam("target") String target,
            @RequestParam(value = "dryRun", defaultValue = "true") boolean dryRun) {

        final PurgeResult result = purgeService.purge(target, dryRun);

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("target", result.target());
        body.put("executed", result.executed());
        body.put("dryRun", result.dryRun());
        body.put("reason", result.reason());
        body.put("candidates", result.candidates());
        body.put("deleted", result.deleted());
        return ResponseEntity.ok(body);
    }
}
