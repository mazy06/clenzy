package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.AiCreditRateCard;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.model.User;
import com.clenzy.repository.AiAutonomyBudgetRepository;
import com.clenzy.repository.AiCreditRateCardRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.scheduler.SupervisionAutonomousScanner;
import com.clenzy.service.agent.FailoverChatLLMProvider;
import com.clenzy.service.agent.supervision.SupervisionTriggerService;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.clenzy.service.ai.CreditMeteringService;
import com.clenzy.service.ai.AutonomyRunScope;
import com.clenzy.testkit.ScriptedChatLLMProvider;
import com.clenzy.testkit.ScriptedChatLLMProvider.ScriptedResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * Scenario S5 (complement vague T3) — autonomie premium plafonnee (X4/X8,
 * ADR-007) : {@link AiAutonomyBudget} seede en base + {@link AutonomyRunScope#runPremium} :
 * <ul>
 *   <li>sous le cap → run execute, metering au ledger en bucket PREMIUM_AUTO ;</li>
 *   <li>cumul du cycle &gt;= cap → CAPPED_PAUSE / CAPPED_NOTIFY_ONLY <b>sans
 *       execution</b> ;</li>
 *   <li>comportement desactive → DISABLED sans execution.</li>
 * </ul>
 *
 * <p>Et le consommateur reel {@link SupervisionAutonomousScanner} : verdict
 * ALLOWED → {@code autonomousScan} (LLM scripte, zero token reel) ;
 * CAPPED_NOTIFY_ONLY → {@code deterministicScanOnly} (0 appel LLM).</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
@TestPropertySource(properties = {
        "clenzy.supervision.autonomous.enabled=true",
        "clenzy.assistant.routing.enabled=false",
})
class ScenarioAutonomyPremiumIT extends AbstractIntegrationTest {

    private static final String SCRIPTED_MODEL = "scripted-model";
    private static final long CAP_MILLICREDITS = 100_000L;

    @Autowired private AutonomyRunScope autonomyRunScope;
    @Autowired private CreditMeteringService creditMeteringService;
    @Autowired private SupervisionAutonomousScanner autonomousScanner;
    @Autowired private SupervisionTriggerService supervisionTriggerService;

    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private AiAutonomyBudgetRepository budgetRepository;
    @Autowired private AiCreditRateCardRepository rateCardRepository;
    @Autowired private AiUsageLedgerRepository ledgerRepository;
    @Autowired private SupervisionSettingsRepository supervisionSettingsRepository;

    @MockBean private FailoverChatLLMProvider chatProvider;

    private final ScriptedChatLLMProvider scripted = new ScriptedChatLLMProvider();

    private Long orgId;
    private Long propertyId;
    private String salt;

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

        salt = UUID.randomUUID().toString().substring(0, 8);
        orgId = organizationRepository.save(new Organization(
                "Autonomy " + salt, OrganizationType.INDIVIDUAL, "autonomy-" + salt)).getId();

        User owner = new User("Otto", "Autonome", "otto." + salt + "@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-autonomy-" + salt);
        owner = userRepository.save(owner);

        Property property = new Property("Villa Premium " + salt, "1 rue du Cap", 3, 2, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("120.00"));
        propertyId = propertyRepository.save(property).getId();

        seedRateCardsIfAbsent();
        setupTenantContext(orgId, false);
    }

    /**
     * Grille de taux pour tous les chemins de metering : le tracking assistant
     * facture au (provider, modele) de la cible resolue (anthropic / claude-*),
     * le metering direct du test utilise (scripted / scripted-model).
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

    // ─── runPremium sous cap : execute + metering PREMIUM_AUTO ──────────────

    @Test
    void runPremium_underCap_executesAndMetersPremiumAutoBucket() {
        seedBudget(CAP_MILLICREDITS, AiAutonomyBudget.ON_CAP_PAUSE, true);

        AtomicBoolean executed = new AtomicBoolean(false);
        AutonomyBudgetService.Decision decision = autonomyRunScope.runPremium(
                orgId, AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN,
                () -> {
                    executed.set(true);
                    // Metering d'un appel LLM DANS le scope premium : le bucket
                    // ThreadLocal doit router la ligne en PREMIUM_AUTO.
                    creditMeteringService.meterLlmUsage(orgId, "system:supervisor",
                            null, null, "supervisor", "ASSISTANT_CHAT",
                            "scripted", SCRIPTED_MODEL, 1000, 500, 0,
                            false, "it-premium-" + salt);
                });

        assertThat(decision.outcome()).isEqualTo(AutonomyBudgetService.Outcome.ALLOWED);
        assertThat(executed).isTrue();

        List<AiUsageLedgerEntry> premiumDebits = premiumAutoDebits();
        assertThat(premiumDebits)
                .as("Le metering sous runPremium atterrit en bucket PREMIUM_AUTO")
                .hasSize(1);
        assertThat(premiumDebits.get(0).getMillicredits()).isEqualTo(-2000L);
    }

    // ─── Cumul >= cap : CAPPED_* SANS execution ──────────────────────────────

    @Test
    void runPremium_atCap_isCappedWithoutExecution() {
        seedBudget(CAP_MILLICREDITS, AiAutonomyBudget.ON_CAP_PAUSE, true);
        seedPremiumDebit(CAP_MILLICREDITS); // cycle deja au plafond

        AtomicBoolean executed = new AtomicBoolean(false);
        AutonomyBudgetService.Decision paused = autonomyRunScope.runPremium(
                orgId, AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN, () -> executed.set(true));

        assertThat(paused.outcome()).isEqualTo(AutonomyBudgetService.Outcome.CAPPED_PAUSE);
        assertThat(executed)
                .as("Au plafond : le run premium N'EST PAS execute")
                .isFalse();

        // Meme cap, comportement NOTIFY_ONLY : verdict distinct, toujours sans execution.
        seedBudget(CAP_MILLICREDITS, AiAutonomyBudget.ON_CAP_NOTIFY_ONLY, true);
        AutonomyBudgetService.Decision notify = autonomyRunScope.runPremium(
                orgId, AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN, () -> executed.set(true));
        assertThat(notify.outcome()).isEqualTo(AutonomyBudgetService.Outcome.CAPPED_NOTIFY_ONLY);
        assertThat(executed).isFalse();
    }

    // ─── Comportement desactive : DISABLED sans execution ───────────────────

    @Test
    void runPremium_behaviorDisabled_returnsDisabledWithoutExecution() {
        seedBudget(CAP_MILLICREDITS, AiAutonomyBudget.ON_CAP_PAUSE, false);

        AtomicBoolean executed = new AtomicBoolean(false);
        AutonomyBudgetService.Decision decision = autonomyRunScope.runPremium(
                orgId, AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN, () -> executed.set(true));

        assertThat(decision.outcome()).isEqualTo(AutonomyBudgetService.Outcome.DISABLED);
        assertThat(executed).isFalse();
    }

    // ─── SupervisionAutonomousScanner : ALLOWED → LLM ; NOTIFY_ONLY → 0 LLM ──

    @Test
    void autonomousScanner_allowedUsesScriptedLlm_cappedNotifyOnlyStaysDeterministic() {
        // Le scanner tourne sur un thread scheduler NU (aucun tenant pose) et
        // pose lui-meme le contexte via TenantScopedExecutor — qui refuse les
        // appels imbriques : on retire le tenant pose par le seed du test.
        tenantContext.setOrganizationId(null);

        // Feature supervision active pour l'org, budget quotidien de scans > 0.
        SupervisionSettings settings = new SupervisionSettings(orgId);
        settings.setEnabled(true);
        settings.setPaused(false);
        settings.setDailyScanBudget(10);
        supervisionSettingsRepository.save(settings);

        seedBudget(CAP_MILLICREDITS, AiAutonomyBudget.ON_CAP_NOTIFY_ONLY, true);

        // Scan LLM scripte : reponse catch-all (l'orchestrateur peut faire
        // plusieurs tours ; chaque tour recoit ce texte terminal).
        scripted.onRequest(req -> true,
                ScriptedResponse.text("Rien a signaler sur ce logement.")
                        .withTokens(200, 40).withModel(SCRIPTED_MODEL));

        // ── Verdict ALLOWED : le sweep scanne le logement dirty via le LLM. ──
        supervisionTriggerService.markDirty(orgId, propertyId);
        autonomousScanner.sweep();

        int callsAfterAllowed = scripted.callCount();
        assertThat(callsAfterAllowed)
                .as("ALLOWED → autonomousScan : au moins un appel LLM scripte")
                .isPositive();

        // ── Cap atteint + NOTIFY_ONLY : mode degrade deterministe, 0 LLM. ──
        seedPremiumDebit(CAP_MILLICREDITS);
        supervisionTriggerService.markDirty(orgId, propertyId);
        autonomousScanner.sweep();

        assertThat(scripted.callCount())
                .as("CAPPED_NOTIFY_ONLY → deterministicScanOnly : AUCUN appel LLM supplementaire")
                .isEqualTo(callsAfterAllowed);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void seedBudget(long cap, String onCapBehavior, boolean supervisionScanEnabled) {
        AiAutonomyBudget budget = budgetRepository.findById(orgId)
                .orElseGet(() -> new AiAutonomyBudget(orgId));
        budget.setPremiumCapMillicredits(cap);
        budget.setOnCapBehavior(onCapBehavior);
        budget.setBehaviors("{\"" + AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN + "\": "
                + supervisionScanEnabled + "}");
        budget.touch("it-test");
        budgetRepository.save(budget);
    }

    /** Ligne DEBIT PREMIUM_AUTO dans le cycle courant (cumul vers le cap). */
    private void seedPremiumDebit(long millicredits) {
        ledgerRepository.save(new AiUsageLedgerEntry(
                orgId, "system:supervisor", null, null, "supervisor", "ASSISTANT_CHAT",
                AiUsageLedgerEntry.TYPE_DEBIT, AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO,
                "scripted", SCRIPTED_MODEL, 0, 0, 0, null, null,
                -millicredits, 0L, "it-cap-seed-" + salt + "-" + UUID.randomUUID()));
    }

    private List<AiUsageLedgerEntry> premiumAutoDebits() {
        return ledgerRepository.findAll().stream()
                .filter(e -> orgId.equals(e.getOrganizationId()))
                .filter(e -> AiUsageLedgerEntry.TYPE_DEBIT.equals(e.getEntryType()))
                .filter(e -> AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO.equals(e.getAutonomyBucket()))
                .toList();
    }
}
