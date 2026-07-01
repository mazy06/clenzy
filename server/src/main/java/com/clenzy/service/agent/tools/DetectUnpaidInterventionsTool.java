package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.payment.InterventionPaymentAgentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code detect_unpaid_interventions} — interventions (ménages, maintenance)
 * planifiées mais NON RÉGLÉES, groupées par logement avec le montant dû. En supervision,
 * si un logement est sélectionné ({@code selectedPropertyId}) le scope est CE logement ;
 * sinon les impayés du demandeur. Lecture seule. Agent constellation : {@code fin}.
 *
 * <p>Sert à ce que l'agent « voie » les ménages impayés avant de proposer leur
 * règlement via {@code settle_intervention_payment}.</p>
 */
@Component
public class DetectUnpaidInterventionsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(DetectUnpaidInterventionsTool.class);
    private static final String NAME = "detect_unpaid_interventions";

    private final InterventionPaymentAgentService paymentService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public DetectUnpaidInterventionsTool(InterventionPaymentAgentService paymentService, ObjectMapper objectMapper) {
        this.paymentService = paymentService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        try {
            // Scope « logement supervisé » : si un logement est sélectionné dans l'UI
            // (supervision), on cible ce logement quel que soit le demandeur ; sinon on
            // retombe sur les impayés du demandeur (assistant général).
            HostBalanceSummaryDto summary = context.selectedPropertyId() != null
                    ? paymentService.unpaidSummaryForProperty(context.selectedPropertyId())
                    : paymentService.unpaidSummary(context.keycloakId());
            return ToolResult.success(objectMapper.writeValueAsString(summary), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize unpaid interventions", e);
        } catch (Exception e) {
            log.warn("detect_unpaid_interventions failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Détection des interventions impayées indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {},
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Liste les interventions (ménages, maintenance) PLANIFIÉES mais NON RÉGLÉES (impayées), "
                            + "groupées par logement, avec le montant dû et le total. Utiliser pour 'ai-je des "
                            + "ménages non payés', 'interventions impayées', 'qu'est-ce que je dois régler'. "
                            + "Si le total est > 0, proposer le règlement via settle_intervention_payment.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
