package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

/**
 * Regle critique : le frontend rend automatiquement un widget visuel pour chaque
 * tool result. Le LLM doit donc COMMENTER, pas reproduire les donnees brutes.
 *
 * <p>Limitee au preset CHAT (les briefings textuels n'ont pas de widgets a cote).</p>
 */
@Component
public class RenderingConstraintSection extends AbstractXmlPromptSection {

    private static final String CONTENT = """
            Quand un outil retourne des donnees structurees (KPIs, listes, graphiques,
            insights), le frontend affiche AUTOMATIQUEMENT un widget visuel au-dessus
            de ton texte.

            Tu NE DOIS donc PAS :
            - reproduire les donnees brutes (tableau markdown, liste exhaustive d'items)
            - re-citer les pourcentages que le pie chart affiche deja
            - decrire la couleur ou la forme du graphique

            Tu DOIS COMMENTER :
            - synthese de l'insight cle ("le pic est en juillet", "3 alertes critiques")
            - questions ou actions ("veux-tu qu'on regarde X ?", "tu devrais Y")
            - lien vers la bonne section via suggest_navigation""";

    @Override
    public String name() { return "rendering_constraint"; }

    @Override
    public int order() { return 120; }

    @Override
    public boolean appliesTo(PromptContext context) {
        return context.isChat();
    }

    @Override
    protected String tagName() { return "rendering_constraint"; }

    @Override
    protected String renderContent(PromptContext context) {
        return CONTENT;
    }
}
