package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.NoiseAlert;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.service.NoiseAlertNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Executeur {@code SEND_NOISE_WARNING} du moteur AutomationRule (fiche 08, F6a) :
 * sur alerte bruit (trigger NOISE_ALERT), avertit le voyageur du sejour EN COURS
 * sur la propriete — WhatsApp (template Meta {@code clenzy_noise_alert_v1}) si
 * disponible, repli email sinon.
 *
 * <p>Sujet attendu : TYPE_NOISE_ALERT (subjectId = id de l'alerte). L'executeur
 * recharge l'alerte depuis la base (le contexte {@code data} est volatile) et
 * delegue l'envoi + l'idempotence « 1 avertissement / sejour / 24 h » (claim
 * Redis atomique, repli base) a
 * {@link NoiseAlertNotificationService#sendGuestWarning} — filet partage avec le
 * chemin historique {@code notifyGuestMessage} de la config bruit : les deux
 * actives ne produisent qu'un seul message.</p>
 */
@Service
public class SendNoiseWarningExecutor implements AutomationActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(SendNoiseWarningExecutor.class);

    private final NoiseAlertRepository noiseAlertRepository;
    private final NoiseAlertNotificationService noiseAlertNotificationService;

    public SendNoiseWarningExecutor(NoiseAlertRepository noiseAlertRepository,
                                    NoiseAlertNotificationService noiseAlertNotificationService) {
        this.noiseAlertRepository = noiseAlertRepository;
        this.noiseAlertNotificationService = noiseAlertNotificationService;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_NOISE_WARNING;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        if (!AutomationSubject.TYPE_NOISE_ALERT.equals(ctx.subjectType()) || ctx.subjectId() == null) {
            // Regle mal cablée : echec explicite (statut FAILED cote moteur).
            throw new IllegalStateException("SEND_NOISE_WARNING attend un sujet "
                + AutomationSubject.TYPE_NOISE_ALERT + " (recu : " + ctx.subjectType()
                + "#" + ctx.subjectId() + ", regle " + rule.getId() + ")");
        }

        NoiseAlert alert = noiseAlertRepository.findById(ctx.subjectId()).orElse(null);
        if (alert == null) {
            throw new IllegalStateException("Alerte bruit introuvable : " + ctx.subjectId());
        }
        // findById contourne le filtre Hibernate : validation d'organisation explicite.
        if (!ctx.orgId().equals(alert.getOrganizationId())) {
            throw new IllegalStateException("Alerte bruit " + alert.getId()
                + " hors de l'organisation " + ctx.orgId());
        }

        var outcome = noiseAlertNotificationService.sendGuestWarning(alert);
        if (outcome.sent()) {
            log.info("SEND_NOISE_WARNING: voyageur averti via {} (alerte {}, regle {})",
                outcome.channel(), alert.getId(), rule.getId());
            return ExecutionResult.executed();
        }
        return ExecutionResult.skipped(outcome.skipReason());
    }
}
