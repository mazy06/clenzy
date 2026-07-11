package com.clenzy.service.agent.supervision;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_NOTIFY;
import static com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_SILENT;
import static com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.CARD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Hiérarchie de commande du gate (Vague 1) : kill-switch global → plafond module
 * → toggle du type → enveloppe → budget premium. Défaut sûr : CARD (HITL).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AutoApplyGate.decide (autonomie Vague 1)")
class AutoApplyGateTest {

    private static final Long ORG = 1L;

    @Mock private SupervisionSettingsRepository settingsRepository;
    @Mock private SupervisionModuleSettingsRepository moduleSettingsRepository;
    @Mock private SupervisionAutoRuleRepository autoRuleRepository;
    @Mock private AutonomyBudgetService autonomyBudgetService;

    private AutoApplyGate gate;

    @BeforeEach
    void setUp() {
        gate = new AutoApplyGate(settingsRepository, moduleSettingsRepository,
                new SupervisionModuleRegistry(), autoRuleRepository,
                autonomyBudgetService, new ObjectMapper());
    }

    // ── Fixtures ────────────────────────────────────────────────────────────

    private void globalEnabled() {
        SupervisionSettings settings = new SupervisionSettings(ORG);
        settings.setEnabled(true);
        when(settingsRepository.findByOrganizationId(ORG)).thenReturn(Optional.of(settings));
    }

    private void module(String key, boolean enabled, SupervisionAutonomy level) {
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, key))
                .thenReturn(Optional.of(new SupervisionModuleSettings(ORG, key, enabled, level)));
    }

    private void rule(String actionType, boolean enabled, SupervisionAutonomy level, String envelope) {
        SupervisionAutoRule r = new SupervisionAutoRule(ORG, actionType);
        r.setEnabled(enabled);
        r.setLevel(level);
        r.setEnvelope(envelope);
        when(autoRuleRepository.findByOrganizationIdAndActionType(ORG, actionType))
                .thenReturn(Optional.of(r));
    }

    private void premiumBudget(long capMc, long consumedMc) {
        AiAutonomyBudget budget = new AiAutonomyBudget(ORG);
        budget.setPremiumCapMillicredits(capMc);
        lenient().when(autonomyBudgetService.getConfig(ORG)).thenReturn(budget);
        lenient().when(autonomyBudgetService.currentPremiumConsumption(ORG)).thenReturn(consumedMc);
    }

    // ── 1. Kill-switch global ────────────────────────────────────────────────

    @Test
    @DisplayName("supervision globale OFF (aucune ligne) -> CARD, quoi que disent les regles")
    void globalOff_card() {
        when(settingsRepository.findByOrganizationId(ORG)).thenReturn(Optional.empty());

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("supervision en pause -> CARD")
    void globalPaused_card() {
        SupervisionSettings settings = new SupervisionSettings(ORG);
        settings.setEnabled(true);
        settings.setPaused(true);
        when(settingsRepository.findByOrganizationId(ORG)).thenReturn(Optional.of(settings));

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(CARD);
    }

    // ── 2. Plafond module ───────────────────────────────────────────────────

    @Test
    @DisplayName("regle FULL mais module SUGGEST -> CARD (le plafond bride)")
    void ruleFullButModuleSuggest_card() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.SUGGEST);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("module sans ligne org -> defaut catalogue SUGGEST -> CARD")
    void moduleWithoutOverride_defaultsToSuggest_card() {
        globalEnabled();
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "ops"))
                .thenReturn(Optional.empty());

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("module desactive -> CARD meme en FULL")
    void moduleDisabled_card() {
        globalEnabled();
        module("ops", false, SupervisionAutonomy.FULL);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("min(niveau regle, plafond module) : regle FULL + module NOTIFY -> AUTO_NOTIFY")
    void ruleFullModuleNotify_cappedToNotify() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.CLEANING_REQUEST, true, SupervisionAutonomy.FULL, null);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(AUTO_NOTIFY);
    }

    @Test
    @DisplayName("regle NOTIFY + module FULL -> AUTO_NOTIFY (la regle reste le minimum)")
    void ruleNotifyModuleFull_notify() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.CLEANING_REQUEST, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(AUTO_NOTIFY);
    }

    @Test
    @DisplayName("regle FULL + module FULL -> AUTO_SILENT")
    void ruleFullModuleFull_silent() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.CLEANING_REQUEST, true, SupervisionAutonomy.FULL, null);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(AUTO_SILENT);
    }

    // ── 3. Toggle du type ───────────────────────────────────────────────────

    @Test
    @DisplayName("aucune regle pour le type (opt-in absent) -> CARD")
    void noRule_card() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        when(autoRuleRepository.findByOrganizationIdAndActionType(ORG, SupervisionActionType.CLEANING_REQUEST))
                .thenReturn(Optional.empty());

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("regle presente mais disabled (kill-switch par type) -> CARD")
    void ruleDisabled_card() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.CLEANING_REQUEST, false, SupervisionAutonomy.FULL, null);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(CARD);
    }

    // ── 4. Enveloppe ────────────────────────────────────────────────────────

    @Test
    @DisplayName("PRICE_DROP : segment au-dela du defaut d'enveloppe (12 %) -> CARD")
    void priceDropOverDefaultEnvelope_card() {
        globalEnabled();
        module("rev", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.PRICE_DROP, true, SupervisionAutonomy.FULL, null);

        assertThat(gate.decide(ORG, "rev", SupervisionActionType.PRICE_DROP,
                Map.of(AutoApplyGate.INPUT_MAX_SEGMENT_ABS_PERCENT, 15)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("PRICE_DROP : dans l'enveloppe (par defaut 12 %) -> AUTO")
    void priceDropWithinEnvelope_auto() {
        globalEnabled();
        module("rev", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.PRICE_DROP, true, SupervisionAutonomy.FULL, null);

        assertThat(gate.decide(ORG, "rev", SupervisionActionType.PRICE_DROP,
                Map.of(AutoApplyGate.INPUT_MAX_SEGMENT_ABS_PERCENT, 10)))
                .isEqualTo(AUTO_SILENT);
    }

    @Test
    @DisplayName("PRICE_DROP : enveloppe editee ({maxSegmentPercent:8}) plus stricte -> CARD a 10 %")
    void priceDropCustomEnvelope_stricter() {
        globalEnabled();
        module("rev", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.PRICE_DROP, true, SupervisionAutonomy.FULL,
                "{\"maxSegmentPercent\":8}");

        assertThat(gate.decide(ORG, "rev", SupervisionActionType.PRICE_DROP,
                Map.of(AutoApplyGate.INPUT_MAX_SEGMENT_ABS_PERCENT, 10)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("PRICE_DROP : input d'enveloppe manquant -> CARD (fail-safe)")
    void priceDropMissingInput_card() {
        globalEnabled();
        module("rev", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.PRICE_DROP, true, SupervisionAutonomy.FULL, null);

        assertThat(gate.decide(ORG, "rev", SupervisionActionType.PRICE_DROP, Map.of()))
                .isEqualTo(CARD);
    }

    // ── 5. Budget premium (REVIEW_DRAFT_REPLY) ──────────────────────────────

    @Test
    @DisplayName("REVIEW_DRAFT_REPLY : plafond premium atteint -> CARD")
    void reviewDraftBudgetExhausted_card() {
        globalEnabled();
        module("rep", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.REVIEW_DRAFT_REPLY, true, SupervisionAutonomy.FULL, null);
        premiumBudget(500_000L, 500_000L);

        assertThat(gate.decide(ORG, "rep", SupervisionActionType.REVIEW_DRAFT_REPLY, Map.of()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("REVIEW_DRAFT_REPLY : plafond nul (forfait sans autonomie premium) -> CARD")
    void reviewDraftZeroCap_card() {
        globalEnabled();
        module("rep", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.REVIEW_DRAFT_REPLY, true, SupervisionAutonomy.FULL, null);
        premiumBudget(0L, 0L);

        assertThat(gate.decide(ORG, "rep", SupervisionActionType.REVIEW_DRAFT_REPLY, Map.of()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("REVIEW_DRAFT_REPLY : budget disponible -> AUTO (le budget ne gate que ce type)")
    void reviewDraftBudgetAvailable_auto() {
        globalEnabled();
        module("rep", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.REVIEW_DRAFT_REPLY, true, SupervisionAutonomy.FULL, null);
        premiumBudget(500_000L, 100_000L);

        assertThat(gate.decide(ORG, "rep", SupervisionActionType.REVIEW_DRAFT_REPLY, Map.of()))
                .isEqualTo(AUTO_SILENT);
    }

    @Test
    @DisplayName("CLEANING_REQUEST ne consomme pas de credits : le budget n'est pas consulte")
    void cleaningRequestIgnoresBudget() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.CLEANING_REQUEST, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CLEANING_REQUEST, Map.of()))
                .isEqualTo(AUTO_NOTIFY);
        org.mockito.Mockito.verifyNoInteractions(autonomyBudgetService);
    }
}
