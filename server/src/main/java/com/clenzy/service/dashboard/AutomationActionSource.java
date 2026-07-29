package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationRule;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.GuestMessageLogRepository;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Automatisations qui ont échoué — l'action promise n'a pas eu lieu.
 *
 * <p>Un message de bienvenue non parti, un code d'accès non transmis : le
 * produit affirme que la règle est active, l'exécution a échoué, et l'échec
 * n'était consigné que dans une colonne que personne ne lit.</p>
 *
 * <p>Technique, donc réservée au staff plateforme : c'est une panne de notre
 * plomberie, pas une décision de gestion. Un hôte n'y pourrait rien.</p>
 */
@Component
public class AutomationActionSource implements ActionItemSource {

    /** Au-delà, l'échec n'est plus rattrapable auprès du voyageur. */
    private static final int LOOKBACK_DAYS = 3;

    /** Rien n'a quitté le système : le rejeu ne peut rien dupliquer. */
    public static final String SAFE_REPLAY = "SAFE_REPLAY";

    /** Une tentative est partie, issue inconnue : le rejeu peut faire un doublon. */
    public static final String MAY_HAVE_SENT = "MAY_HAVE_SENT";

    /**
     * Les seules actions qui sortent du système par la messagerie voyageur.
     *
     * <p>Les autres — créer une prestation, notifier une équipe — produisent des
     * effets internes qu'un doublon ne rend pas visible à un tiers. C'est le
     * message reçu deux fois par un voyageur qui compte ici.</p>
     */
    private static final Set<AutomationAction> SENDS_A_MESSAGE = EnumSet.of(
            AutomationAction.SEND_MESSAGE,
            AutomationAction.SEND_CHECKIN_LINK,
            AutomationAction.SEND_GUIDE,
            AutomationAction.SEND_REVIEW_REQUEST);

    private final AutomationExecutionRepository automationExecutionRepository;
    private final GuestMessageLogRepository guestMessageLogRepository;

    public AutomationActionSource(AutomationExecutionRepository automationExecutionRepository,
                                  GuestMessageLogRepository guestMessageLogRepository) {
        this.automationExecutionRepository = automationExecutionRepository;
        this.guestMessageLogRepository = guestMessageLogRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.AUTOMATION_FAILED);
    }

    @Override
    public Scope scope() {
        return Scope.TECHNICAL;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return automationExecutionRepository.findFailedForOrg(
                        ctx.organizationId(), ctx.nowDateTime().minusDays(LOOKBACK_DAYS))
                .stream()
                .map(execution -> new ActionItemDto(
                        "automation:" + execution.getId(),
                        ActionItemKind.AUTOMATION_FAILED,
                        "warning",
                        execution.getAutomationRule() == null
                                ? "Automatisation" : execution.getAutomationRule().getName(),
                        ActionItems.truncate(execution.getErrorMessage(), ActionItems.EXCERPT_LENGTH),
                        null,
                        execution.getId(),
                        null, null, null, null,
                        // Le rejeu est-il sûr ? La carte doit le savoir AVANT le
                        // clic, pour ne demander confirmation que là où le doute
                        // existe réellement.
                        replaySafety(execution, ctx),
                        null))
                .toList();
    }

    /**
     * Dit si rejouer cette exécution risque de refaire partir un message.
     *
     * <p>Un envoi ouvre désormais sa trace <b>avant</b> d'appeler le
     * fournisseur : une trace présente signifie donc « parti, ou peut-être
     * parti ». Son absence prouve au contraire que rien n'a quitté le système,
     * et le rejeu est alors franchement sûr.</p>
     *
     * <p>Ne demander confirmation que dans le cas douteux n'est pas un détail :
     * une confirmation systématique s'apprend à cliquer sans lire, et ne
     * protégerait plus rien le jour où elle compte.</p>
     */
    private String replaySafety(AutomationExecution execution, ActionItemContext ctx) {
        final AutomationRule rule = execution.getAutomationRule();
        if (rule == null || rule.getActionType() == null) return SAFE_REPLAY;
        // Seules les actions qui SORTENT du système peuvent créer un doublon
        // visible par un tiers.
        if (!SENDS_A_MESSAGE.contains(rule.getActionType())) return SAFE_REPLAY;
        if (execution.getReservation() == null || rule.getTemplate() == null) return SAFE_REPLAY;

        final boolean attempted = guestMessageLogRepository.existsAttemptSince(
                ctx.organizationId(),
                execution.getReservation().getId(),
                rule.getTemplate().getId(),
                execution.getCreatedAt());
        return attempted ? MAY_HAVE_SENT : SAFE_REPLAY;
    }
}
