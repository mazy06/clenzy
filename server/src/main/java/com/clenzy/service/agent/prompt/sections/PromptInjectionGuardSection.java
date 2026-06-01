package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import com.clenzy.service.agent.prompt.PromptSecurityGuidance;
import org.springframework.stereotype.Component;

/**
 * Garde anti-injection de prompt (mono-agent v2).
 *
 * <p>Dit explicitement au modele de traiter les contenus reinjectes
 * (resultats d'outils, RAG, memoire, contexte UI) comme de la DONNEE et jamais
 * comme des instructions. Le texte canonique vit dans
 * {@link PromptSecurityGuidance} (partage avec le multi-agent et le fallback v1).</p>
 *
 * <p>Ordre 135 : juste apres {@code anti_hallucination} (130), pour regrouper
 * les deux gardes de sureté. Contenu statique → cacheable (prefixe stable).</p>
 */
@Component
public class PromptInjectionGuardSection extends AbstractXmlPromptSection {

    @Override
    public String name() { return PromptSecurityGuidance.TAG; }

    @Override
    public int order() { return 135; }

    @Override
    protected String tagName() { return PromptSecurityGuidance.TAG; }

    @Override
    protected String renderContent(PromptContext context) {
        return PromptSecurityGuidance.INNER;
    }
}
