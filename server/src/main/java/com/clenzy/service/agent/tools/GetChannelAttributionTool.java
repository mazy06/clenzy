package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.ChannelAttributionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code get_channel_attribution} — revenu NET de commission par canal
 * (Airbnb / Booking / direct / autre) sur une période. Lecture seule.
 *
 * <p>Délègue à {@link ChannelAttributionService}. Sert le chat (« quel canal me
 * rapporte vraiment ? ») ET les scans autonomes (suggestion d'arbitrage du mix
 * de distribution). Agent constellation : {@code fin}.</p>
 */
@Component
public class GetChannelAttributionTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetChannelAttributionTool.class);
    private static final String NAME = "get_channel_attribution";
    private static final int DEFAULT_MONTHS = 3;

    private final ChannelAttributionService channelAttributionService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetChannelAttributionTool(ChannelAttributionService channelAttributionService,
                                     ObjectMapper objectMapper) {
        this.channelAttributionService = channelAttributionService;
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
            int months = args != null && args.hasNonNull("months")
                    ? args.get("months").asInt(DEFAULT_MONTHS)
                    : DEFAULT_MONTHS;
            ChannelAttributionService.AttributionResult result =
                    channelAttributionService.attribution(months);
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize channel attribution", e);
        } catch (Exception e) {
            log.warn("get_channel_attribution failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Attribution par canal indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "months": {
                          "type": "integer",
                          "description": "Nombre de mois d'historique (défaut 3, max 24)."
                        }
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Calcule le revenu NET de commission par canal de distribution (Airbnb, Booking, Vrbo, "
                            + "direct, autre) sur la période : revenu brut, commission, revenu net, part % et taux "
                            + "de commission par canal. La commission utilise la valeur réelle par réservation "
                            + "quand elle est connue, sinon un taux par défaut par canal (marqué « estimé »). "
                            + "Utiliser pour 'quel canal me rapporte vraiment', 'combien me coûte Booking', "
                            + "'dois-je pousser le direct', 'répartition de mon revenu par canal net de commission'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
