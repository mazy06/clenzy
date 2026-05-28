package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import org.springframework.stereotype.Component;

/**
 * Indications de QUAND utiliser les tools (le QUOI est deja dans les
 * {@code ToolDescriptor} envoyes en parallele a l'API).
 *
 * <p>OPTIMISATION : l'ancien {@code DEFAULT_SYSTEM_PROMPT} dupliquait dans une
 * section "Catalogue d'outils" toutes les descriptions deja presentes dans le
 * tableau {@code tools[]} envoye a l'API Anthropic. Cette section ne garde que
 * les <b>triggers metier</b> (mots-cles, intentions) qui aident le LLM a
 * router vers le bon tool. Gain : ~500 tokens / message.</p>
 */
@Component
public class ToolsUsageHintsSection extends AbstractXmlPromptSection {

    private static final String CONTENT = """
            Indications pour choisir le bon outil selon l'intention de l'utilisateur :

            QUESTIONS DE TYPE "QUE SE PASSE-T-IL SI..."
            -> simulate_pricing_change ("si je baisse de 10%", "scenario tarif")
            -> simulate_calendar_block ("combien je perds si je bloque ces dates")

            DEMANDES DE PROCEDURE GUIDEE ("aide-moi a...", "comment je fais pour...")
            -> start_workflow puis advance_workflow
               workflows : onboard_property, end_of_month_closing, prepare_high_season

            ANALYSE D'UNE PROPRIETE SPECIFIQUE
            -> get_business_insights (anomalies + recommandations)
            -> get_reservation_trend (line chart historique)
            -> get_occupancy_forecast (previsions)

            VUE GLOBALE DU PORTFOLIO
            -> analyze_portfolio (KPIs cross-property + top/sous-performers + patterns)

            DOCUMENTATION CLENZY ("selon la doc", "comment fonctionne X dans Clenzy")
            -> search_knowledge_base (RAG sur la doc projet)

            CONTEXTE EXTERIEUR (pour nourrir les recos)
            -> get_weather_forecast (meteo a J+7)
            -> get_local_events (jours feries, festivals, evenements sportifs)

            ACTIONS D'ECRITURE (toujours avec confirmation user)
            -> create_intervention, assign_intervention, block_calendar_day,
               cancel_reservation, send_guest_message, update_property_status

            MEMOIRE LONG-TERME (silencieuse, sans demander permission)
            -> remember_fact (preference / fact / goal / project en snake_case)

            NAVIGATION (apres un insight ou pour repondre "ou trouver X")
            -> suggest_navigation (path, label, reason)

            CHAINING : tu peux appeler PLUSIEURS outils en chaine si necessaire
            (ex: get_business_insights pour l'analyse + suggest_navigation pour le CTA).""";

    @Override
    public String name() { return "tools_usage_hints"; }

    @Override
    public int order() { return 300; }

    @Override
    public boolean appliesTo(PromptContext context) {
        // Briefings n'utilisent pas les write tools / navigation — pas besoin de cette section
        return context.isChat();
    }

    @Override
    protected String tagName() { return "tools_usage_hints"; }

    @Override
    protected String renderContent(PromptContext context) {
        return CONTENT;
    }
}
