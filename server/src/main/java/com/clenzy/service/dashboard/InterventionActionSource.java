package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.Intervention;
import com.clenzy.repository.InterventionRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Les trois façons dont une intervention s'arrête sans que personne ne le voie.
 *
 * <p><b>En retard</b> — la date est passée, le statut encore ouvert.</p>
 *
 * <p><b>Sans exécutant</b> — planifiée, mais ni personne ni équipe ne lui est
 * rattachée. Le jour venu, personne ne se présente. L'écran des interventions
 * la montrait comme les autres, sans rien signaler.</p>
 *
 * <p><b>En attente de paiement</b> — le travail est fait, la facture attend, et
 * l'intervention reste figée. Un tableau de bord qui ne le dit pas laisse
 * l'argent dormir indéfiniment.</p>
 *
 * <p>À ne pas confondre avec {@code SERVICE_UNASSIGNED}, qui porte sur les
 * demandes de service : deux objets différents, à deux étapes différentes du
 * cycle. Les fondre aurait masqué l'un des deux.</p>
 */
@Component
public class InterventionActionSource implements ActionItemSource {

    /**
     * Une intervention non assignée n'est un problème qu'à l'approche de sa
     * date : plus tôt, l'assignation est simplement à venir.
     */
    private static final int UNASSIGNED_HORIZON_DAYS = 3;

    /** Au-delà, l'attente de règlement n'est plus un délai mais un oubli. */
    private static final int PAYMENT_STALE_DAYS = 5;

    private final InterventionRepository interventionRepository;

    public InterventionActionSource(InterventionRepository interventionRepository) {
        this.interventionRepository = interventionRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INTERVENTION_OVERDUE,
                ActionItemKind.INTERVENTION_UNASSIGNED,
                ActionItemKind.INTERVENTION_UNPAID);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();

        interventionRepository.findOverdueForOrg(ctx.organizationId(), ctx.nowDateTime()).stream()
                .filter(intervention -> ctx.covers(intervention.getProperty()))
                .map(intervention -> item(intervention, ActionItemKind.INTERVENTION_OVERDUE,
                        "critical", ActionItems.propertyName(intervention.getProperty())))
                .forEach(items::add);

        interventionRepository.findUnassignedForOrg(
                        ctx.organizationId(), ctx.nowDateTime().plusDays(UNASSIGNED_HORIZON_DAYS))
                .stream()
                .filter(intervention -> ctx.covers(intervention.getProperty()))
                .map(intervention -> item(intervention, ActionItemKind.INTERVENTION_UNASSIGNED,
                        "critical", "Aucun intervenant assigné"))
                .forEach(items::add);

        interventionRepository.findAwaitingPaymentForOrg(
                        ctx.organizationId(), ctx.nowDateTime().minusDays(PAYMENT_STALE_DAYS))
                .stream()
                .filter(intervention -> ctx.covers(intervention.getProperty()))
                .map(intervention -> item(intervention, ActionItemKind.INTERVENTION_UNPAID,
                        "warning", "En attente de règlement"))
                .forEach(items::add);

        return items;
    }

    private static ActionItemDto item(Intervention intervention, ActionItemKind kind,
                                      String severity, String detail) {
        return new ActionItemDto(
                // La nature entre dans l'identité : une même intervention peut
                // être à la fois en retard et sans exécutant, et ce sont deux
                // lignes distinctes, avec deux gestes distincts.
                prefixOf(kind) + ":" + intervention.getId(),
                kind,
                severity,
                intervention.getTitle(),
                detail,
                null,
                intervention.getId(),
                ActionItems.propertyId(intervention.getProperty()),
                ActionItems.propertyName(intervention.getProperty()),
                cost(intervention),
                null, null, null);
    }

    /** {@code overdue:} est conservé tel quel : c'est l'identité déjà connue du front. */
    private static String prefixOf(ActionItemKind kind) {
        return switch (kind) {
            case INTERVENTION_OVERDUE -> "overdue";
            case INTERVENTION_UNASSIGNED -> "intervention-unassigned";
            default -> "intervention-unpaid";
        };
    }

    /** Le montant réel s'il est connu, l'estimation sinon — jamais rien. */
    private static BigDecimal cost(Intervention intervention) {
        return intervention.getActualCost() != null
                ? intervention.getActualCost()
                : intervention.getEstimatedCost();
    }
}
