package com.clenzy.controller;

import com.clenzy.service.dashboard.ActionItemReconciler;
import com.clenzy.service.dashboard.ActionItemActionService;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import com.clenzy.service.PropertyTeamService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Clôture manuelle d'une action de la file.
 *
 * <p>Une action <b>déduite</b> des données n'a pas besoin de ce geste : elle
 * disparaît d'elle-même au balayage suivant, quand sa cause a disparu. Ce
 * endpoint sert aux actions nées d'un <b>événement</b> — un litige se conteste
 * chez le fournisseur, un virement se réémet depuis les reversements, et rien
 * dans nos données ne dira jamais que c'est fait.</p>
 *
 * <p>Controller mince : l'organisation vient du contexte tenant, jamais du
 * client, et le service revérifie l'appartenance avant d'écrire.</p>
 */
@RestController
@RequestMapping("/api/action-items")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','SUPERVISOR')")
public class ActionItemController {

    private final ActionItemWriter actionItemWriter;
    private final ActionItemReconciler reconciler;
    private final ActionItemActionService actionService;
    private final TenantContext tenantContext;

    public ActionItemController(ActionItemWriter actionItemWriter,
                                ActionItemReconciler reconciler,
                                ActionItemActionService actionService,
                                TenantContext tenantContext) {
        this.actionService = actionService;
        this.actionItemWriter = actionItemWriter;
        this.reconciler = reconciler;
        this.tenantContext = tenantContext;
    }

    /**
     * Remet la file à jour immédiatement, après qu'un geste l'a rendue caduque.
     *
     * <p>Le balayage périodique borne la fraîcheur à quelques minutes, ce qui
     * convient à une anomalie qui apparaît. Mais quand l'utilisateur vient de
     * <b>traiter</b> une ligne — encaisser un solde, relancer un flux — la voir
     * persister donne l'impression que le geste n'a pas pris. L'écran demande
     * donc un recalcul, et c'est le seul moment où il en demande un : rare, par
     * construction, puisqu'il suit une action humaine et non un affichage.</p>
     *
     * <p>Inutile après une clôture manuelle : celle-ci écrit directement.</p>
     */
    @PostMapping("/refresh")
    public ResponseEntity<Void> refresh() {
        reconciler.reconcile(tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Réessaie l'envoi que cette action signale.
     *
     * <p>Un document non délivré, un message voyageur en échec : le geste
     * attendu est de réessayer, et il se fait ici plutôt que sur un écran qu'il
     * faudrait d'abord savoir ouvrir.</p>
     */
    /**
     * Exécute le geste nommé sur cette action — acquitter, approuver, libérer,
     * renvoyer, convertir, écarter, rejouer.
     *
     * <p>Un seul point d'entrée plutôt qu'un par geste : le service sait quel
     * métier porte l'action, et l'appartenance à l'organisation s'y vérifie une
     * fois. Dix endpoints auraient signifié dix vérifications à ne pas
     * oublier.</p>
     */
    @PostMapping("/{id}/act")
    public ResponseEntity<Void> act(@PathVariable Long id,
                                    @RequestBody ActionRequest request,
                                    @AuthenticationPrincipal Jwt jwt) {
        actionService.act(id, tenantContext.getRequiredOrganizationId(),
                request.action(), request.assigneeTeamId(), request.scheduledAt(), jwt);
        return ResponseEntity.noContent().build();
    }

    /**
     * Nom du geste demandé, et sa cible quand il en a une.
     *
     * @param assigneeTeamId équipe choisie, pour les gestes d'assignation
     */
    public record ActionRequest(@jakarta.validation.constraints.NotBlank String action,
                                Long assigneeTeamId,
                                /** Nouvelle date, pour les gestes de replanification. */
                                @com.fasterxml.jackson.annotation.JsonFormat(
                                        shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
                                java.time.LocalDateTime scheduledAt) {}

    /** Équipes proposées pour assigner l'intervention que cette action signale. */
    @GetMapping("/{id}/assignable-teams")
    public PropertyTeamService.AssignableTeams assignableTeams(@PathVariable Long id) {
        return actionService.assignableTeams(id, tenantContext.getRequiredOrganizationId());
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<Void> retry(@PathVariable Long id) {
        actionService.retry(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<Void> resolve(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        actionItemWriter.resolveById(id, tenantContext.getOrganizationId(), jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
