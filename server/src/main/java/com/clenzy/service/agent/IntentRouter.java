package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.service.ResolvedTarget;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * Routeur d'intention pre-orchestration (campagne multi-agent, ticket T-02 —
 * levier L1 : un tour multi-agent coute 5-10x un tour mono pour une question
 * mono-domaine).
 *
 * <p>Un appel LLM minuscule (petit prompt, {@code max_tokens} de quelques
 * tokens, temperature 0) classe le message utilisateur en :</p>
 * <ul>
 *   <li>{@link Route#DIRECT} — smalltalk/meta : mono-agent SANS outils
 *       (economise aussi les definitions d'outils) ;</li>
 *   <li>{@link Route#SIMPLE} — mono-domaine : mono-agent scope (court-circuit
 *       du multi-agent) ;</li>
 *   <li>{@link Route#MULTI} — cross-domaine/complexe : flux multi-agent
 *       (comportement historique).</li>
 * </ul>
 *
 * <p><b>Biais de securite</b> : au moindre doute, erreur provider, reponse
 * inattendue ou flag desactive → {@link Route#MULTI} (identique au comportement
 * actuel, zero regression possible). Le court-circuit ne s'applique que sur une
 * classification explicite.</p>
 *
 * <p>Observabilite : compteur {@code assistant.routing.decision{route}} — le
 * taux de court-circuit (simple+direct vs multi) se lit dans Grafana, croise
 * avec {@code assistant.tokens{agent}} (T-01) pour mesurer le gain reel.</p>
 */
@Component
public class IntentRouter {

    private static final Logger log = LoggerFactory.getLogger(IntentRouter.class);

    /** Compteur Micrometer des decisions de routage. Tag {@code route} : direct|simple|multi|error_fallback. */
    public static final String ROUTING_DECISIONS = "assistant.routing.decision";

    /** Le message user est tronque avant classification : au-dela, la nature de la demande est deja claire. */
    private static final int MAX_CLASSIFIED_CHARS = 400;

    /** Sortie attendue = 1 mot ; marge pour les tokenizations exotiques. */
    private static final int CLASSIFIER_MAX_TOKENS = 8;

    private static final String CLASSIFIER_PROMPT = """
            Tu es un routeur pour l'assistant d'un logiciel de gestion locative. \
            Classe le message utilisateur en UN SEUL mot :
            DIRECT = salutation, remerciement, question sur l'assistant lui-meme. Aucune donnee metier requise.
            SIMPLE = question ou action portant sur UN seul domaine metier (reservations OU finances OU menage \
            OU tarifs OU voyageurs OU proprietes...).
            MULTI = analyse croisant plusieurs domaines, comparaison, optimisation globale, plan d'action, \
            ou demande ambigue.
            En cas de doute, reponds MULTI. Reponds UNIQUEMENT par DIRECT, SIMPLE ou MULTI.""";

    /** Classification d'un message utilisateur. */
    public enum Route { DIRECT, SIMPLE, MULTI }

    /**
     * Decision de routage + usage tokens de l'appel de classification (a
     * enregistrer par l'appelant via {@code recordUsageSafe}, tag
     * {@code agent=router}).
     */
    public record RouteDecision(Route route, int promptTokens, int completionTokens, String model) {}

    private final ChatLLMProvider chatProvider;
    private final MeterRegistry meterRegistry;
    private final TierModelResolver tierModelResolver;
    private final boolean enabled;
    private final String modelOverride;

    public IntentRouter(ChatLLMProvider chatProvider,
                        MeterRegistry meterRegistry,
                        TierModelResolver tierModelResolver,
                        @Value("${clenzy.assistant.routing.enabled:false}") boolean enabled,
                        @Value("${clenzy.assistant.routing.model:}") String modelOverride) {
        this.chatProvider = chatProvider;
        this.meterRegistry = meterRegistry;
        this.tierModelResolver = tierModelResolver;
        this.enabled = enabled;
        this.modelOverride = modelOverride;
    }

    /** True si le routage est actif ({@code clenzy.assistant.routing.enabled}). */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Classe le message utilisateur. Ne lance JAMAIS d'exception : toute erreur
     * retombe sur {@link Route#MULTI} (comportement historique preserve).
     *
     * @param userMessage message utilisateur (tronque a {@value #MAX_CLASSIFIED_CHARS} chars)
     * @param target      cible LLM resolue (provider/baseUrl reutilises ; modele
     *                    remplacable par {@code clenzy.assistant.routing.model} —
     *                    le tiering par role T-03 branchera ici le tier petit)
     * @param apiKey      cle API (BYOK ou plateforme), jamais loggee
     */
    public RouteDecision classify(String userMessage, ResolvedTarget target, String apiKey) {
        if (userMessage == null || userMessage.isBlank()) {
            return fallback("blank_message");
        }
        String truncated = userMessage.length() > MAX_CLASSIFIED_CHARS
                ? userMessage.substring(0, MAX_CLASSIFIED_CHARS)
                : userMessage;
        // Priorite du modele de classification : override explicite
        // (clenzy.assistant.routing.model) > tier SMALL (T-03, si tiering actif)
        // > modele resolu du contexte.
        String model;
        if (modelOverride != null && !modelOverride.isBlank()) {
            model = modelOverride;
        } else if (tierModelResolver != null) {
            model = tierModelResolver.resolveModel(AgentTier.SMALL, target.provider(), target.model());
        } else {
            model = target.model();
        }
        try {
            ChatRequest request = new ChatRequest(
                    CLASSIFIER_PROMPT,
                    List.of(ChatMessage.user(truncated)),
                    List.of(),
                    model,
                    0.0,
                    CLASSIFIER_MAX_TOKENS,
                    null,
                    target.provider(),
                    target.baseUrl());

            final String[] text = {null};
            final int[] tokens = {0, 0};
            java.util.function.Consumer<ChatEvent> handler = event -> {
                if (event instanceof ChatEvent.Done done) {
                    text[0] = done.fullText();
                    tokens[0] = done.billedPromptTokens();
                    tokens[1] = done.completionTokens();
                }
            };
            if (apiKey != null) {
                chatProvider.streamChat(request, handler, apiKey);
            } else {
                chatProvider.streamChat(request, handler);
            }

            Route route = parseRoute(text[0]);
            if (route == null) {
                log.warn("[ROUTING] Reponse de classification inattendue '{}' → fallback MULTI", text[0]);
                return countAndBuild("error_fallback", Route.MULTI, tokens[0], tokens[1], model);
            }
            return countAndBuild(route.name().toLowerCase(Locale.ROOT), route, tokens[0], tokens[1], model);
        } catch (Exception e) {
            log.warn("[ROUTING] Classification en echec ({}) → fallback MULTI", e.getMessage());
            return fallback("error_fallback");
        }
    }

    private Route parseRoute(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.strip().toUpperCase(Locale.ROOT);
        for (Route route : Route.values()) {
            if (normalized.startsWith(route.name())) {
                return route;
            }
        }
        return null;
    }

    private RouteDecision fallback(String reason) {
        return countAndBuild(reason, Route.MULTI, 0, 0, null);
    }

    private RouteDecision countAndBuild(String tag, Route route,
                                        int promptTokens, int completionTokens, String model) {
        if (meterRegistry != null) {
            meterRegistry.counter(ROUTING_DECISIONS, "route", tag).increment();
        }
        return new RouteDecision(route, promptTokens, completionTokens, model);
    }
}
