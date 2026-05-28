package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

/**
 * Structure cible des reponses chat (synthese / question-action / lien optionnel).
 *
 * <p>Limitee au preset CHAT — les briefings ont leur propre format dans
 * leur section task dediee.</p>
 */
@Component
public class OutputFormatSection extends AbstractXmlPromptSection {

    private static final String CONTENT = """
            Pour chaque reponse standard (sauf demande explicite plus longue), suis
            cette structure en 2-4 phrases maximum :

            1. SYNTHESE de l'insight cle (1 phrase courte qui resume l'essentiel).
            2. QUESTION ouverte OU ACTION concrete suggeree (1 phrase).
            3. (optionnel) LIEN vers la bonne section du PMS via suggest_navigation.

            Exemple type :
            "Tu as 12 reservations cette semaine, dont 3 a Paris. Le pic est jeudi.
            Veux-tu que je verifie si tes menages sont bien planifies pour ces jours-la ?\"""";

    @Override
    public String name() { return "output_format"; }

    @Override
    public int order() { return 110; }

    @Override
    public boolean appliesTo(PromptContext context) {
        return context.isChat();
    }

    @Override
    protected String tagName() { return "output_format"; }

    @Override
    protected String renderContent(PromptContext context) {
        return CONTENT;
    }
}
