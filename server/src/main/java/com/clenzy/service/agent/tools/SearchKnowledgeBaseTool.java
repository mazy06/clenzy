package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.service.agent.kb.KbSearchService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code search_knowledge_base} — recherche dans la doc Clenzy (RAG).
 *
 * <p>Le LLM invoque ce tool quand il veut une reponse sourcee ("selon la doc
 * Clenzy..."). L'auto-injection RAG dans l'orchestrateur peut aussi fournir
 * du contexte sans appel explicite — les deux mecanismes sont complementaires.</p>
 */
@Component
public class SearchKnowledgeBaseTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SearchKnowledgeBaseTool.class);
    private static final String NAME = "search_knowledge_base";
    private static final int DEFAULT_TOP_K = 5;
    private static final int MAX_TOP_K = 10;

    private final KbSearchService searchService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SearchKnowledgeBaseTool(KbSearchService searchService, ObjectMapper objectMapper) {
        this.searchService = searchService;
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
        String query = args.path("query").asText(null);
        if (query == null || query.isBlank()) {
            throw new ToolExecutionException(NAME, "query est requis");
        }
        int topK = Math.min(MAX_TOP_K, Math.max(1, args.path("topK").asInt(DEFAULT_TOP_K)));

        try {
            List<KbSearchService.KbSearchHit> hits = searchService.search(
                    query, context.organizationId(), topK);

            List<Map<String, Object>> items = hits.stream().map(h -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("documentId", h.documentId());
                m.put("title", h.title());
                m.put("sourcePath", h.sourcePath());
                m.put("snippet", h.snippet());
                m.put("relevance", h.relevance());
                return m;
            }).toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", "Documentation Clenzy");
            payload.put("query", query);
            payload.put("items", items);
            payload.put("count", items.size());

            return ToolResult.success(objectMapper.writeValueAsString(payload), "knowledge");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize KB results", e);
        } catch (Exception e) {
            log.warn("search_knowledge_base failed for query '{}' : {}", query, e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Recherche doc indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "query": {"type":"string","description":"Question ou mots-cles a rechercher dans la documentation Clenzy"},
                        "topK":  {"type":"integer","minimum":1,"maximum":10,"description":"Nombre max de resultats (defaut 5)"}
                      },
                      "required": ["query"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Recherche dans la documentation officielle Clenzy + les notes internes de l'organisation via embeddings (RAG). Utiliser pour repondre 'selon la doc Clenzy...' avec citations sourcees. Renvoie une liste de snippets pertinents avec leur titre, source et score de relevance.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
