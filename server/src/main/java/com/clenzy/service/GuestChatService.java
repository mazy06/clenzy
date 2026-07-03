package com.clenzy.service;

import com.clenzy.config.GuideConfig;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.WelcomeGuideService.GuestChatContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * Chatbot guest du livret d'accueil : répond aux questions du voyageur en se
 * basant UNIQUEMENT sur le contenu du livret (grounded, sans tools ni KB interne).
 *
 * <p>Public mais protégé : accès via token de livret valide, rate-limité par token
 * (Redis), réponse courte (coût borné). L'IA est résolue sur l'org du livret
 * ({@link AiProviderRouter}) — désactivé proprement si l'org n'a pas d'IA configurée.</p>
 */
@Service
public class GuestChatService {

    private static final Logger log = LoggerFactory.getLogger(GuestChatService.class);
    private static final String RL_PREFIX = "guest_chat:";

    public enum Status { OK, INVALID, RATE_LIMITED, UNAVAILABLE }

    public record GuestChatResult(Status status, String reply) {}

    private final WelcomeGuideService welcomeGuideService;
    private final AiProviderRouter aiProviderRouter;
    private final StringRedisTemplate redisTemplate;
    private final GuideConfig guideConfig;
    private final AiTokenBudgetService tokenBudgetService;
    private final io.micrometer.core.instrument.MeterRegistry meterRegistry;

    public GuestChatService(WelcomeGuideService welcomeGuideService,
                            AiProviderRouter aiProviderRouter,
                            StringRedisTemplate redisTemplate,
                            GuideConfig guideConfig,
                            AiTokenBudgetService tokenBudgetService,
                            io.micrometer.core.instrument.MeterRegistry meterRegistry) {
        this.welcomeGuideService = welcomeGuideService;
        this.aiProviderRouter = aiProviderRouter;
        this.redisTemplate = redisTemplate;
        this.guideConfig = guideConfig;
        this.tokenBudgetService = tokenBudgetService;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Benchmark per-outcome (campagne L4) : compte chaque issue de reponse
     * automatique guest — numerateur du taux « resolu sans humain » (gate du
     * pilote pricing per-outcome, arbitrage a venir : le signal « reprise
     * humaine » n'existe pas encore cote produit).
     */
    private void recordOutcome(Long orgId, Status status) {
        try {
            meterRegistry.counter("assistant.outcome.guest_auto_reply",
                    "org", String.valueOf(orgId),
                    "status", status.name().toLowerCase(java.util.Locale.ROOT)).increment();
        } catch (Exception e) {
            log.debug("recordOutcome ignore : {}", e.getMessage());
        }
    }

    public GuestChatResult answer(UUID token, String message) {
        Optional<GuestChatContext> ctxOpt = welcomeGuideService.getChatContext(token);
        if (ctxOpt.isEmpty()) {
            return new GuestChatResult(Status.INVALID, null);
        }
        GuestChatContext ctx = ctxOpt.get();

        if (!withinRateLimit(token)) {
            recordOutcome(ctx.orgId(), Status.RATE_LIMITED);
            return new GuestChatResult(Status.RATE_LIMITED, fallback(ctx.language(), true));
        }

        try {
            AiRequest request = new AiRequest(
                buildSystemPrompt(ctx), message.trim(), null, 0.3, guideConfig.getChatMaxTokens(), false);
            RoutedResponse routed = aiProviderRouter.route(
                ctx.orgId(), guideConfig.getChatProvider(), AiFeature.ASSISTANT_CHAT, request);
            String reply = routed.response() != null ? routed.response().content() : null;
            if (reply == null || reply.isBlank()) {
                recordOutcome(ctx.orgId(), Status.UNAVAILABLE);
                return new GuestChatResult(Status.UNAVAILABLE, fallback(ctx.language(), false));
            }
            // Débite l'usage IA sur le budget de l'org (best-effort, ne bloque pas la réponse).
            try {
                tokenBudgetService.recordUsage(
                    ctx.orgId(), AiFeature.ASSISTANT_CHAT, routed.providerName(), routed.response());
            } catch (Exception e) {
                log.debug("recordUsage chatbot échoué (token={}): {}", token, e.getMessage());
            }
            recordOutcome(ctx.orgId(), Status.OK);
            return new GuestChatResult(Status.OK, reply.trim());
        } catch (Exception e) {
            // IA non configurée pour l'org, budget épuisé, ou erreur réseau → repli gracieux.
            log.warn("Chatbot guest indisponible (token={}): {}", token, e.getMessage());
            recordOutcome(ctx.orgId(), Status.UNAVAILABLE);
            return new GuestChatResult(Status.UNAVAILABLE, fallback(ctx.language(), false));
        }
    }

    private boolean withinRateLimit(UUID token) {
        try {
            String key = RL_PREFIX + token;
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null && current == 1L) {
                redisTemplate.expire(key, Duration.ofSeconds(guideConfig.getChatWindowSeconds()));
            }
            return current == null || current <= guideConfig.getChatMaxPerWindow();
        } catch (Exception e) {
            // Redis indisponible → fail-open (le coût reste borné par maxTokens + validité du token).
            log.debug("Rate-limit chatbot indisponible: {}", e.getMessage());
            return true;
        }
    }

    private String buildSystemPrompt(GuestChatContext ctx) {
        String lang = ctx.language() != null && !ctx.language().isBlank() ? ctx.language() : "fr";
        return "Tu es l'assistant du livret d'accueil numérique de ce logement. "
            + "Réponds au voyageur de façon courtoise, concise et UNIQUEMENT à partir des informations du livret ci-dessous. "
            + "Si l'information n'y figure pas, dis-le poliment et invite à contacter l'hôte. "
            + "N'invente jamais de code d'accès, de mot de passe, d'adresse ni d'horaire. "
            + "Réponds dans la langue du voyageur (par défaut : " + lang + ").\n\n"
            + "INFORMATIONS DU LIVRET :\n" + ctx.content();
    }

    private String fallback(String language, boolean rateLimited) {
        boolean en = "en".equalsIgnoreCase(language);
        if (rateLimited) {
            return en
                ? "You've reached the message limit. Please try again in a few minutes."
                : "Vous avez atteint la limite de messages. Réessayez dans quelques minutes.";
        }
        return en
            ? "Sorry, the assistant is temporarily unavailable. Please contact your host."
            : "Désolé, l'assistant est momentanément indisponible. Contactez votre hôte.";
    }
}
