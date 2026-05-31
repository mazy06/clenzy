package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Contexte RAG (extraits de doc Clenzy pertinents pour la question user).
 *
 * <p><b>Ameliorations v2</b> :</p>
 * <ul>
 *   <li>Format XML structure : chaque snippet est un {@code <snippet>} avec
 *       attributs {@code id}, {@code title}, {@code source}, {@code relevance}
 *       → le LLM peut citer precisement par id (« snippet [2] »)</li>
 *   <li>Suppression des regles anti-hallucination dupliquees (deja dans
 *       {@code AntiHallucinationSection}) — gain ~150 tokens</li>
 *   <li>Echappement XML systematique (defense en profondeur contre snippet
 *       contenant des pseudo-tags)</li>
 *   <li>Filtre relevance fait en amont par {@code SystemPromptComposerService}
 *       — cette section ne filtre pas elle-meme (SRP)</li>
 * </ul>
 *
 * <p>Cette section ne fait PAS de query DB elle-meme : les hits doivent etre
 * pre-calcules dans le {@link PromptContext#kbHits()}. C'est l'invocateur du
 * composer (orchestrator / briefing composer) qui decide quand declencher la
 * recherche.</p>
 */
@Component
public class RagContextSection extends AbstractXmlPromptSection {

    /** Longueur max d'un snippet rendu (anti-bloat context). Au-dela : truncation. */
    static final int MAX_SNIPPET_LENGTH = 600;

    @Override
    public String name() { return "kb_context"; }

    @Override
    public int order() { return 210; }

    @Override
    public boolean appliesTo(PromptContext context) {
        List<KbSearchService.KbSearchHit> hits = context.kbHits();
        return hits != null && !hits.isEmpty();
    }

    /** Les snippets RAG dependent du message courant → suffixe volatil. */
    @Override
    public boolean cacheable() { return false; }

    @Override
    protected String tagName() { return "kb_context"; }

    @Override
    protected String renderContent(PromptContext context) {
        List<KbSearchService.KbSearchHit> hits = context.kbHits();
        if (hits.isEmpty()) return null;

        StringBuilder sb = new StringBuilder(2048);
        sb.append("Extraits de la documentation Clenzy lies a la question :\n");
        for (int i = 0; i < hits.size(); i++) {
            KbSearchService.KbSearchHit h = hits.get(i);
            int idx = i + 1;
            sb.append("\n<snippet id=\"").append(idx).append("\"");
            sb.append(" title=\"").append(escapeXmlContent(nullSafe(h.title(), "Document"))).append('"');
            sb.append(" source=\"").append(escapeXmlContent(nullSafe(h.sourcePath(), "unknown"))).append('"');
            sb.append(" relevance=\"").append(Math.round(h.relevance() * 100)).append("%\">\n");
            sb.append(escapeXmlContent(truncateSnippet(h.snippet())));
            sb.append("\n</snippet>");
        }
        return sb.toString();
    }

    static String truncateSnippet(String snippet) {
        if (snippet == null) return "";
        String s = snippet.strip();
        if (s.length() <= MAX_SNIPPET_LENGTH) return s;
        return s.substring(0, MAX_SNIPPET_LENGTH - 3) + "...";
    }

    private static String nullSafe(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
