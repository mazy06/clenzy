package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
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
 * Tool {@code forget_fact} — supprime une entree de la memoire long-terme par cle.
 *
 * <p><b>requiresConfirmation = true</b> : la suppression est irreversible. On
 * demande une confirmation explicite avant d'effacer une cle (eviter qu'un
 * "oublie ca" interprete trop largement par le LLM ne fasse disparaitre
 * plusieurs preferences importantes).</p>
 */
@Component
public class ForgetFactTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ForgetFactTool.class);
    private static final String NAME = "forget_fact";

    private final AssistantMemoryService memoryService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ForgetFactTool(AssistantMemoryService memoryService, ObjectMapper objectMapper) {
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
        if (key == null || key.isBlank()) {
            throw new ToolExecutionException(NAME, "key est requis");
        }

        try {
            boolean forgotten = memoryService.forget(
                    context.organizationId(),
                    context.keycloakId(),
                    key);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("key", key);
            payload.put("forgotten", forgotten);
            payload.put("message", forgotten
                    ? "Memoire effacee : " + key
                    : "Aucune memoire trouvee pour la cle '" + key + "'");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("forget_fact failed for user {} key {}: {}",
                    context.keycloakId(), key, e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Suppression impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "key": {"type":"string","description":"Cle exacte de l'entree a supprimer (telle qu'enregistree par remember_fact)."}
                      },
                      "required": ["key"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Supprime une entree de la memoire long-terme de l'utilisateur a partir de sa cle. Necessite une confirmation user explicite (perte irreversible).",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
