package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.Property;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Executeur {@code SUGGEST_CALENDAR_BLOCK} (fiche 08, F6c — vague 3 HITL) :
 * sur alerte bruit (trigger NOISE_ALERT), propose de bloquer le calendrier du
 * logement — JAMAIS d'execution automatique (risque eleve : fermeture de ventes).
 * L'apply de la suggestion ({@code CALENDAR_BLOCK}) appelle CalendarEngine.block
 * sur une plage courte a partir d'aujourd'hui ({@value #DEFAULT_BLOCK_DAYS} jours,
 * parametrable dans les donnees de la suggestion).
 *
 * <p>Regle recommandee : conditions {@code {"alertsLast24h": {"gte": 3}}} — le
 * moteur n'evalue la regle que sur une escalade averree (conditions numeriques
 * F6b sur les data du sujet). Sujet attendu : TYPE_NOISE_ALERT.</p>
 *
 * <p>Idempotence : dedup moteur (regle x alerte one-shot) + dedup par intitule en
 * attente cote file (les alertes suivantes de la meme rafale ne dupliquent pas la
 * proposition tant que l'operateur n'a pas statue).</p>
 */
@Service
public class SuggestCalendarBlockExecutor implements AutomationActionExecutor {

    /** Module « operations » de la constellation. */
    static final String MODULE_OPS = "ops";
    static final int DEFAULT_BLOCK_DAYS = 7;

    private final NoiseAlertRepository noiseAlertRepository;
    private final PropertyRepository propertyRepository;
    private final SupervisionSuggestionService suggestionService;
    private final ObjectMapper objectMapper;

    public SuggestCalendarBlockExecutor(NoiseAlertRepository noiseAlertRepository,
                                        PropertyRepository propertyRepository,
                                        SupervisionSuggestionService suggestionService,
                                        ObjectMapper objectMapper) {
        this.noiseAlertRepository = noiseAlertRepository;
        this.propertyRepository = propertyRepository;
        this.suggestionService = suggestionService;
        this.objectMapper = objectMapper;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SUGGEST_CALENDAR_BLOCK;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        if (!AutomationSubject.TYPE_NOISE_ALERT.equals(ctx.subjectType()) || ctx.subjectId() == null) {
            throw new IllegalStateException("SUGGEST_CALENDAR_BLOCK attend un sujet "
                    + AutomationSubject.TYPE_NOISE_ALERT + ", recu : " + ctx.subjectType()
                    + "#" + ctx.subjectId() + " (regle " + rule.getId() + ")");
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
        if (alert.getPropertyId() == null) {
            return ExecutionResult.skipped("Alerte " + alert.getId() + " sans logement associe");
        }

        Property property = propertyRepository.findById(alert.getPropertyId()).orElse(null);
        if (property == null) {
            throw new IllegalStateException("Propriete introuvable : " + alert.getPropertyId());
        }
        if (!ctx.orgId().equals(property.getOrganizationId())) {
            throw new IllegalStateException("Propriete " + property.getId()
                    + " hors de l'organisation " + ctx.orgId());
        }

        String params;
        try {
            params = objectMapper.writeValueAsString(Map.of("days", DEFAULT_BLOCK_DAYS));
        } catch (Exception e) {
            throw new IllegalStateException("Serialisation des params de suggestion impossible : "
                    + e.getMessage(), e);
        }

        Long alertsLast24h = ctx.dataAsLong(AutomationSubject.DATA_ALERTS_LAST_24H);
        String motif = "Incidents bruit repetes sur « " + property.getName() + " »"
                + (alertsLast24h != null ? " (" + alertsLast24h + " alertes sur 24 h)" : "")
                + ". Appliquer bloque le calendrier " + DEFAULT_BLOCK_DAYS
                + " jours a partir d'aujourd'hui (refuse si des nuits reservees existent "
                + "dans la plage) pour laisser le temps de traiter l'incident.";

        boolean created = suggestionService.recordActionableStrict(
                ctx.orgId(), property.getId(), MODULE_OPS, null,
                "Bloquer le calendrier de " + property.getName() + " suite aux incidents bruit",
                motif, SupervisionActionType.CALENDAR_BLOCK, params, null, "critical");
        return created
                ? ExecutionResult.executed()
                : ExecutionResult.skipped("Suggestion de blocage deja en attente pour ce logement");
    }
}
