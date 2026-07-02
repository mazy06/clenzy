package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Tool {@code suggest_navigation} — propose a l'utilisateur d'aller sur une
 * page du PMS via une CTA card avec lien cliquable.
 *
 * <p><b>Particularite</b> : ce tool ne fetch aucune donnee — il sert juste a
 * produire un widget de navigation que le LLM peut afficher quand il guide
 * l'utilisateur ("pour configurer X, va sur Settings > Pricing"). Le frontend
 * rend une card avec un bouton qui navigue via React Router (pas de full reload).</p>
 *
 * <p>Validation : le path doit etre une route PMS connue (whitelist) pour
 * eviter que le LLM hallucine des URLs.</p>
 */
@Component
public class SuggestNavigationTool implements ToolHandler {

    private static final String NAME = "suggest_navigation";

    /**
     * Whitelist des routes PMS valides. Synchroniser avec
     * {@code client/src/modules/AuthenticatedApp.tsx} quand on ajoute des pages.
     * Format : "/route" (les query params sont autorises).
     */
    private static final Set<String> ALLOWED_ROUTES = Set.of(
            "/dashboard",
            "/assistant",
            "/properties",
            "/interventions",
            "/reservations",
            "/planning",
            "/directory",
            "/contact",
            "/documents",
            "/reports",
            "/tarification",
            "/billing",
            "/contracts",
            "/channels",
            "/booking-engine",
            "/shop",
            "/settings",
            "/monitoring"
    );

    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SuggestNavigationTool(ObjectMapper objectMapper) {
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
        String path = required(args, "path");
        String label = required(args, "label");
        String reason = required(args, "reason");

        // Validate the path is in our whitelist (strip query string for the check)
        String basePath = path.contains("?") ? path.substring(0, path.indexOf('?')) : path;
        if (!ALLOWED_ROUTES.contains(basePath)) {
            throw new ToolExecutionException(NAME,
                    "Route '" + path + "' non autorisee. Routes valides : " + ALLOWED_ROUTES
                            + ". Utiliser exactement une de ces routes (avec query string optionnel).");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("path", path);
        payload.put("label", label);
        payload.put("reason", reason);
        // Icone optionnelle : le LLM peut suggerer un Lucide icon name
        String iconName = optString(args, "icon");
        if (iconName != null) payload.put("icon", iconName);

        try {
            return ToolResult.success(objectMapper.writeValueAsString(payload), "navigation");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize navigation hint", e);
        }
    }

    private static String required(JsonNode args, String key) {
        if (!args.hasNonNull(key) || args.path(key).asText("").isBlank()) {
            throw new ToolExecutionException(NAME, "Champ '" + key + "' requis");
        }
        return args.path(key).asText();
    }

    private static String optString(JsonNode args, String key) {
        if (!args.hasNonNull(key)) return null;
        String s = args.path(key).asText("");
        return s.isBlank() ? null : s;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "path":   {"type":"string","description":"Route PMS exacte (ex: /settings, /properties, /tarification, /reports?tab=financial). REQUIS et doit faire partie des routes connues."},
                        "label":  {"type":"string","description":"Label du bouton CTA (ex: 'Configurer la tarification', 'Voir les rapports', 'Parametres IA'). REQUIS."},
                        "reason": {"type":"string","description":"Explication courte de pourquoi aller la (1 phrase). Sera affichee sous le titre. REQUIS."},
                        "icon":   {"type":"string","description":"Nom d'icone Lucide optionnel (Settings, Home, ChartBar, Euro, etc.)"}
                      },
                      "required": ["path","label","reason"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Propose un BOUTON CLIQUABLE redirigeant vers une page du PMS (ex: /settings, /properties, /reports?tab=financial). Pour 'ou faire X', 'comment configurer Y'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
