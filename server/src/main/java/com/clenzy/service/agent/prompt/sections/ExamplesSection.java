package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Few-shot examples injectes dans le prompt pour guider le LLM par
 * demonstration plutot que par description seule.
 *
 * <p><b>Pourquoi</b> : les LLM imitent mieux qu'ils ne suivent des regles
 * abstraites. Une demonstration de "comment formater la reponse parfaite"
 * vaut 5 paragraphes de regles. Documente dans la litterature Anthropic
 * Claude prompt engineering best practices.</p>
 *
 * <p><b>Limitations</b> :</p>
 * <ul>
 *   <li>Limitee au preset CHAT (briefings ont leur propre format dans
 *       leur task section)</li>
 *   <li>Charge jusqu'a {@value #MAX_EXAMPLES_INJECTED} examples — au-dela,
 *       le ratio cout/benefice se degrade (~150 tokens / example)</li>
 *   <li>Skip silencieusement si aucun example dans le YAML</li>
 * </ul>
 *
 * <p><b>OCP future</b> : pour selectionner dynamiquement les examples en
 * fonction du message user (ex: detecter intent "simulation" -> ne montrer
 * que les examples de cette categorie), il suffirait d'ajouter un champ
 * "detectedIntent" dans {@link PromptContext} et filtrer ici via
 * {@code exampleLoader.getByCategory(intent)}. Pas implemente en v1 pour
 * eviter de complexifier sans mesure d'impact.</p>
 */
@Component
public class ExamplesSection extends AbstractXmlPromptSection {

    /**
     * Plafond defensif : on n'injecte jamais plus de N examples meme si la
     * YAML en contient plus. Garde le prompt sous controle de cout.
     */
    static final int MAX_EXAMPLES_INJECTED = 3;

    private final ExampleLoader exampleLoader;

    public ExamplesSection(ExampleLoader exampleLoader) {
        this.exampleLoader = exampleLoader;
    }

    @Override
    public String name() { return "examples"; }

    @Override
    public int order() { return 310; }

    @Override
    public boolean appliesTo(PromptContext context) {
        return context.isChat() && !exampleLoader.isEmpty();
    }

    @Override
    protected String tagName() { return "examples"; }

    @Override
    protected String renderContent(PromptContext context) {
        List<PromptExample> all = exampleLoader.getAll();
        if (all.isEmpty()) return null;

        // Limite defensive
        List<PromptExample> selected = all.size() > MAX_EXAMPLES_INJECTED
                ? all.subList(0, MAX_EXAMPLES_INJECTED)
                : all;

        StringBuilder sb = new StringBuilder(2048);
        sb.append("Voici des exemples de reponses ideales. Inspire-toi du format et du ton, ")
                .append("PAS du contenu specifique (chaque cas user est different).\n");

        for (PromptExample ex : selected) {
            sb.append("\n<example category=\"").append(escapeXmlContent(ex.category())).append("\">\n");
            sb.append("  <user>").append(escapeXmlContent(ex.user())).append("</user>\n");
            if (ex.thinking() != null && !ex.thinking().isBlank()) {
                sb.append("  <thinking>").append(escapeXmlContent(ex.thinking().strip())).append("</thinking>\n");
            }
            sb.append("  <assistant>").append(escapeXmlContent(ex.assistant().strip())).append("</assistant>\n");
            sb.append("</example>");
        }

        return sb.toString();
    }
}
