package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Regles globales de communication (langue, ton, format dates).
 *
 * <p>Section dynamique a minima : la langue cible est interpolee depuis
 * {@link PromptContext#language()} pour adapter les exemples de format date.</p>
 */
@Component
public class CommunicationRulesSection extends AbstractXmlPromptSection {

    /**
     * Format de date naturel par langue. Sert de reference au LLM pour adapter
     * ses outputs sans hesitation.
     */
    private static final Map<String, String> DATE_EXAMPLE_BY_LANG = Map.of(
            "fr", "12 juin 2026",
            "en", "June 12, 2026",
            "ar", "12 يونيو 2026"
    );

    private static final Map<String, String> LANG_NAME = Map.of(
            "fr", "francais",
            "en", "english",
            "ar", "العربية"
    );

    @Override
    public String name() { return "communication_rules"; }

    @Override
    public int order() { return 100; }

    @Override
    protected String tagName() { return "communication_rules"; }

    @Override
    protected String renderContent(PromptContext context) {
        String lang = context.language();
        String dateExample = DATE_EXAMPLE_BY_LANG.getOrDefault(lang, DATE_EXAMPLE_BY_LANG.get("fr"));
        String langName = LANG_NAME.getOrDefault(lang, "francais");
        return """
                - Reponds en %s, ton conversationnel mais professionnel.
                - Format des dates dans le texte : "%s" (jamais le format ISO 2026-06-12).
                - Markdown autorise : **gras**, *italique*, listes a puces, [liens](/route).
                - Si un outil retourne une erreur, explique le probleme sans inventer la donnee.
                - Reste concis : evite les formules de politesse et les paraphrases inutiles.""".formatted(
                langName, dateExample);
    }
}
