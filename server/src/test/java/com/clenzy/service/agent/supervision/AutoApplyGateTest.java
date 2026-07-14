package com.clenzy.service.agent.supervision;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;

import static com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_NOTIFY;
import static com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_SILENT;
import static com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.CARD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Hiérarchie de commande du gate (Vagues 1-2) : kill-switch global → plafond
 * module → niveau MAX du type (catalogue) → toggle du type → enveloppe →
 * budget premium. Défaut sûr : CARD (HITL).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AutoApplyGate.decide (autonomie Vagues 1-2)")
class AutoApplyGateTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 7L;

    @Mock private SupervisionSettingsRepository settingsRepository;
    @Mock private SupervisionModuleSettingsRepository moduleSettingsRepository;
    @Mock private SupervisionAutoRuleRepository autoRuleRepository;
    @Mock private SupervisionSuggestionRepository suggestionRepository;
    @Mock private AutonomyBudgetService autonomyBudgetService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-11T10:00:00Z"), ZoneOffset.UTC);

    private AutoApplyGate gate;

    @BeforeEach
    void setUp() {
        gate = new AutoApplyGate(settingsRepository, moduleSettingsRepository,
                new SupervisionModuleRegistry(), autoRuleRepository, suggestionRepository,
                autonomyBudgetService, new ObjectMapper(), clock);
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
    @DisplayName("PRICE_DROP : dans l'enveloppe (defaut 12 %) -> AUTO_NOTIFY (max type N1, jamais silencieux)")
    void priceDropWithinEnvelope_autoNotifyAtMost() {
        globalEnabled();
        module("rev", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.PRICE_DROP, true, SupervisionAutonomy.FULL, null);

        // Regle FULL + module FULL, mais le catalogue plafonne PRICE_DROP a NOTIFY
        // (matrice du plan : N1 via cadre yield) → jamais AUTO_SILENT.
        assertThat(gate.decide(ORG, "rev", SupervisionActionType.PRICE_DROP,
                Map.of(AutoApplyGate.INPUT_MAX_SEGMENT_ABS_PERCENT, 10)))
                .isEqualTo(AUTO_NOTIFY);
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

    // ── 2 bis. Niveau MAX du type (catalogue serveur) ────────────────────────

    @Test
    @DisplayName("type hors catalogue (YIELD_PRICE_ADJUST : cadre yield dedie) -> CARD meme tout ouvert")
    void unknownCatalogType_card() {
        globalEnabled();
        module("rev", true, SupervisionAutonomy.FULL);

        assertThat(gate.decide(ORG, "rev", SupervisionActionType.YIELD_PRICE_ADJUST, Map.of()))
                .isEqualTo(CARD);
    }

    // ── V2 : CALENDAR_BLOCK (N1 max) ─────────────────────────────────────────

    private Map<String, Object> calendarInputs(int days) {
        return Map.of(AutoApplyGate.INPUT_BLOCK_DAYS, days,
                AutoApplyGate.INPUT_PROPERTY_ID, PROP);
    }

    @Test
    @DisplayName("CALENDAR_BLOCK : regle FULL + module FULL -> AUTO_NOTIFY, JAMAIS silencieux (max type)")
    void calendarBlockNeverSilent() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.CALENDAR_BLOCK, true, SupervisionAutonomy.FULL, null);
        when(suggestionRepository
                .existsByOrganizationIdAndPropertyIdAndActionTypeAndStatusAndAppliedByAndAppliedAtAfter(
                        eq(ORG), eq(PROP), eq(SupervisionActionType.CALENDAR_BLOCK),
                        eq(SupervisionSuggestion.STATUS_APPLIED),
                        eq(SupervisionSuggestion.APPLIED_BY_AUTO), any(Instant.class)))
                .thenReturn(false);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CALENDAR_BLOCK, calendarInputs(7)))
                .isEqualTo(AUTO_NOTIFY);
    }

    @Test
    @DisplayName("CALENDAR_BLOCK : duree > maxAutoBlockDays (defaut 7) -> CARD")
    void calendarBlockOverMaxDays_card() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.CALENDAR_BLOCK, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CALENDAR_BLOCK, calendarInputs(10)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("CALENDAR_BLOCK : cap « 1 auto-blocage / bien / 7 jours » consomme -> CARD")
    void calendarBlockWeeklyCapConsumed_card() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.CALENDAR_BLOCK, true, SupervisionAutonomy.NOTIFY, null);
        when(suggestionRepository
                .existsByOrganizationIdAndPropertyIdAndActionTypeAndStatusAndAppliedByAndAppliedAtAfter(
                        eq(ORG), eq(PROP), anyString(), anyString(), anyString(), any(Instant.class)))
                .thenReturn(true);

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CALENDAR_BLOCK, calendarInputs(7)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("CALENDAR_BLOCK : enveloppe editee ({maxAutoBlockDays:3}) plus stricte -> CARD a 7 j")
    void calendarBlockCustomEnvelope_stricter() {
        globalEnabled();
        module("ops", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.CALENDAR_BLOCK, true, SupervisionAutonomy.NOTIFY,
                "{\"maxAutoBlockDays\":3}");

        assertThat(gate.decide(ORG, "ops", SupervisionActionType.CALENDAR_BLOCK, calendarInputs(7)))
                .isEqualTo(CARD);
    }

    // ── V2 : DEPOSIT_RELEASE / DEPOSIT_REFUND (N1 max, liberation de hold seule) ─

    @Test
    @DisplayName("DEPOSIT_RELEASE : anomalie ouverte sur le logement -> CARD")
    void depositReleaseWithOpenIssue_card() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.DEPOSIT_RELEASE, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.DEPOSIT_RELEASE, Map.of(
                AutoApplyGate.INPUT_HAS_OPEN_ISSUES, true,
                AutoApplyGate.INPUT_DAYS_SINCE_CHECKOUT, 5L)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("DEPOSIT_RELEASE : delai post-checkout non atteint (J+1 < 2) -> CARD")
    void depositReleaseTooEarly_card() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.DEPOSIT_RELEASE, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.DEPOSIT_RELEASE, Map.of(
                AutoApplyGate.INPUT_HAS_OPEN_ISSUES, false,
                AutoApplyGate.INPUT_DAYS_SINCE_CHECKOUT, 1L)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("DEPOSIT_RELEASE : conditions reunies -> AUTO_NOTIFY (max NOTIFY meme en FULL partout)")
    void depositReleaseAllGreen_autoNotify() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.DEPOSIT_RELEASE, true, SupervisionAutonomy.FULL, null);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.DEPOSIT_RELEASE, Map.of(
                AutoApplyGate.INPUT_HAS_OPEN_ISSUES, false,
                AutoApplyGate.INPUT_DAYS_SINCE_CHECKOUT, 2L)))
                .isEqualTo(AUTO_NOTIFY);
    }

    @Test
    @DisplayName("DEPOSIT_RELEASE : input hasOpenIssues absent -> CARD (fail-safe)")
    void depositReleaseMissingIssueInput_card() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.DEPOSIT_RELEASE, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.DEPOSIT_RELEASE,
                Map.of(AutoApplyGate.INPUT_DAYS_SINCE_CHECKOUT, 5L)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("DEPOSIT_REFUND : annulation non confirmee (statut re-lu) -> CARD")
    void depositRefundCancellationNotConfirmed_card() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.DEPOSIT_REFUND, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.DEPOSIT_REFUND, Map.of(
                AutoApplyGate.INPUT_HAS_OPEN_ISSUES, false,
                AutoApplyGate.INPUT_CANCELLATION_CONFIRMED, false)))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("DEPOSIT_REFUND : annulation confirmee + aucune anomalie -> AUTO_NOTIFY")
    void depositRefundAllGreen_autoNotify() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.DEPOSIT_REFUND, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.DEPOSIT_REFUND, Map.of(
                AutoApplyGate.INPUT_HAS_OPEN_ISSUES, false,
                AutoApplyGate.INPUT_CANCELLATION_CONFIRMED, true)))
                .isEqualTo(AUTO_NOTIFY);
    }

    // ── V3 : PAYMENT_REMINDER (N1 max, 1ʳᵉ relance seulement) ────────────────

    private static final Long RESA = 200L;

    private Map<String, Object> reminderInputs() {
        return Map.of(AutoApplyGate.INPUT_PAYMENT_RESERVATION_ID, RESA);
    }

    @Test
    @DisplayName("PAYMENT_REMINDER : 1ʳᵉ relance -> AUTO_NOTIFY, jamais silencieux (max type meme en FULL/FULL)")
    void paymentReminderFirst_autoNotify() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.FULL);
        rule(SupervisionActionType.PAYMENT_REMINDER, true, SupervisionAutonomy.FULL, null);
        when(suggestionRepository.existsByOrganizationIdAndReservationIdAndActionTypeAndStatus(
                ORG, RESA, SupervisionActionType.PAYMENT_REMINDER, SupervisionSuggestion.STATUS_APPLIED))
                .thenReturn(false);
        when(suggestionRepository.existsByOrganizationIdAndReservationIdAndActionTypeAndCreatedAtAfter(
                eq(ORG), eq(RESA), eq(SupervisionActionType.PAYMENT_REMINDER), any(Instant.class)))
                .thenReturn(false);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.PAYMENT_REMINDER, reminderInputs()))
                .isEqualTo(AUTO_NOTIFY);
    }

    @Test
    @DisplayName("PAYMENT_REMINDER : une relance deja APPLIED (quel que soit l'acteur) -> CARD")
    void paymentReminderAlreadyApplied_card() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.PAYMENT_REMINDER, true, SupervisionAutonomy.NOTIFY, null);
        when(suggestionRepository.existsByOrganizationIdAndReservationIdAndActionTypeAndStatus(
                ORG, RESA, SupervisionActionType.PAYMENT_REMINDER, SupervisionSuggestion.STATUS_APPLIED))
                .thenReturn(true);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.PAYMENT_REMINDER, reminderInputs()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("PAYMENT_REMINDER : une carte relance creee < 72 h -> CARD (anti-rafale)")
    void paymentReminderWithin72h_card() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.PAYMENT_REMINDER, true, SupervisionAutonomy.NOTIFY, null);
        when(suggestionRepository.existsByOrganizationIdAndReservationIdAndActionTypeAndStatus(
                ORG, RESA, SupervisionActionType.PAYMENT_REMINDER, SupervisionSuggestion.STATUS_APPLIED))
                .thenReturn(false);
        when(suggestionRepository.existsByOrganizationIdAndReservationIdAndActionTypeAndCreatedAtAfter(
                eq(ORG), eq(RESA), eq(SupervisionActionType.PAYMENT_REMINDER),
                eq(Instant.parse("2026-07-08T10:00:00Z")))) // now − 72 h (clock fixe)
                .thenReturn(true);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.PAYMENT_REMINDER, reminderInputs()))
                .isEqualTo(CARD);
    }

    @Test
    @DisplayName("PAYMENT_REMINDER : input reservation manquant -> CARD (fail-safe)")
    void paymentReminderMissingReservation_card() {
        globalEnabled();
        module("fin", true, SupervisionAutonomy.NOTIFY);
        rule(SupervisionActionType.PAYMENT_REMINDER, true, SupervisionAutonomy.NOTIFY, null);

        assertThat(gate.decide(ORG, "fin", SupervisionActionType.PAYMENT_REMINDER, Map.of()))
                .isEqualTo(CARD);
    }
}
