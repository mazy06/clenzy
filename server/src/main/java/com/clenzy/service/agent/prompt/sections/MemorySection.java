package com.clenzy.service.agent.prompt.sections;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Memoire long-terme du user — refactor de l'ancien {@code renderMemorySection}
 * de {@code AgentOrchestrator}.
 *
 * <p><b>Ameliorations v2</b> :</p>
 * <ul>
 *   <li>Format XML structure (vs key=value rugueux) → le LLM interprete mieux
 *       les valeurs longues et hierarchise les scopes</li>
 *   <li>Echappement XML des memory values (prompt injection via memory key/value
 *       n'est plus possible)</li>
 *   <li>Skip silencieux si toutes les memories ont un scope inconnu (fallback safe)</li>
 *   <li>Truncation des valeurs > 200 chars pour eviter de polluer le context
 *       (memory value tres longue = probablement bug, mieux vaut tronquer
 *       avec marqueur)</li>
 * </ul>
 *
 * <p>Limitee aux 4 scopes documentes. Toute memory avec scope inconnu est
 * skippee (defensive : evite que des donnees corrompues cassent le rendering).</p>
 */
@Component
public class MemorySection extends AbstractXmlPromptSection {

    /** Limite par valeur (anti-bloat). Au-dela, on tronque avec marqueur "...". */
    static final int MAX_VALUE_LENGTH = 200;

    /** Label affiche pour chaque scope, dans l'ordre d'apparition souhaite. */
    private static final Map<AssistantMemory.Scope, String> SCOPE_LABELS;
    static {
        SCOPE_LABELS = new EnumMap<>(AssistantMemory.Scope.class);
        SCOPE_LABELS.put(AssistantMemory.Scope.PREFERENCE, "preferences");
        SCOPE_LABELS.put(AssistantMemory.Scope.FACT, "facts");
        SCOPE_LABELS.put(AssistantMemory.Scope.GOAL, "goals");
        SCOPE_LABELS.put(AssistantMemory.Scope.PROJECT, "projects");
    }

    @Override
    public String name() { return "memory"; }

    @Override
    public int order() { return 200; }

    @Override
    public boolean appliesTo(PromptContext context) {
        return context.memories() != null && !context.memories().isEmpty();
    }

    @Override
    protected String tagName() { return "memory"; }

    @Override
    protected String renderContent(PromptContext context) {
        Map<AssistantMemory.Scope, List<AssistantMemory>> byScope = new EnumMap<>(AssistantMemory.Scope.class);
        for (AssistantMemory m : context.memories()) {
            AssistantMemory.Scope scope = m.getScopeEnum();
            if (scope == null) continue;
            byScope.computeIfAbsent(scope, k -> new ArrayList<>()).add(m);
        }
        if (byScope.isEmpty()) return null;  // tous les memories avaient un scope inconnu

        StringBuilder sb = new StringBuilder(512);
        for (Map.Entry<AssistantMemory.Scope, String> entry : SCOPE_LABELS.entrySet()) {
            List<AssistantMemory> bucket = byScope.get(entry.getKey());
            if (bucket == null || bucket.isEmpty()) continue;
            if (!sb.isEmpty()) sb.append('\n');
            sb.append('<').append(entry.getValue()).append(">\n");
            for (AssistantMemory m : bucket) {
                sb.append("  - ")
                        .append(escapeXmlContent(safeKey(m.getMemoryKey())))
                        .append(": ")
                        .append(escapeXmlContent(truncate(m.getMemoryValue())))
                        .append('\n');
            }
            sb.append("</").append(entry.getValue()).append('>');
        }
        return sb.toString();
    }

    /** Tronque les valeurs trop longues — protection anti-bloat du context. */
    static String truncate(String value) {
        if (value == null) return "";
        if (value.length() <= MAX_VALUE_LENGTH) return value;
        return value.substring(0, MAX_VALUE_LENGTH - 3) + "...";
    }

    /** Cle vide ou null → marqueur explicite ("(no_key)"). */
    private static String safeKey(String key) {
        if (key == null || key.isBlank()) return "(no_key)";
        return key;
    }
}
