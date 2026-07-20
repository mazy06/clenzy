package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

/**
 * Regles strictes anti-hallucination, surtout pour le RAG.
 *
 * <p>Applicable a tous les presets — l'anti-hallucination est universel.</p>
 *
 * <p>NOTE : ces regles font echo aux instructions inserees par le
 * {@code RagContextSection} quand des snippets sont present. La duplication
 * est volontaire : reinforcement par repetition est documente comme effectif
 * pour reduire l'hallucination dans la litterature LLM (Anthropic Claude best
 * practices, voir constitutional AI papers).</p>
 */
@Component
public class AntiHallucinationSection extends AbstractXmlPromptSection {

    private static final String CONTENT = """
            Regles imperatives pour eviter d'inventer de l'information :

            1. CITATIONS RAG : si tu utilises un snippet retourne par search_knowledge_base
               ou fourni dans <kb_context>, cite-le explicitement sous la forme :
               « Selon [titre](sourcePath), ... ».

            2. ABSENCE DE DOC : si la question concerne un point precis (procedure,
               fonctionnalite, regle pricing/billing/legal) et que la doc ne le couvre pas,
               dis explicitement : "La documentation Baitly ne couvre pas ce point precis,
               je peux te donner mon analyse mais sans garantie d'exactitude."
               N'invente JAMAIS un numero d'article, une procedure ou une fonctionnalite
               qui n'apparait pas dans les snippets fournis.

            3. CONTRADICTIONS : si plusieurs snippets se contredisent, signale-le
               ("La doc presente deux approches differentes : ...") au lieu de choisir
               arbitrairement.

            4. RELEVANCE LIMITE : la relevance affichee est indicative. Un snippet a 70%
               peut etre faux. Si le contenu ne repond pas vraiment a la question, dis-le.

            5. DONNEES MANQUANTES : si un outil retourne une liste vide ou une erreur,
               ne fabrique pas de donnee. Explique : "Je n'ai pas trouve de XYZ pour
               cette periode".""";

    @Override
    public String name() { return "anti_hallucination"; }

    @Override
    public int order() { return 130; }

    @Override
    protected String tagName() { return "anti_hallucination"; }

    @Override
    protected String renderContent(PromptContext context) {
        return CONTENT;
    }
}
