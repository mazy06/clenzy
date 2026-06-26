package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatLLMRouter;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.tenant.TenantContext;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

/**
 * {@link ChatLLMProvider} {@code @Primary} qui ajoute le <b>basculement multi-provider</b>
 * (failover) au-dessus du {@link ChatLLMRouter}.
 *
 * <p><b>Pourquoi</b> : le provider primaire (ex. NVIDIA free-tier, Mistral Large 3) peut
 * etre momentanement indisponible (HTTP 429 rate-limit, 5xx). Plutot que de renvoyer une
 * erreur, on rejoue l'appel sur le provider suivant de la chaine resolue
 * ({@link AssistantTargetResolver#resolveFailoverChain}) : NVIDIA → Anthropic → OpenAI.</p>
 *
 * <p><b>Comment</b> : les providers ne LEVENT pas d'exception sur 429 — ils emettent un
 * {@link ChatEvent.Error} dans le consumer puis terminent. Le wrapper intercepte donc cet
 * event via un {@link Guard} : tant qu'AUCUN contenu ({@link ChatEvent.TextDelta} /
 * {@link ChatEvent.ToolCallRequest}) n'a ete streame, une {@code Error} est <i>avalee</i> et
 * declenche un repli sur le provider suivant. Des qu'un repli commence a produire du contenu,
 * on ne bascule plus (pas de double emission). Si toute la chaine echoue, la derniere erreur
 * est transmise au consumer reel → message gracieux cote pont AG-UI.</p>
 *
 * <p>Transparent pour tous les appelants (orchestrateur, specialists, mono-agent) : ils
 * injectent {@link ChatLLMProvider} et recoivent ce wrapper sans changement.</p>
 */
@Primary
@Component
public class FailoverChatLLMProvider implements ChatLLMProvider {

    private static final Logger log = LoggerFactory.getLogger(FailoverChatLLMProvider.class);

    /** Compteur d'evenements de bascule failover (tag {@code to} = provider cible). */
    public static final String FAILOVER_METRIC = "assistant.llm.failover";

    private final ChatLLMRouter router;
    private final AssistantTargetResolver targetResolver;
    private final TenantContext tenantContext;
    private final MeterRegistry meterRegistry;

    public FailoverChatLLMProvider(ChatLLMRouter router,
                                   AssistantTargetResolver targetResolver,
                                   TenantContext tenantContext,
                                   MeterRegistry meterRegistry) {
        this.router = router;
        this.targetResolver = targetResolver;
        this.tenantContext = tenantContext;
        this.meterRegistry = meterRegistry;
    }

    @Override
    public String name() {
        return "failover";
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
        streamChat(request, consumer, null);
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer, String apiKey) {
        Guard guard = new Guard(consumer);
        router.streamChat(request, guard, apiKey);
        if (!guard.shouldFailover()) {
            return;  // succes, ou du contenu a deja ete emis (trop tard pour basculer)
        }

        List<AssistantTargetResolver.ChatTarget> chain = failoverChainSafe();
        Set<String> tried = new HashSet<>();
        tried.add(canonical(request.provider()));
        ChatEvent.Error lastError = guard.caughtError();

        for (AssistantTargetResolver.ChatTarget alt : chain) {
            String altProvider = canonical(alt.provider());
            if (!tried.add(altProvider)) {
                continue;  // provider deja tente (primaire ou repli precedent)
            }
            ChatRequest altReq = request.withTarget(alt.provider(), alt.baseUrl())
                    .overrideModel(alt.model());
            Guard altGuard = new Guard(consumer);
            log.warn("Failover LLM : provider indisponible → bascule sur '{}'", altProvider);
            // Observabilite : compte chaque bascule par provider cible (cardinalite
            // bornee a l'ensemble des providers — pas de tag par user/org).
            meterRegistry.counter(FAILOVER_METRIC, "to", altProvider).increment();
            router.streamChat(altReq, altGuard, alt.apiKey());
            if (!altGuard.shouldFailover()) {
                return;  // un repli a reussi (ou a commence a emettre du contenu)
            }
            if (altGuard.caughtError() != null) {
                lastError = altGuard.caughtError();
            }
        }

        // Toute la chaine a echoue : on transmet la derniere erreur au consumer reel.
        consumer.accept(lastError != null ? lastError
                : new ChatEvent.Error("Aucun fournisseur IA disponible.", null));
    }

    /** Resout la chaine de repli pour l'org courante ; vide si hors contexte tenant. */
    private List<AssistantTargetResolver.ChatTarget> failoverChainSafe() {
        try {
            Long orgId = tenantContext.getOrganizationId();
            if (orgId == null) {
                return List.of();
            }
            return targetResolver.resolveFailoverChain(orgId, null);
        } catch (Exception e) {
            log.debug("Failover chain resolution echouee : {}", e.getMessage());
            return List.of();
        }
    }

    private static String canonical(String provider) {
        if (provider == null || provider.isBlank()) {
            return "anthropic";
        }
        return provider.toLowerCase();
    }

    /**
     * Intercepte le flux d'un appel : retient si du contenu a ete emis et avale une
     * {@link ChatEvent.Error} survenue AVANT tout contenu (candidate au failover).
     */
    private static final class Guard implements Consumer<ChatEvent> {
        private final Consumer<ChatEvent> downstream;
        private boolean content;
        private ChatEvent.Error caughtError;

        Guard(Consumer<ChatEvent> downstream) {
            this.downstream = downstream;
        }

        @Override
        public void accept(ChatEvent event) {
            if (event instanceof ChatEvent.Error err) {
                if (content) {
                    downstream.accept(err);  // du contenu deja parti → on ne peut plus basculer
                } else {
                    caughtError = err;       // avalee : on tentera un repli
                }
                return;
            }
            if (event instanceof ChatEvent.TextDelta || event instanceof ChatEvent.ToolCallRequest) {
                content = true;
            }
            downstream.accept(event);
        }

        /** True si un repli est pertinent : une erreur a ete avalee et rien n'a ete emis. */
        boolean shouldFailover() {
            return caughtError != null && !content;
        }

        ChatEvent.Error caughtError() {
            return caughtError;
        }
    }
}
