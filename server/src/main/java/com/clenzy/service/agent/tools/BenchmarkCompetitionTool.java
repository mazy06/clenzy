package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.analytics.CompetitionBenchmarkService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tool {@code benchmark_competition} — positionnement prix vs marché : interroge
 * la/les source(s) de données de marché activée(s) (PriceLabs, Beyond…) et compare
 * au prix courant. Plusieurs sources présentées en concurrence. Lecture seule.
 *
 * <p>Délègue à {@link CompetitionBenchmarkService}. Agent constellation : {@code rev}.</p>
 */
@Component
public class BenchmarkCompetitionTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(BenchmarkCompetitionTool.class);
    private static final String NAME = "benchmark_competition";
    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final CompetitionBenchmarkService competitionBenchmarkService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public BenchmarkCompetitionTool(CompetitionBenchmarkService competitionBenchmarkService,
                                    ObjectMapper objectMapper) {
        this.competitionBenchmarkService = competitionBenchmarkService;
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
            if (args == null || !args.hasNonNull("propertyId")) {
                return ToolResult.error("Paramètre 'propertyId' requis.");
            }
            Long propertyId = args.get("propertyId").asLong();
            int windowDays = args.hasNonNull("windowDays")
                    ? args.get("windowDays").asInt(DEFAULT_WINDOW_DAYS)
                    : DEFAULT_WINDOW_DAYS;
            CompetitionBenchmarkService.BenchmarkResult result =
                    competitionBenchmarkService.benchmark(propertyId, windowDays);
            return ToolResult.success(objectMapper.writeValueAsString(result), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize benchmark", e);
        } catch (Exception e) {
            log.warn("benchmark_competition failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Benchmark concurrence indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {
                          "type": "integer",
                          "description": "Identifiant du logement à positionner."
                        },
                        "windowDays": {
                          "type": "integer",
                          "description": "Fenêtre en jours (défaut 30, max 180)."
                        }
                      },
                      "required": ["propertyId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Positionne le prix d'un logement face au MARCHÉ : interroge la/les source(s) de "
                            + "données de marché activée(s) (PriceLabs, Beyond, Wheelhouse) et compare au prix "
                            + "courant. Plusieurs sources sont présentées en concurrence (côte à côte) avec "
                            + "ton prix moyen, le prix marché moyen, l'écart %, la confiance et le positionnement "
                            + "(UNDERPRICED/ALIGNED/OVERPRICED). Lecture seule (ne change aucun prix). Utiliser "
                            + "pour 'suis-je au bon prix', 'benchmark concurrence', 'positionnement marché', "
                            + "'mes prix vs le marché'. Nécessite une source configurée et activée.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
