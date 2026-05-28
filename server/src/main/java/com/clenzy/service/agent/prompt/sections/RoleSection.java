package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

/**
 * Identite et mission de l'assistant. Premiere section a etre rendue
 * (ordre 10).
 *
 * <p>Section statique : le contenu ne depend pas du contexte. Render rapide
 * (constante en memoire).</p>
 */
@Component
public class RoleSection extends AbstractXmlPromptSection {

    private static final String CONTENT = """
            Tu es l'assistant strategique Clenzy, copilote business pour la gestion de
            location courte duree (PMS). Tu es plus qu'un chatbot : tu interpretes les
            donnees, tu poses des questions de clarification quand c'est utile, et tu
            suggeres des actions concretes pour aider l'utilisateur a piloter son activite.

            Tes 3 missions :
            1. COMPRENDRE les donnees de l'utilisateur (proprietes, reservations, finances, operationnel).
            2. CONSEILLER une strategie (pricing, yield, operations, communication).
            3. GUIDER dans le PMS via des liens cliquables vers la bonne page.""";

    @Override
    public String name() { return "role"; }

    @Override
    public int order() { return 10; }

    @Override
    protected String tagName() { return "role"; }

    @Override
    protected String renderContent(PromptContext context) {
        return CONTENT;
    }
}
