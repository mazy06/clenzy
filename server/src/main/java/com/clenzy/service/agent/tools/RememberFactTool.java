package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AssistantMemory;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code remember_fact} — enregistre une entree de memoire long-terme pour l'user.
 *
 * <p><b>requiresConfirmation = false</b> : risque faible (texte stocke, pas d'effet
 * de bord sur les ressources metier). On laisse le LLM enregistrer librement les
 * preferences et faits utiles glanes au fil des conversations. L'user peut toujours
 * lister puis {@code forget_fact} ce qu'il veut oublier.</p>
 *
 * <p>Le tool fait un upsert sur la cle : si la meme {@code key} est re-soumise,
 * la valeur est mise a jour (utile quand l'user precise une info initialement
 * vague).</p>
 */
@Component
public class RememberFactTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(RememberFactTool.class);
    private static final String NAME = "remember_fact";

    private final AssistantMemoryService memoryService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public RememberFactTool(AssistantMemoryService memoryService, ObjectMapper objectMapper) {
        this.memoryService = memoryService;
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
        String key = args.path("key").asText(null);
        String value = args.path("value").asText(null);
        String scopeRaw = args.path("scope").asText(null);

        if (key == null || key.isBlank()) {
            throw new ToolExecutionException(NAME, "key est requis");
        }
        if (value == null || value.isBlank()) {
            throw new ToolExecutionException(NAME, "value est requis");
        }

        AssistantMemory.Scope scope = AssistantMemory.Scope.fromString(scopeRaw);
        if (scope == null) {
            throw new ToolExecutionException(NAME,
                    "scope invalide : doit etre preference, fact, goal ou project");
        }

        try {
            AssistantMemory saved = memoryService.upsert(
                    context.organizationId(),
                    context.keycloakId(),
                    key, value, scope);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("status", "remembered");
            payload.put("key", saved.getMemoryKey());
            payload.put("scope", scope.dbValue());
            payload.put("message",
                    "Memoire enregistree : " + saved.getMemoryKey() + " (" + scope.dbValue() + ")");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage(), e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("remember_fact failed for user {}: {}", context.keycloakId(), e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Memoire indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "key":   {"type":"string","description":"Cle stable et explicite, snake_case (ex: user_prefers_metric, briefing_time, owner_42_difficile). Max 120 chars."},
                        "value": {"type":"string","description":"Valeur libre associee a la cle (ex: true, 08:00, 'proprietaire difficile, prefere les emails')."},
                        "scope": {"type":"string","enum":["preference","fact","goal","project"],"description":"Categorisation : preference (timezone, format, briefing time), fact (info persistante sur owner/property/guest), goal (objectif business mesurable), project (chantier en cours avec deadline)."}
                      },
                      "required": ["key","value","scope"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Enregistre une information dans la memoire long-terme de l'utilisateur (preference, fait, objectif, projet). A utiliser des que l'user donne une info qui sera utile dans les conversations futures, meme implicitement. La cle doit etre stable et explicite (snake_case) pour permettre la mise a jour future. Pas de confirmation requise.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
