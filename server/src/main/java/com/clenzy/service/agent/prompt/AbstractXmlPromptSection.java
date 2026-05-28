package com.clenzy.service.agent.prompt;

import java.util.Optional;

/**
 * Base utilitaire pour les sections qui rendent un bloc XML simple
 * {@code <tag>...</tag>}.
 *
 * <p>Factorise la generation des balises ouvrante/fermante et l'echappement
 * des caracteres XML reserves dans le contenu interpolation (mais PAS dans
 * le contenu statique declaratif — c'est au prompt designer de bien former
 * son XML).</p>
 *
 * <p>Les sections plus complexes (multi-tags, structures imbriquees) peuvent
 * implementer directement {@link PromptSection} sans heriter de cette classe.</p>
 */
public abstract class AbstractXmlPromptSection implements PromptSection {

    /** Tag XML englobant le contenu de la section. */
    protected abstract String tagName();

    /**
     * Contenu interieur du tag. Retourne null/empty pour skip la section
     * (ex: memory section avec 0 entries).
     *
     * <p><b>WARNING</b> : le contenu N'EST PAS echappe. Si tu interpoles des
     * donnees user (memory values, RAG snippets, currentPage), passe par
     * {@link #escapeXmlContent(String)} avant l'insertion.</p>
     */
    protected abstract String renderContent(PromptContext context);

    @Override
    public final Optional<String> render(PromptContext context) {
        String content = renderContent(context);
        if (content == null || content.isBlank()) return Optional.empty();
        String tag = tagName();
        StringBuilder sb = new StringBuilder(content.length() + tag.length() * 2 + 8);
        sb.append('<').append(tag).append(">\n");
        sb.append(content.strip());
        sb.append("\n</").append(tag).append('>');
        return Optional.of(sb.toString());
    }

    /**
     * Echappe les 5 caracteres XML reserves : {@code & < > " '}.
     *
     * <p>A appeler sur toute valeur utilisateur (memory value, rag snippet,
     * currentPage path, etc.) avant de l'inserer dans le contenu XML, pour
     * eviter qu'un attaquant injecte des pseudo-tags dans le system prompt
     * (prompt injection lite).</p>
     *
     * <p>Performance : O(n) en taille du texte. Allocations minimales si pas
     * de caractere a echapper (early return sur scan).</p>
     */
    protected static String escapeXmlContent(String s) {
        if (s == null || s.isEmpty()) return s;
        // Fast-path : scan sans allouer si pas de caractere reserve
        boolean needsEscape = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '&' || c == '<' || c == '>' || c == '"' || c == '\'') {
                needsEscape = true;
                break;
            }
        }
        if (!needsEscape) return s;

        StringBuilder out = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&apos;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
