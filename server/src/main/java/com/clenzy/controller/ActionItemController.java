package com.clenzy.controller;

import com.clenzy.dto.BulkGestureDto;
import com.clenzy.dto.BulkGestureResultDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.dashboard.ActionItemBulkService;
import com.clenzy.service.dashboard.ActionItemReconciler;
import com.clenzy.service.dashboard.ActionItemActionService;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.service.dashboard.InterventionActionContextService;
import com.clenzy.service.dashboard.PayoutRecapService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import com.clenzy.dto.InterventionProofDto;
import com.clenzy.dto.PayoutRecapDto;
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
    private final ActionItemBulkService bulkService;
    private final PayoutRecapService payoutRecapService;
    private final InterventionActionContextService interventionContextService;
    private final TenantContext tenantContext;

    public ActionItemController(ActionItemWriter actionItemWriter,
                                ActionItemReconciler reconciler,
                                ActionItemActionService actionService,
                                ActionItemBulkService bulkService,
                                PayoutRecapService payoutRecapService,
                                InterventionActionContextService interventionContextService,
                                TenantContext tenantContext) {
        this.actionService = actionService;
        this.bulkService = bulkService;
        this.payoutRecapService = payoutRecapService;
        this.interventionContextService = interventionContextService;
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

    /**
     * Les rubriques qui se traitent d'un seul geste.
     *
     * <p>L'écran ne devine pas où proposer le bouton : il demande. La liste est
     * courte et ne dépend pas de l'organisation — seuls les gestes répétables
     * sans dommage y figurent, et c'est le gestionnaire du geste qui le
     * déclare.</p>
     */
    @GetMapping("/bulk-gestures")
    public List<BulkGestureDto> bulkGestures() {
        return bulkService.bulkGestures();
    }

    /**
     * Applique le geste de la rubrique à toutes ses lignes ouvertes.
     *
     * <p>Le client nomme une <b>nature</b>, jamais une liste d'identifiants :
     * il n'en reçoit qu'une dizaine sur les centaines que la rubrique peut
     * compter, et lui laisser désigner les cibles reviendrait à lui laisser
     * désigner des lignes qu'il n'a jamais vues. L'organisation vient du
     * contexte tenant.</p>
     */
    @PostMapping("/bulk")
    public BulkGestureResultDto bulk(@RequestBody @jakarta.validation.Valid BulkRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        return bulkService.apply(tenantContext.getRequiredOrganizationId(), request.kind(), jwt);
    }

    /**
     * La rubrique à traiter.
     *
     * <p>Le geste n'est pas transmis : une nature n'en porte qu'un seul, et
     * c'est le serveur qui sait lequel. Le faire choisir par le client rouvrirait
     * la porte qu'on vient de fermer — « libérer les cautions » envoyé sur la
     * rubrique des alertes de bruit.</p>
     */
    public record BulkRequest(@jakarta.validation.constraints.NotNull ActionItemKind kind) {}

    /**
     * Ce qu'il faut savoir avant d'approuver le reversement que cette action
     * signale : bénéficiaire, période, détail du calcul, moyen de versement et
     * séjours couverts.
     */
    @GetMapping("/{id}/payout-recap")
    public PayoutRecapDto payoutRecap(@PathVariable Long id) {
        return payoutRecapService.recap(id, tenantContext.getRequiredOrganizationId());
    }

    /**
     * Photos de fin de mission de l'intervention — la preuve dont dépend le
     * paiement du prestataire.
     */
    @GetMapping("/{id}/intervention-proof")
    public InterventionProofDto interventionProof(@PathVariable Long id) {
        return interventionContextService.interventionProof(id, tenantContext.getRequiredOrganizationId());
    }

    /** Équipes proposées pour assigner l'intervention que cette action signale. */
    @GetMapping("/{id}/assignable-teams")
    public PropertyTeamService.AssignableTeams assignableTeams(@PathVariable Long id) {
        return interventionContextService.assignableTeams(id, tenantContext.getRequiredOrganizationId());
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
