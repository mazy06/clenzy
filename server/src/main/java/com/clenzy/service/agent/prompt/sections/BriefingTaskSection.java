package com.clenzy.service.agent.prompt.sections;

import com.clenzy.service.agent.prompt.AbstractXmlPromptSection;
import com.clenzy.service.agent.prompt.PromptContext;
import com.clenzy.service.agent.prompt.PromptPreset;
import org.springframework.stereotype.Component;

/**
 * Tache specifique a injecter pour les briefings (daily/weekly/alerts).
 *
 * <p>Decoupe les 3 cas via le {@link PromptContext#preset()} — une seule
 * classe gere les 3 variantes pour rester centralisee, mais chaque preset
 * a son template strict.</p>
 *
 * <p>Heritage du composer : les briefings beneficient automatiquement de
 * {@code RoleSection}, {@code CommunicationRulesSection},
 * {@code AntiHallucinationSection}, {@code MemorySection},
 * {@code RagContextSection} — pas besoin de les redupliquer ici. Gain :
 * coherence du ton + anti-hallucination applique aux briefings aussi.</p>
 */
@Component
public class BriefingTaskSection extends AbstractXmlPromptSection {

    private static final String DAILY_TASK = """
            Genere un briefing matinal complet et concis structure en 3 sections :

            1. **Hier** : KPIs cles (revenus, occupancy, check-outs), anomalies detectees
               (reservations annulees, alertes bruit, plaintes), evenements marquants.
            2. **Aujourd'hui** : check-ins prevus, menages a faire, alertes du jour
               (interventions ouvertes, paiements en attente).
            3. **Recommandations** : 1 a 3 actions prioritaires concretes basees sur les
               donnees ci-dessus.

            Utilise les outils a ta disposition (get_dashboard_summary, list_reservations,
            list_cleaning_tasks, get_interventions_by_status, get_business_insights,
            analyze_portfolio) pour rassembler les donnees. Maximum 400 mots. Pas de
            formules de politesse.""";

    private static final String WEEKLY_TASK = """
            Genere un weekly review pour la semaine ecoulee. Structure :

            1. **Performance** : revenus de la semaine, occupancy moyenne, ADR (croissance
               vs semaine precedente si possible).
            2. **Top events** : 3 a 5 evenements marquants (nouvelle reservation importante,
               alerte resolue, propriete top performer, etc.).
            3. **Priorites semaine prochaine** : check-ins/check-outs a fort enjeu, actions
               de yield management, points d'attention.

            Utilise les outils (get_financial_summary, get_properties_performance,
            analyze_portfolio, get_occupancy_forecast). Maximum 500 mots.""";

    private static final String ALERTS_TASK = """
            Verifie s'il y a des alertes critiques a remonter aujourd'hui : anomalies de
            revenus, plaintes, retards de paiement, conflits planning, problemes IoT.

            Si AUCUNE alerte critique, repond exactement : "Aucune alerte critique aujourd'hui."
            (sans appeler d'outils inutiles, sans paraphraser).

            Sinon, liste au maximum 5 alertes triees par criticite, chacune avec :
            - **Titre** court
            - **Impact** quantifie si possible
            - **Action proposee** concrete""";

    @Override
    public String name() { return "briefing_task"; }

    @Override
    public int order() { return 400; }

    @Override
    public boolean appliesTo(PromptContext context) {
        return context.isBriefing();
    }

    @Override
    protected String tagName() { return "briefing_task"; }

    @Override
    protected String renderContent(PromptContext context) {
        PromptPreset preset = context.preset();
        return switch (preset) {
            case BRIEFING_DAILY -> DAILY_TASK;
            case BRIEFING_WEEKLY -> WEEKLY_TASK;
            case BRIEFING_ALERTS -> ALERTS_TASK;
            default -> null;  // ne devrait jamais arriver vu appliesTo
        };
    }
}
