package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import com.clenzy.repository.PlatformAiModelRepository;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.FailoverChatLLMProvider;
import com.clenzy.service.agent.IntentRouter;
import com.clenzy.testkit.ScriptedChatLLMProvider;
import com.clenzy.testkit.ScriptedChatLLMProvider.ScriptedResponse;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;

/**
 * Scenario S4 (assistant) : routage court-circuit ({@code IntentRouter} actif)
 * + tiering du classifieur (modele ASSISTANT_SMALL assigne en base via
 * {@code platform_ai_feature_model}).
 *
 * <p>LLM 100 % scripte ({@link ScriptedChatLLMProvider}) : la requete du
 * classifieur est capturee et on verifie le modele tier + la metrique
 * {@code assistant.routing.decision}.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
@TestPropertySource(properties = {
        "clenzy.assistant.routing.enabled=true",
})
class ScenarioAssistantRoutingIT extends AbstractIntegrationTest {

    private static final String TIER_SMALL_MODEL = "claude-tiny-tier-it";

    @Autowired private AgentOrchestrator agentOrchestrator;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private PlatformAiModelRepository platformAiModelRepository;
    @Autowired private PlatformAiFeatureModelRepository platformAiFeatureModelRepository;
    @Autowired private AssistantMessageRepository assistantMessageRepository;
    @Autowired private MeterRegistry meterRegistry;

    @MockBean private FailoverChatLLMProvider chatProvider;

    private final ScriptedChatLLMProvider scripted = new ScriptedChatLLMProvider();

    private Long orgId;

    @BeforeEach
    void bridgeScriptedProviderAndSeed() {
        scripted.reset();
        lenient().when(chatProvider.name()).thenReturn(scripted.name());
        lenient().doAnswer(inv -> {
            scripted.streamChat(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());
        lenient().doAnswer(inv -> {
            scripted.streamChat(inv.getArgument(0), inv.getArgument(1), inv.getArgument(2));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(), anyString());

        String salt = UUID.randomUUID().toString().substring(0, 8);
        orgId = organizationRepository.save(
                new Organization("Routing Org " + salt, OrganizationType.INDIVIDUAL, "routing-" + salt))
                .getId();
        setupTenantContext(orgId, false);

        // Tiering T-03 : un modele ASSISTANT_SMALL assigne en base (provider
        // anthropic = provider du contexte resolu par defaut) et AVAILABLE.
        if (platformAiFeatureModelRepository.findByFeature(AiFeature.ASSISTANT_SMALL.name()).isEmpty()) {
            PlatformAiModel tierModel = new PlatformAiModel(
                    "Tier small IT", "anthropic", TIER_SMALL_MODEL, "sk-test-tier", null);
            tierModel.setAvailabilityStatus(AiModelAvailability.AVAILABLE);
            tierModel = platformAiModelRepository.save(tierModel);
            platformAiFeatureModelRepository.save(
                    new PlatformAiFeatureModel(AiFeature.ASSISTANT_SMALL.name(), tierModel));
        }
    }

    @Test
    void simpleMessage_isShortCircuitedToMonoAgent_andClassifierUsesTierSmallModel() {
        double simpleBefore = routingCount("simple");

        // Classifieur (system prompt "routeur", max_tokens=8) → SIMPLE.
        scripted.onSystemPromptContains("Tu es un routeur",
                ScriptedResponse.text("SIMPLE").withTokens(25, 1));
        // Tour mono-agent : reponse texte directe.
        scripted.enqueue(ScriptedResponse.text("Tu as 0 reservation cette semaine.").withTokens(80, 12));

        Long conversationId = agentOrchestrator.handleMessage(
                null, "combien de reservations cette semaine ?",
                AgentContext.minimal(orgId, "kc-routing-user"), e -> { });

        // 2 appels LLM seulement : classifieur + UN tour mono-agent (pas
        // d'orchestration multi-agent → route courte).
        List<ChatRequest> calls = scripted.capturedRequests();
        assertThat(calls).hasSize(2);

        ChatRequest classifier = calls.get(0);
        assertThat(classifier.systemPrompt()).contains("Tu es un routeur");
        assertThat(classifier.maxTokens()).isEqualTo(8);
        // Tiering : la requete du classifieur utilise le modele du tier SMALL.
        assertThat(classifier.model()).isEqualTo(TIER_SMALL_MODEL);

        ChatRequest monoTurn = calls.get(1);
        assertThat(monoTurn.systemPrompt())
                .as("route SIMPLE → mono-agent, pas le prompt orchestrateur multi-agent")
                .doesNotContain("<specialists>");

        // Metrique de routage emise.
        assertThat(routingCount("simple")).isEqualTo(simpleBefore + 1);

        // Reponse persistee (golden path complet malgre le court-circuit).
        var messages = assistantMessageRepository.findByConversation(conversationId);
        assertThat(messages)
                .anyMatch(m -> "assistant".equals(m.getRole())
                        && m.getContent() != null && m.getContent().contains("0 reservation"));
    }

    @Test
    void directMessage_getsMonoAgentWithoutTools() {
        scripted.onSystemPromptContains("Tu es un routeur",
                ScriptedResponse.text("DIRECT").withTokens(20, 1));
        scripted.enqueue(ScriptedResponse.text("Bonjour ! Comment puis-je aider ?").withTokens(30, 8));

        agentOrchestrator.handleMessage(null, "bonjour",
                AgentContext.minimal(orgId, "kc-routing-user"), e -> { });

        List<ChatRequest> calls = scripted.capturedRequests();
        assertThat(calls).hasSize(2);
        // Route DIRECT : aucun outil expose au tour mono (economie de contexte).
        assertThat(calls.get(1).tools()).isEmpty();
    }

    private double routingCount(String route) {
        Counter counter = meterRegistry.find(IntentRouter.ROUTING_DECISIONS)
                .tag("route", route).counter();
        return counter == null ? 0.0 : counter.count();
    }
}
