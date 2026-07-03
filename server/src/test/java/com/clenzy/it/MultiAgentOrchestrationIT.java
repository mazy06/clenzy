package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.integration.channel.SupervisionCalendarTriggerListener;
import com.clenzy.model.AgentRun;
import com.clenzy.model.AgentStep;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AgentStepRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentSseEvent;
import com.clenzy.service.agent.FailoverChatLLMProvider;
import com.clenzy.service.agent.supervision.SupervisionTriggerService;
import com.clenzy.testkit.ScriptedChatLLMProvider;
import com.clenzy.testkit.ScriptedChatLLMProvider.ScriptedResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;

/**
 * IT bout-en-bout de la Constellation multi-agent (Vague T2) : orchestration
 * scriptee ({@link ScriptedChatLLMProvider}, zero token reel) → delegation a
 * data_analyst → TOOL REEL (list_properties sur la base Testcontainers, tenant
 * reel) → synthese → persistance agent_run/agent_step + tokens agreges.
 *
 * <p>Anti-fuite : 2 organisations seedees, la reponse du tool ne doit contenir
 * QUE les biens de l'org appelante.</p>
 *
 * <p>Gate {@code CLENZY_IT=true} : meme convention que le socle T1 (les ITs
 * tournent quand Docker est la, jamais dans le build unitaire).</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
@TestPropertySource(properties = {
        "clenzy.assistant.blackboard.enabled=true",
        "clenzy.assistant.routing.enabled=false",
})
class MultiAgentOrchestrationIT extends AbstractIntegrationTest {

    @Autowired private AgentOrchestrator agentOrchestrator;
    @Autowired private AgentRunRepository agentRunRepository;
    @Autowired private AgentStepRepository agentStepRepository;
    @Autowired private AssistantMessageRepository assistantMessageRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private SupervisionCalendarTriggerListener supervisionListener;
    @Autowired private SupervisionTriggerService supervisionTriggerService;

    /**
     * Remplace le bean @Primary {@link FailoverChatLLMProvider} : TOUT le trafic
     * LLM (orchestrateur, specialists, router) est redirige vers le provider
     * scripte via le bridge du @BeforeEach.
     */
    @MockBean private FailoverChatLLMProvider chatProvider;

    private final ScriptedChatLLMProvider scripted = new ScriptedChatLLMProvider();

    private Long orgAId;
    private Long orgBId;
    private Long orgAPropertyId;

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
        Organization orgA = organizationRepository.save(
                new Organization("Constellation A " + salt, OrganizationType.INDIVIDUAL, "constellation-a-" + salt));
        Organization orgB = organizationRepository.save(
                new Organization("Constellation B " + salt, OrganizationType.INDIVIDUAL, "constellation-b-" + salt));
        orgAId = orgA.getId();
        orgBId = orgB.getId();

        User ownerA = new User("Alice", "Hote", "alice." + salt + "@test.com", "password123");
        ownerA.setOrganizationId(orgAId);
        ownerA.setKeycloakId("kc-ma-a-" + salt);
        userRepository.save(ownerA);

        User ownerB = new User("Bob", "Hote", "bob." + salt + "@test.com", "password123");
        ownerB.setOrganizationId(orgBId);
        ownerB.setKeycloakId("kc-ma-b-" + salt);
        userRepository.save(ownerB);

        Property propA = new Property("Villa Alpha " + salt, "1 rue Alpha", 3, 2, ownerA);
        propA.setOrganizationId(orgAId);
        propA.setNightlyPrice(new BigDecimal("150.00"));
        orgAPropertyId = propertyRepository.save(propA).getId();

        Property propB = new Property("Villa Omega " + salt, "1 rue Omega", 2, 1, ownerB);
        propB.setOrganizationId(orgBId);
        propB.setNightlyPrice(new BigDecimal("90.00"));
        propertyRepository.save(propB);

        // Tenant reel de l'org A (simulation TenantFilter) : le tool list_properties
        // passe par le filtre Hibernate.
        setupTenantContext(orgAId, false);
    }

    // ─── Scenario complet : « analyse mes performances » ────────────────────

    @Test
    void fullOrchestration_delegatesToDataAnalyst_executesRealTool_persistsRunAndTokens() {
        // Tour 1 orchestrateur : delegation au data_analyst.
        scripted.enqueue(ScriptedResponse.toolCalls(new ChatMessage.ToolCall(
                        "tc-delegate-1", "delegate_to",
                        "{\"specialist\":\"data_analyst\",\"query\":\"analyse les performances du parc\"}"))
                .withTokens(40, 5));
        // Tour 1 specialist : demande le TOOL REEL list_properties.
        scripted.enqueue(ScriptedResponse.toolCalls(new ChatMessage.ToolCall(
                        "tc-tool-1", "list_properties", "{}"))
                .withTokens(30, 4));
        // Tour 2 specialist : synthese apres le tool result.
        scripted.enqueue(ScriptedResponse.text("Le parc contient une villa active nommee Villa Alpha.")
                .withTokens(50, 12));
        // Tour 2 orchestrateur : reponse finale.
        scripted.enqueue(ScriptedResponse.text("Analyse : ton parc (Villa Alpha) est bien positionne.")
                .withTokens(60, 15));

        AgentContext context = AgentContext.minimal(orgAId, "kc-ma-a-user");
        List<AgentSseEvent> events = new ArrayList<>();
        Long conversationId = agentOrchestrator.handleMessage(
                null, "analyse mes performances", context, events::add);

        assertThat(conversationId).isNotNull();

        // Reponse finale streamee + persistee, tokens agreges (4 appels LLM scriptes).
        assertThat(events).anyMatch(e -> "done".equals(e.type()));
        var messages = assistantMessageRepository.findByConversation(conversationId);
        var assistantMsg = messages.stream()
                .filter(m -> "assistant".equals(m.getRole()))
                .reduce((first, second) -> second)
                .orElseThrow();
        assertThat(assistantMsg.getContent()).contains("Villa Alpha");
        assertThat(assistantMsg.getPromptTokens()).isEqualTo(40 + 30 + 50 + 60);
        assertThat(assistantMsg.getCompletionTokens()).isEqualTo(5 + 4 + 12 + 15);

        // Le TOOL REEL a tourne sur la base Testcontainers : son resultat (reinjecte
        // au specialist au tour 2) contient le bien de l'org A et JAMAIS celui de l'org B.
        List<ChatRequest> llmCalls = scripted.capturedRequests();
        assertThat(llmCalls).hasSize(4);
        ChatRequest specialistSecondTurn = llmCalls.get(2);
        String toolResultContent = specialistSecondTurn.messages().stream()
                .filter(m -> ChatMessage.ROLE_TOOL.equals(m.role()))
                .map(ChatMessage::content)
                .reduce("", String::concat);
        assertThat(toolResultContent).contains("Villa Alpha");
        assertThat(toolResultContent).doesNotContain("Villa Omega");

        // Run + steps persistes (ecriture async best-effort → await borné).
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            List<AgentRun> runs = agentRunRepository.findAll().stream()
                    .filter(r -> conversationId.equals(r.getConversationId()))
                    .toList();
            assertThat(runs).hasSize(1);
            AgentRun run = runs.get(0);
            assertThat(run.getOrganizationId()).isEqualTo(orgAId);
            assertThat(run.getStatus()).isEqualTo(AgentRun.STATUS_COMPLETED);
            assertThat(run.getUserQuery()).isEqualTo("analyse mes performances");

            List<AgentStep> steps = agentStepRepository.findByRunIdOrderByStepSeqAsc(run.getId());
            assertThat(steps)
                    .extracting(AgentStep::getKind)
                    .contains(AgentStep.KIND_DELEGATION, AgentStep.KIND_SUMMARY);
            AgentStep delegation = steps.stream()
                    .filter(s -> AgentStep.KIND_DELEGATION.equals(s.getKind()))
                    .findFirst().orElseThrow();
            assertThat(delegation.getAgent()).isEqualTo("specialist:data_analyst");
            assertThat(delegation.getStatus()).isEqualTo(AgentStep.STATUS_SUCCESS);
            // Tokens du specialist portes par le step DELEGATION.
            assertThat(delegation.getPromptTokens()).isEqualTo(30 + 50);
            assertThat(delegation.getCompletionTokens()).isEqualTo(4 + 12);
        });
    }

    // ─── Blackboard (2 delegations) : digest des constats anterieurs ────────

    @Test
    void twoDelegations_withBlackboardEnabled_secondSpecialistPromptCarriesPriorFindings() {
        // Delegation 1 → synthese ; delegation 2 → synthese ; texte final.
        scripted.enqueue(ScriptedResponse.toolCalls(new ChatMessage.ToolCall(
                        "tc-d1", "delegate_to",
                        "{\"specialist\":\"data_analyst\",\"query\":\"kpis juillet\"}"))
                .withTokens(40, 5));
        scripted.enqueue(ScriptedResponse.text("Revenu juillet : 12 000 EUR").withTokens(20, 8));
        scripted.enqueue(ScriptedResponse.toolCalls(new ChatMessage.ToolCall(
                        "tc-d2", "delegate_to",
                        "{\"specialist\":\"data_analyst\",\"query\":\"compare avec aout\"}"))
                .withTokens(40, 5));
        scripted.enqueue(ScriptedResponse.text("Aout est en hausse de 10 %.").withTokens(25, 9));
        scripted.enqueue(ScriptedResponse.text("Juillet 12 000 EUR, aout +10 %.").withTokens(60, 12));

        AgentContext context = AgentContext.minimal(orgAId, "kc-ma-a-user");
        Long conversationId = agentOrchestrator.handleMessage(
                null, "compare juillet et aout", context, e -> { });
        assertThat(conversationId).isNotNull();

        List<ChatRequest> llmCalls = scripted.capturedRequests();
        assertThat(llmCalls).hasSize(5);

        // 1re delegation : pas de constat anterieur → pas de section prior_findings.
        String firstSpecialistPrompt = llmCalls.get(1).systemPrompt();
        assertThat(firstSpecialistPrompt).contains("specialiste data_analyst");
        assertThat(firstSpecialistPrompt).doesNotContain("<prior_findings>");

        // 2e delegation : le digest blackboard (constat de la 1re) est injecte.
        String secondSpecialistPrompt = llmCalls.get(3).systemPrompt();
        assertThat(secondSpecialistPrompt)
                .contains("<prior_findings>")
                .contains("[data_analyst]")
                .contains("Revenu juillet : 12 000 EUR");
    }

    // ─── Interaction mutuelle : flux deterministe → markDirty supervision ───

    @Test
    void calendarBookedEvent_marksPropertyDirty_forSupervisionScan() {
        // Kafka est mocke dans le socle IT : on teste le listener au niveau service
        // avec le payload EXACT publie sur calendar.updates par le CalendarEngine.
        supervisionTriggerService.drainDirty(orgAId); // etat propre

        supervisionListener.onCalendarUpdate(Map.of(
                "action", "BOOKED",
                "orgId", orgAId,
                "propertyId", orgAPropertyId));

        Set<Long> dirty = supervisionTriggerService.drainDirty(orgAId);
        assertThat(dirty).containsExactly(orgAPropertyId);

        // drain = lecture + suppression atomique : un second drain est vide.
        assertThat(supervisionTriggerService.drainDirty(orgAId)).isEmpty();

        // Anti-fuite : l'org B n'a rien recu.
        assertThat(supervisionTriggerService.drainDirty(orgBId)).isEmpty();

        // Action non declenchante (BLOCKED) : ignoree.
        supervisionListener.onCalendarUpdate(Map.of(
                "action", "BLOCKED",
                "orgId", orgAId,
                "propertyId", orgAPropertyId));
        assertThat(supervisionTriggerService.drainDirty(orgAId)).isEmpty();
    }
}
