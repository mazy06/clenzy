package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMRouter;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiTargetResolver;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.service.KeySource;
import com.clenzy.tenant.TenantContext;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifie le basculement multi-provider : sur 429 du primaire (emis comme
 * {@link ChatEvent.Error}, PAS une exception), on rejoue sur le provider suivant
 * de la chaine, sans laisser l'erreur fuiter si un repli reussit.
 */
class FailoverChatLLMProviderTest {

    private ChatLLMRouter router;
    private AiTargetResolver targetResolver;
    private TenantContext tenantContext;
    private SimpleMeterRegistry meterRegistry;
    private FailoverChatLLMProvider failover;

    private final List<ChatEvent> received = new ArrayList<>();
    private final Consumer<ChatEvent> downstream = received::add;

    @BeforeEach
    void setup() {
        router = mock(ChatLLMRouter.class);
        targetResolver = mock(AiTargetResolver.class);
        tenantContext = mock(TenantContext.class);
        meterRegistry = new SimpleMeterRegistry();
        failover = new FailoverChatLLMProvider(router, targetResolver, tenantContext, meterRegistry);
        when(tenantContext.getOrganizationId()).thenReturn(2L);
    }

    private double failoverCount(String to) {
        var counter = meterRegistry.find(FailoverChatLLMProvider.FAILOVER_METRIC)
                .tag("to", to).counter();
        return counter == null ? 0d : counter.count();
    }

    private ChatRequest nvidiaRequest() {
        return new ChatRequest("sys", List.of(ChatMessage.user("salut")), List.of(),
                "mistral-large-3", 0.2, 1024).withTarget("nvidia", "https://nvidia/v1");
    }

    /** Mock router : comportement determine par le provider de la requete. */
    private void routerEmits(java.util.function.Function<String, List<ChatEvent>> byProvider) {
        doAnswer(inv -> {
            ChatRequest req = inv.getArgument(0);
            Consumer<ChatEvent> c = inv.getArgument(1);
            byProvider.apply(req.provider()).forEach(c::accept);
            return null;
        }).when(router).streamChat(any(), any(), any());
    }

    @Test
    void primaryRateLimited_failsOverToAnthropic_andHidesError() {
        when(targetResolver.resolveChain(eq(2L), eq(AiFeature.ASSISTANT_CHAT), isNull())).thenReturn(List.of(
                new ResolvedTarget("nvidia", "mistral-large-3", "nv-key", "https://nvidia/v1", KeySource.PLATFORM_DB),
                new ResolvedTarget("anthropic", null, "anthropic-key", null, KeySource.PLATFORM_DB)));
        routerEmits(provider -> "anthropic".equals(provider)
                ? List.of(new ChatEvent.TextDelta("Bonjour"))
                : List.of(new ChatEvent.Error("nvidia API returned status 429", null)));

        failover.streamChat(nvidiaRequest(), downstream, "nv-key");

        // Le repli a produit du contenu ; l'erreur 429 du primaire est masquee.
        assertThat(received).hasSize(1);
        assertThat(received.get(0)).isInstanceOf(ChatEvent.TextDelta.class);
        assertThat(received).noneMatch(e -> e instanceof ChatEvent.Error);
        verify(router, times(2)).streamChat(any(), any(), any());
        // Observabilite : une bascule vers anthropic comptee.
        assertThat(failoverCount("anthropic")).isEqualTo(1d);
    }

    @Test
    void allProvidersFail_lastErrorSurfaces() {
        when(targetResolver.resolveChain(eq(2L), eq(AiFeature.ASSISTANT_CHAT), isNull())).thenReturn(List.of(
                new ResolvedTarget("nvidia", "mistral-large-3", "nv-key", "https://nvidia/v1", KeySource.PLATFORM_DB),
                new ResolvedTarget("anthropic", null, "anthropic-key", null, KeySource.PLATFORM_DB)));
        routerEmits(provider -> List.of(new ChatEvent.Error(
                provider + " API returned status 429", null)));

        failover.streamChat(nvidiaRequest(), downstream, "nv-key");

        // Une seule erreur transmise (la derniere = anthropic), apres avoir tout tente.
        assertThat(received).hasSize(1);
        assertThat(received.get(0)).isInstanceOf(ChatEvent.Error.class);
        verify(router, times(2)).streamChat(any(), any(), any());
    }

    @Test
    void primarySucceeds_noFailover_noChainLookup() {
        routerEmits(provider -> List.of(new ChatEvent.TextDelta("Reponse directe")));

        failover.streamChat(nvidiaRequest(), downstream, "nv-key");

        assertThat(received).hasSize(1);
        assertThat(received.get(0)).isInstanceOf(ChatEvent.TextDelta.class);
        verify(router, times(1)).streamChat(any(), any(), any());
        // Pas de resolution de chaine si le primaire reussit.
        verify(targetResolver, times(0)).resolveChain(any(), any(), any());
        // Aucune bascule comptee.
        assertThat(failoverCount("anthropic")).isZero();
    }

    @Test
    void contentThenError_doesNotFailover_forwardsBoth() {
        routerEmits(provider -> List.of(
                new ChatEvent.TextDelta("debut"),
                new ChatEvent.Error("coupure reseau en cours de stream", null)));

        failover.streamChat(nvidiaRequest(), downstream, "nv-key");

        // Du contenu deja parti → l'erreur est transmise telle quelle, aucun repli.
        assertThat(received).hasSize(2);
        assertThat(received.get(0)).isInstanceOf(ChatEvent.TextDelta.class);
        assertThat(received.get(1)).isInstanceOf(ChatEvent.Error.class);
        verify(router, times(1)).streamChat(any(), any(), any());
    }

    @Test
    void noTenantContext_noFailover_primaryErrorSurfaces() {
        when(tenantContext.getOrganizationId()).thenReturn(null);
        routerEmits(provider -> List.of(new ChatEvent.Error("nvidia API returned status 429", null)));

        failover.streamChat(nvidiaRequest(), downstream, "nv-key");

        assertThat(received).hasSize(1);
        assertThat(received.get(0)).isInstanceOf(ChatEvent.Error.class);
        verify(router, times(1)).streamChat(any(), any(), any());
    }
}
