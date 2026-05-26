package com.clenzy.service.agent.briefing;

import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentSseEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Compose un briefing pour un user en lancant l'orchestrateur avec un prompt
 * predefini selon la frequence configuree, puis retourne le texte assistant
 * concatene + l'id de conversation creee.
 *
 * <p>Le briefing est persiste comme une vraie conversation (titre
 * {@code "Briefing du JJ/MM/AAAA"}) — l'user peut y revenir depuis l'historique
 * pour relancer un dialogue contextuel.</p>
 */
@Service
public class BriefingComposer {

    private static final Logger log = LoggerFactory.getLogger(BriefingComposer.class);
    private static final DateTimeFormatter TITLE_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRANCE);

    private static final String PROMPT_DAILY_MORNING = """
            Genere un briefing matinal complet et concis. Structure en 3 sections :

            1. **Hier** : KPIs cles (revenus, occupancy, check-outs), anomalies detectees
               (reservations annulees, alertes bruit, plaintes), evenements marquants.
            2. **Aujourd'hui** : check-ins prevus, menages a faire, alertes du jour
               (interventions ouvertes, paiements en attente).
            3. **Recommandations** : 1 a 3 actions prioritaires concretes basees sur les
               donnees ci-dessus.

            Utilise les outils a ta disposition (get_dashboard_summary, list_reservations,
            list_cleaning_tasks, get_interventions_by_status, get_business_insights,
            analyze_portfolio) pour rassembler les donnees. Reponds en francais, ton
            professionnel mais chaleureux. Maximum 400 mots. Pas de formules de politesse.
            """;

    private static final String PROMPT_WEEKLY_SUNDAY = """
            Genere un weekly review pour la semaine ecoulee. Structure :

            1. **Performance** : revenus de la semaine, occupancy moyenne, ADR (croissance vs
               semaine precedente si possible).
            2. **Top events** : 3 a 5 evenements marquants (nouvelle reservation importante,
               alerte resolue, propriete top performer, etc.).
            3. **Priorites semaine prochaine** : checks-ins/checkouts a fort enjeu, actions
               de yield management, points d'attention.

            Utilise les outils (get_financial_summary, get_properties_performance,
            analyze_portfolio, get_occupancy_forecast). Reponds en francais. Maximum 500 mots.
            """;

    private static final String PROMPT_ONLY_ALERTS = """
            Verifie s'il y a des alertes critiques a remonter aujourd'hui : anomalies de
            revenus, plaintes, retards de paiement, conflits planning, problemes IoT. Si
            aucune alerte critique, repond simplement "Aucune alerte critique aujourd'hui."
            (sans tools inutiles). Sinon, liste max 5 alertes triees par criticite, chacune
            avec : titre, impact, action proposee. Reponds en francais.
            """;

    private final AgentOrchestrator orchestrator;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    /**
     * Modele LLM dedie aux briefings. Defaut : Haiku 4.5 (~10x moins cher que
     * Sonnet 4, qualite largement suffisante pour un resume textuel). Override
     * via {@code clenzy.assistant.briefing.model}.
     */
    private final String briefingModel;

    public BriefingComposer(AgentOrchestrator orchestrator,
                              AssistantConversationRepository conversationRepository,
                              AssistantMessageRepository messageRepository,
                              @Value("${clenzy.assistant.briefing.model:claude-haiku-4-5-20251001}") String briefingModel) {
        this.orchestrator = orchestrator;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.briefingModel = briefingModel;
    }

    /**
     * Compose un briefing pour un user. Retourne le resultat (text + conv id)
     * ou {@code null} si l'orchestrateur a echoue.
     */
    @Transactional
    public BriefingResult compose(AssistantBriefingPref pref) {
        if (pref == null || pref.getKeycloakId() == null) {
            throw new IllegalArgumentException("pref / keycloakId requis");
        }
        AssistantBriefingPref.Frequency freq = pref.getFrequencyEnum();
        String prompt = promptFor(freq);

        // Force le modele Haiku via modelOverride — gain de cout significatif
        // sur un volume de briefings reguliers.
        AgentContext context = new AgentContext(
                pref.getOrganizationId(),
                pref.getKeycloakId(),
                null, // pas de JWT en scheduled — les tools role-based feront du best-effort
                "fr",
                "assistant", // currentPage informatif
                null,
                briefingModel
        );

        // SSE consumer no-op : on lit le resultat en aval depuis la BDD (les
        // messages user/assistant sont persistes par l'orchestrateur a chaque tour).
        Long conversationId;
        try {
            conversationId = orchestrator.handleMessage(
                    null, prompt, context, event -> {
                        // Le scheduler ne consomme pas les events SSE — il lira l'historique
                        // persiste apres execution pour recuperer le texte final.
                        if (event != null && "error".equals(event.type())) {
                            log.warn("Briefing compose failed for user {} : {}",
                                    pref.getKeycloakId(), event.error());
                        }
                    });
        } catch (Exception e) {
            log.error("Briefing compose throw for user {}", pref.getKeycloakId(), e);
            return null;
        }

        if (conversationId == null) return null;

        // Set un titre lisible "Briefing du JJ/MM/AAAA"
        try {
            conversationRepository.findById(conversationId).ifPresent(conv -> {
                String label = freq == AssistantBriefingPref.Frequency.WEEKLY_SUNDAY
                        ? "Weekly review du " + LocalDate.now().format(TITLE_DATE)
                        : "Briefing du " + LocalDate.now().format(TITLE_DATE);
                conv.setTitle(label);
                conversationRepository.save(conv);
            });
        } catch (Exception e) {
            log.debug("Briefing : titre conversation non mis a jour ({}, conv {})",
                    e.getMessage(), conversationId);
        }

        String body = extractAssistantText(conversationId);
        return new BriefingResult(conversationId, body, freq);
    }

    /** Extrait le texte concatene des messages assistant pour usage email/whatsapp. */
    private String extractAssistantText(Long conversationId) {
        List<AssistantMessage> history = messageRepository.findByConversation(conversationId);
        StringBuilder sb = new StringBuilder();
        for (AssistantMessage m : history) {
            if (AssistantMessage.ROLE_ASSISTANT.equals(m.getRole())
                    && m.getContent() != null && !m.getContent().isBlank()) {
                if (sb.length() > 0) sb.append("\n\n");
                sb.append(m.getContent());
            }
        }
        return sb.toString();
    }

    /** Prompt pre-defini selon la frequence — package-private pour les tests. */
    static String promptFor(AssistantBriefingPref.Frequency frequency) {
        if (frequency == null) return PROMPT_DAILY_MORNING;
        return switch (frequency) {
            case DAILY_MORNING -> PROMPT_DAILY_MORNING;
            case WEEKLY_SUNDAY -> PROMPT_WEEKLY_SUNDAY;
            case ONLY_ALERTS -> PROMPT_ONLY_ALERTS;
        };
    }

    /** Resultat compose, expose au {@link BriefingDelivery} pour dispatch. */
    public record BriefingResult(
            Long conversationId,
            String body,
            AssistantBriefingPref.Frequency frequency
    ) {
        public String shortTitle() {
            return switch (frequency) {
                case DAILY_MORNING -> "Briefing matinal";
                case WEEKLY_SUNDAY -> "Weekly review";
                case ONLY_ALERTS -> "Alertes du jour";
            };
        }
    }
}
