package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Contexte d'execution courant (page UI, propriete focus, langue, date).
 *
 * <p>Cette section etait MANQUANTE dans l'ancien systeme : l'AgentContext
 * portait deja {@code currentPage} et {@code selectedPropertyId} mais ils
 * n'etaient jamais injectes dans le prompt. Le LLM ne savait donc pas ou se
 * trouvait l'user dans le PMS, ce qui limitait les inferences contextuelles
 * (ex: "tu regardes les reservations de Bastille, alors...").</p>
 *
 * <p>Section dynamique : seule la date est toujours presente, le reste est
 * optionnel. Si tout est null/vide, la section ne render que la date.</p>
 */
@Component
public class ContextSection extends AbstractXmlPromptSection {

    private static final DateTimeFormatter HUMAN_DATE_FR =
            DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.FRENCH);
    private static final DateTimeFormatter HUMAN_DATE_EN =
            DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);

    @Override
    public String name() { return "context"; }

    @Override
    public int order() { return 20; }

    @Override
    protected String tagName() { return "context"; }

    @Override
    protected String renderContent(PromptContext context) {
        StringBuilder sb = new StringBuilder(256);

        // Date courante en langue cible
        DateTimeFormatter fmt = switch (context.language()) {
            case "en" -> HUMAN_DATE_EN;
            default -> HUMAN_DATE_FR;
        };
        sb.append("Date du jour : ").append(context.today().format(fmt));

        // Page UI courante (echappee pour eviter prompt injection)
        String currentPage = context.agentContext().currentPage();
        if (currentPage != null && !currentPage.isBlank()) {
            sb.append("\nPage actuelle dans le PMS : ").append(escapeXmlContent(currentPage));
        }

        // Propriete selectionnee
        Long propertyId = context.agentContext().selectedPropertyId();
        if (propertyId != null) {
            sb.append("\nPropriete actuellement focus dans l'UI : id=").append(propertyId);
            sb.append(" (l'utilisateur la regarde, prefere les analyses sur cette propriete)");
        }

        sb.append("\nLangue de l'utilisateur : ").append(context.language());

        return sb.toString();
    }
}
