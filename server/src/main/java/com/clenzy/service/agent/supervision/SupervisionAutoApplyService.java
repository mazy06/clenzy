package com.clenzy.service.agent.supervision;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Chemin d'AUTO-EXÉCUTION de la Vague 1 (décision actée n°3) : quand
 * {@link AutoApplyGate} rend AUTO_*, la carte déjà créée est appliquée via le
 * <b>même pipeline</b> que le bouton humain ({@link SupervisionSuggestionService#apply}
 * — CAS PENDING→APPLIED, exécuteur, effets externes hors transaction,
 * compensation) avec l'acteur système {@link SupervisionSuggestion#APPLIED_BY_AUTO}.
 * Zéro second chemin d'exécution : dédup, TTL, journal et garanties d'argent
 * sont ceux de l'apply existant.
 *
 * <p>Si l'apply échoue, la carte RESTE en PENDING (rollback de la transaction du
 * CAS pour les actions DB-only, compensation APPLIED→PENDING pour les effets
 * externes) = repli HITL naturel : l'opérateur la voit dans la file.</p>
 *
 * <p>Après succès : entrée de feed TOUJOURS (traçabilité, garde-fou transverse),
 * et notification {@code SUPERVISION_AUTO_APPLIED} aux admins/managers org en
 * AUTO_NOTIFY uniquement (AUTO_SILENT = feed seul).</p>
 */
@Service
public class SupervisionAutoApplyService {

    private static final Logger log = LoggerFactory.getLogger(SupervisionAutoApplyService.class);

    private final SupervisionSuggestionService suggestionService;
    private final SupervisionActivityService activityService;
    private final NotificationService notificationService;

    public SupervisionAutoApplyService(SupervisionSuggestionService suggestionService,
                                       SupervisionActivityService activityService,
                                       NotificationService notificationService) {
        this.suggestionService = suggestionService;
        this.activityService = activityService;
        this.notificationService = notificationService;
    }

    /**
     * Applique automatiquement la suggestion {@code suggestionId} (déjà créée).
     *
     * @return true si l'action a été appliquée ; false si l'apply a échoué —
     *         la carte reste alors en PENDING (repli HITL), rien n'est notifié.
     */
    public boolean autoApply(AutoApplyGate.AutoDecision decision, Long orgId, Long propertyId,
                             String moduleKey, Long suggestionId, String title, String motif,
                             Long estimatedImpactCents) {
        if (decision == null || decision == AutoApplyGate.AutoDecision.CARD || suggestionId == null) {
            return false;
        }
        try {
            suggestionService.apply(orgId, suggestionId, SupervisionSuggestion.APPLIED_BY_AUTO);
        } catch (RuntimeException e) {
            // Repli HITL : la carte reste PENDING (rollback / compensation du pipeline).
            log.warn("[AUTO-APPLY] échec org={} property={} suggestion={} — repli HITL : {}",
                    orgId, propertyId, suggestionId, e.getMessage());
            return false;
        }
        log.info("[AUTO-APPLY] org={} property={} module={} suggestion={} appliquée ({})",
                orgId, propertyId, moduleKey, suggestionId, decision);

        // Feed « En direct » : chaque auto-application laisse une trace (garde-fou).
        activityService.recordModuleAct(orgId, propertyId, moduleKey, "auto_applied",
                "Action automatique : " + title);

        if (decision == AutoApplyGate.AutoDecision.AUTO_NOTIFY) {
            notifyAutoApplied(orgId, title, motif, estimatedImpactCents);
        }
        return true;
    }

    /** Notification in-app N1 (best-effort) : l'org sait ce qui vient d'être fait. */
    private void notifyAutoApplied(Long orgId, String title, String motif, Long estimatedImpactCents) {
        try {
            final StringBuilder message = new StringBuilder(
                    motif != null && !motif.isBlank() ? motif : "Action appliquée automatiquement.");
            if (estimatedImpactCents != null && estimatedImpactCents > 0) {
                message.append(" Impact estimé : ≈ ").append(estimatedImpactCents / 100).append(" €.");
            }
            notificationService.notifyAdminsAndManagersByOrgId(orgId,
                    NotificationKey.SUPERVISION_AUTO_APPLIED,
                    "Action automatique : " + title,
                    message.toString(),
                    "/planning");
        } catch (Exception e) {
            log.debug("[AUTO-APPLY] notification non émise (org={}) : {}", orgId, e.getMessage());
        }
    }
}
