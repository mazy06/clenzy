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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code search_knowledge_base} — recherche dans la doc Baitly (RAG).
 *
 * <p>Le LLM invoque ce tool quand il veut une reponse sourcee ("selon la doc
 * Baitly..."). L'auto-injection RAG dans l'orchestrateur peut aussi fournir
 * du contexte sans appel explicite — les deux mecanismes sont complementaires.</p>
 *
 * <p>Un seuil plancher ({@code clenzy.ai.embeddings.tool-relevance-floor}) ecarte
 * les hits tres faibles : les instructions anti-hallucination du prompt restent la
 * derniere ligne de defense, mais on evite de tenter le LLM avec du bruit.</p>
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
    private final double relevanceFloor;

    public SearchKnowledgeBaseTool(KbSearchService searchService, ObjectMapper objectMapper,
                                     @Value("${clenzy.ai.embeddings.tool-relevance-floor:0.50}")
                                     double relevanceFloor) {
        this.searchService = searchService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
        this.relevanceFloor = relevanceFloor;
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
                    query, context.organizationId(), topK, context.language());

            List<Map<String, Object>> items = hits.stream()
                    .filter(h -> h.relevance() >= relevanceFloor)
                    .map(h -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("documentId", h.documentId());
                m.put("title", h.title());
                m.put("sourcePath", h.sourcePath());
                m.put("snippet", truncate(h.snippet()));
                m.put("relevance", h.relevance());
                return m;
            }).toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", "Documentation Baitly");
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

    /** Le tool est plus verbeux que l'auto-injection (topK 5-10) : on borne chaque snippet. */
    private static final int TOOL_SNIPPET_MAX_CHARS = 800;

    private static String truncate(String snippet) {
        if (snippet == null || snippet.length() <= TOOL_SNIPPET_MAX_CHARS) return snippet;
        return snippet.substring(0, TOOL_SNIPPET_MAX_CHARS - 1) + "…";
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "query": {"type":"string","description":"Question ou mots-cles a rechercher dans la documentation Baitly"},
                        "topK":  {"type":"integer","minimum":1,"maximum":10,"description":"Nombre max de resultats (defaut 5)"}
                      },
                      "required": ["query"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Recherche RAG (embeddings) dans la doc officielle Baitly + notes internes de l'org. Renvoie des snippets avec source et score. Pour citer la doc avec sources.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
