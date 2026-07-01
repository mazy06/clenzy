package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.payment.InterventionPaymentAgentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code settle_intervention_payment} — crée un lien de paiement Stripe Checkout
 * (groupé) pour RÉGLER les interventions impayées du demandeur (ménages, maintenance).
 *
 * <p><b>requiresConfirmation = true</b> : action sensible (argent) → l'orchestrateur
 * suspend et émet un {@code tool_confirmation_request} = la CARTE HITL « régler le
 * ménage ». L'exécution (création de la session Stripe) n'a lieu qu'après validation.</p>
 *
 * <p>Sécurité : le périmètre est org-scopé. En supervision, quand un logement est
 * sélectionné ({@code selectedPropertyId}), le paiement porte sur les interventions
 * impayées de CE logement ; sinon il retombe sur celles du demandeur lui-même (hostId
 * résolu depuis le JWT, jamais en paramètre). Agent : {@code fin}.</p>
 */
@Component
public class SettleInterventionPaymentTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SettleInterventionPaymentTool.class);
    private static final String NAME = "settle_intervention_payment";

    private final InterventionPaymentAgentService paymentService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SettleInterventionPaymentTool(InterventionPaymentAgentService paymentService, ObjectMapper objectMapper) {
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
            // Scope « logement supervisé » : règle les impayés du logement sélectionné
            // (supervision) ; sinon règle les impayés du demandeur (assistant général).
            String sessionUrl = context.selectedPropertyId() != null
                    ? paymentService.createPaymentLinkForProperty(context.selectedPropertyId())
                    : paymentService.createPaymentLink(context.keycloakId());
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sessionUrl", sessionUrl);
            payload.put("message", "Lien de paiement Stripe créé pour régler les interventions impayées.");
            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (StripeException e) {
            log.warn("settle_intervention_payment Stripe error: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Création de la session de paiement Stripe impossible (" + e.getMessage() + ")", e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize payment link", e);
        } catch (RuntimeException e) {
            // Cas typique : aucune intervention impayée.
            log.info("settle_intervention_payment: {}", e.getMessage());
            return ToolResult.error("Aucune intervention impayée à régler.");
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
            return ToolDescriptor.write(
                    NAME,
                    "Crée un lien de paiement Stripe (paiement groupé) pour RÉGLER les interventions "
                            + "impayées du demandeur (ménages, maintenance). Action financière sensible → "
                            + "confirmation requise. Périmètre : le logement supervisé si sélectionné, sinon "
                            + "les interventions impayées de l'utilisateur. Utiliser après detect_unpaid_interventions, pour 'régler le ménage', "
                            + "'payer mes interventions impayées'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
