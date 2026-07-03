package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.dto.AgentRunReplayDto;
import com.clenzy.model.AgentRun;
import com.clenzy.model.AiCreditGrant;
import com.clenzy.model.AiCreditRateCard;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AiCreditGrantRepository;
import com.clenzy.repository.AiCreditRateCardRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentRunQueryService;
import com.clenzy.service.agent.AgentSseEvent;
import com.clenzy.service.agent.FailoverChatLLMProvider;
import com.clenzy.testkit.ScriptedChatLLMProvider;
import com.clenzy.testkit.ScriptedChatLLMProvider.ScriptedResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.TestPropertySource;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * Scenario S4 (complement vague T3) — credits, replay et what-if : enforcement
 * de credits ACTIVE ({@code clenzy.ai.credits.enforcement.enabled=true}) sur un
 * run assistant 100 % scripte (zero token reel) :
 * <ul>
 *   <li>le run debite le ledger ({@code ai_usage_ledger}, DEBIT, bucket
 *       INTERACTIVE, montant = rate card seedee) et decremente la poche
 *       ({@code ai_credit_grant.millicredits_consumed}) ;</li>
 *   <li>solde ~0 → {@code RunCreditGuard.beginRun} refuse (hard cap) : AUCUN
 *       appel LLM, erreur SSE explicite ;</li>
 *   <li>replay {@code agent_run} : les steps du run sont restitues ;</li>
 *   <li>{@code composeWhatIfPrompt} : prompt correct (question d'origine +
 *       hypothese), acces cross-org REFUSE.</li>
 * </ul>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
@TestPropertySource(properties = {
        "clenzy.ai.credits.enforcement.enabled=true",
        "clenzy.assistant.routing.enabled=false",
})
class ScenarioAssistantCreditsIT extends AbstractIntegrationTest {

    private static final String SCRIPTED_MODEL = "scripted-model";

    @Autowired private AgentOrchestrator agentOrchestrator;
    @Autowired private AgentRunQueryService agentRunQueryService;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private AiCreditGrantRepository grantRepository;
    @Autowired private AiCreditRateCardRepository rateCardRepository;
    @Autowired private AiUsageLedgerRepository ledgerRepository;
    @Autowired private AgentRunRepository agentRunRepository;

    @MockBean private FailoverChatLLMProvider chatProvider;

    private final ScriptedChatLLMProvider scripted = new ScriptedChatLLMProvider();

    private Long orgAId;
    private Long orgBId;

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
        orgAId = organizationRepository.save(new Organization(
                "Credits A " + salt, OrganizationType.INDIVIDUAL, "credits-a-" + salt)).getId();
        orgBId = organizationRepository.save(new Organization(
                "Credits B " + salt, OrganizationType.INDIVIDUAL, "credits-b-" + salt)).getId();
        setupTenantContext(orgAId, false);

        // Rate card versionnee : 1000 mc / 1k tokens input, 2000 mc / 1k output.
        // Deux providers couverts : le nom resolu peut etre celui du provider
        // scripte ("scripted") ou le repli "anthropic" du tracking.
        seedRateCardsIfAbsent();

        // Poche de credits org A : 50 000 mc (>> plancher 2000 mc du pre-vol).
        grantRepository.save(new AiCreditGrant(orgAId, AiCreditGrant.SOURCE_TOPUP,
                50_000L, Instant.now().plus(Duration.ofDays(30)), null));
        // Org B : AUCUNE poche → solde 0 → hard cap.
    }

    /**
     * Grille de taux pour TOUS les chemins de metering du test : le tracking
     * facture au (provider, modele) de la CIBLE RESOLUE (ex. anthropic /
     * claude-*), pas au modele rapporte par la reponse scriptee.
     */
    private void seedRateCardsIfAbsent() {
        boolean present = !rateCardRepository.findByEffectiveToIsNull().isEmpty();
        if (present) {
            return;
        }
        for (String provider : List.of("scripted", "anthropic")) {
            for (String prefix : List.of("scripted", "claude")) {
                rateCardRepository.save(new AiCreditRateCard(
                        provider, prefix, AiCreditRateCard.TYPE_INPUT, 500, 1000, "it-test"));
                rateCardRepository.save(new AiCreditRateCard(
                        provider, prefix, AiCreditRateCard.TYPE_OUTPUT, 1000, 2000, "it-test"));
            }
        }
    }

    // ─── Run scripte : debit ledger INTERACTIVE + poche decrementee ─────────

    @Test
    void assistantRun_withEnforcementEnabled_debitsLedgerAndPocket_thenReplayAndWhatIf() {
        // Un tour texte : 1000 tokens prompt + 500 completion
        // → debit = ceil(1000×1000/1000) + ceil(500×2000/1000) = 2000 mc.
        scripted.enqueue(ScriptedResponse.text("Ton taux d'occupation est de 74 %.")
                .withTokens(1000, 500).withModel(SCRIPTED_MODEL));

        List<AgentSseEvent> events = new ArrayList<>();
        Long conversationId = agentOrchestrator.handleMessage(
                null, "quel est mon taux d'occupation ?",
                AgentContext.minimal(orgAId, "kc-credits-user"), events::add);

        assertThat(conversationId).isNotNull();
        assertThat(events).anyMatch(e -> "done".equals(e.type()));
        assertThat(scripted.callCount()).isEqualTo(1);

        // Ledger : UNE ligne DEBIT bucket INTERACTIVE de -2000 mc pour l'org A.
        List<AiUsageLedgerEntry> debits = ledgerRepository.findAll().stream()
                .filter(e -> orgAId.equals(e.getOrganizationId()))
                .filter(e -> AiUsageLedgerEntry.TYPE_DEBIT.equals(e.getEntryType()))
                .toList();
        assertThat(debits).hasSize(1);
        AiUsageLedgerEntry debit = debits.get(0);
        assertThat(debit.getAutonomyBucket()).isEqualTo(AiUsageLedgerEntry.BUCKET_INTERACTIVE);
        assertThat(debit.getMillicredits()).isEqualTo(-2000L);

        // Poche : millicredits_consumed decremente le restant.
        AiCreditGrant pocket = grantRepository.findAll().stream()
                .filter(g -> orgAId.equals(g.getOrganizationId()))
                .findFirst().orElseThrow();
        assertThat(pocket.getMillicreditsConsumed()).isEqualTo(2000L);
        assertThat(pocket.remaining()).isEqualTo(48_000L);

        // ── Replay : le run persiste porte ses steps. ──
        AgentRun run = awaitRun(conversationId);
        AgentRunReplayDto replay = agentRunQueryService.getReplay(run.getId());
        assertThat(replay.userQuery()).isEqualTo("quel est mon taux d'occupation ?");
        assertThat(replay.steps())
                .as("Le replay doit porter les steps du run")
                .isNotEmpty();

        // ── What-if : prompt correct... ──
        String prompt = agentRunQueryService.composeWhatIfPrompt(
                run.getId(), "et si je baissais mes prix de 10 % ?");
        assertThat(prompt)
                .contains("quel est mon taux d'occupation ?")
                .contains("et si je baissais mes prix de 10 % ?");

        // ...et acces cross-org REFUSE (replay ET what-if).
        setupTenantContext(orgBId, false);
        assertThatThrownBy(() -> agentRunQueryService.composeWhatIfPrompt(run.getId(), "hypothese"))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> agentRunQueryService.getReplay(run.getId()))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ─── Hard cap : solde 0 → beginRun refuse, AUCUN appel LLM ──────────────

    @Test
    void zeroBalance_hardCap_refusesRunBeforeAnyLlmCall() {
        setupTenantContext(orgBId, false);

        List<AgentSseEvent> events = new ArrayList<>();
        Long conversationId = agentOrchestrator.handleMessage(
                null, "analyse mon parc",
                AgentContext.minimal(orgBId, "kc-credits-b-user"), events::add);

        assertThat(conversationId).isNotNull();
        assertThat(scripted.callCount())
                .as("Hard cap : le pre-vol refuse AVANT tout appel LLM")
                .isZero();
        assertThat(events)
                .as("Une erreur SSE explicite est emise au client")
                .anyMatch(e -> "error".equals(e.type()));

        // Aucun debit au ledger pour l'org sans solde.
        assertThat(ledgerRepository.findAll().stream()
                .filter(e -> orgBId.equals(e.getOrganizationId()))
                .filter(e -> AiUsageLedgerEntry.TYPE_DEBIT.equals(e.getEntryType())))
                .isEmpty();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private AgentRun awaitRun(Long conversationId) {
        // L'ecriture du run est asynchrone best-effort → attente bornee.
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(agentRunRepository.findAll().stream()
                        .filter(r -> conversationId.equals(r.getConversationId())))
                        .isNotEmpty());
        return agentRunRepository.findAll().stream()
                .filter(r -> conversationId.equals(r.getConversationId()))
                .findFirst().orElseThrow();
    }
}
