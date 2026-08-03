package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Les propositions des agents de la constellation, dans « À traiter ».
 *
 * <p>Les deux files vivaient côte à côte sans se connaître : le tableau de bord
 * lisait {@code action_item}, la constellation {@code supervision_suggestion},
 * et aucune passerelle entre les deux. Une même journée de travail se lisait
 * donc différemment selon l'écran ouvert — et une carte d'agent restait
 * invisible pour qui ne dépliait pas le planning.</p>
 *
 * <p>Cette source ne duplique rien : elle expose la file des agents dans la
 * file générale, avec son type d'action et ses paramètres. La décision, elle,
 * se prend dans la constellation — c'est là que vivent les écrans qui donnent
 * le contexte (simulation tarifaire, brouillon de réponse d'avis). La carte du
 * tableau de bord y renvoie.</p>
 */
@Component
public class SupervisionSuggestionActionSource implements ActionItemSource {

    /**
     * Le litige bancaire est DÉJÀ porté par {@code PAYMENT_INCIDENT} (même
     * événement Stripe, deux écritures voulues). L'exposer une seconde fois
     * ferait deux lignes pour un seul litige.
     */
    private static final Set<String> ALREADY_COVERED = Set.of(
            SupervisionActionType.CHARGEBACK_SUBMIT);

    private final SupervisionSuggestionRepository suggestionRepository;
    private final PropertyRepository propertyRepository;

    public SupervisionSuggestionActionSource(SupervisionSuggestionRepository suggestionRepository,
                                             PropertyRepository propertyRepository) {
        this.suggestionRepository = suggestionRepository;
        this.propertyRepository = propertyRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.AGENT_CARD);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return suggestionRepository
                .findByOrganizationIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                        ctx.organizationId(), SupervisionSuggestion.STATUS_PENDING, ctx.now())
                .stream()
                // Seules les cartes ACTIONNABLES : une carte informative de la
                // constellation n'appelle pas de décision, elle n'a rien à faire
                // dans une file d'actions.
                .filter(s -> s.getActionType() != null && !s.getActionType().isBlank())
                .filter(s -> !ALREADY_COVERED.contains(s.getActionType()))
                // Périmètre propriétaire : un hôte ne voit que ses logements. Les
                // cartes org-level (litige, RGPD, site) n'ont pas de logement
                // propre — elles restent réservées aux profils non restreints.
                .filter(s -> !ctx.isOwnerScoped()
                        || (!s.isOrgLevel() && ctx.covers(
                                propertyRepository.findById(s.getPropertyId()).orElse(null))))
                .map(s -> new ActionItemDto(
                        "agent-card:" + s.getId(),
                        ActionItemKind.AGENT_CARD,
                        severityOf(s),
                        s.getTitle(),
                        s.getMotif(),
                        null,
                        s.getId(),
                        s.isOrgLevel() ? null : s.getPropertyId(),
                        null,
                        s.getEstimatedImpactCents() != null
                                ? BigDecimal.valueOf(s.getEstimatedImpactCents(), 2) : null,
                        null,
                        s.getActionType(),
                        s.getActionParams()))
                .toList();
    }

    /** La sévérité de la carte, repliée sur « warning » quand elle est muette. */
    private String severityOf(SupervisionSuggestion suggestion) {
        final String severity = suggestion.getSeverity();
        return severity == null || severity.isBlank() ? "warning" : severity;
    }
}
