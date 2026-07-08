package com.clenzy.service.yield;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.RateOverride;
import com.clenzy.model.YieldAdjustment;
import com.clenzy.model.YieldMode;
import com.clenzy.model.YieldOrgConfig;
import com.clenzy.model.YieldRule;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.YieldAdjustmentRepository;
import com.clenzy.repository.YieldOrgConfigRepository;
import com.clenzy.repository.YieldRuleRepository;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SearchCacheInvalidator;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("YieldRuleEngine (yield v1 F8a : seuils, bornes, cap journalier, 3 modes)")
class YieldRuleEngineTest {

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 7L;
    private static final Long RULE_ID = 42L;
    /** Horloge fixe : 2026-07-03 10:00 en Europe/Paris (timezone du bien). */
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 3);

    @Mock private YieldOrgConfigRepository configRepository;
    @Mock private YieldRuleRepository yieldRuleRepository;
    @Mock private YieldAdjustmentRepository journalRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private SupervisionActivityService activityService;
    @Mock private SearchCacheInvalidator searchCacheInvalidator;
    @Mock private PlatformTransactionManager transactionManager;

    /** Seuil d'impact AUTO→HITL utilisé dans les tests (points de %). */
    private static final BigDecimal AUTO_HITL_PCT = new BigDecimal("12");

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-03T08:00:00Z"), ZoneId.of("UTC"));

    private YieldRuleEngine engine;
    private Property property;
    private YieldRule rule;
    private YieldOrgConfig config;

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        engine = new YieldRuleEngine(configRepository, yieldRuleRepository, journalRepository,
                propertyRepository, calendarDayRepository, rateOverrideRepository,
                priceEngine, suggestionService, activityService, searchCacheInvalidator,
                clock, AUTO_HITL_PCT, transactionManager);

        property = new Property();
        property.setId(PROPERTY_ID);
        property.setOrganizationId(ORG_ID);
        property.setName("Villa Baitly");
        property.setTimezone("Europe/Paris");
        property.setYieldPriceFloor(new BigDecimal("50.00"));
        property.setYieldPriceCeiling(new BigDecimal("200.00"));

        rule = new YieldRule();
        rule.setId(RULE_ID);
        rule.setOrganizationId(ORG_ID);
        rule.setName("Basse saison");
        rule.setRuleType(YieldRule.RuleType.OCCUPANCY_THRESHOLD);
        rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
        rule.setComparison(YieldRule.Comparison.BELOW);
        rule.setOccupancyThresholdPct(new BigDecimal("40.00"));
        rule.setWindowDaysAhead(10);
        rule.setAdjustmentPct(new BigDecimal("8.00"));
        rule.setMaxDailyChangePct(BigDecimal.TEN);
        rule.setActive(true);

        config = new YieldOrgConfig(ORG_ID);
        config.setEnabled(true);
        config.setMode(YieldMode.SIMULATION);
    }

    private void stubHappyPath(List<LocalDate> bookedDates, BigDecimal nightlyPrice) {
        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(config));
        when(yieldRuleRepository.findActiveV1ByOrganization(ORG_ID)).thenReturn(List.of(rule));
        when(propertyRepository.findByOrganizationIdAndStatus(ORG_ID, PropertyStatus.ACTIVE))
                .thenReturn(List.of(property));
        lenient().when(journalRepository.existsByPropertyIdAndAdjustmentDayAndSkipReasonIsNull(
                PROPERTY_ID, TODAY)).thenReturn(false);
        lenient().when(calendarDayRepository.findBookedDatesInRange(
                PROPERTY_ID, TODAY, TODAY.plusDays(10), ORG_ID)).thenReturn(bookedDates);
        lenient().when(rateOverrideRepository.findByPropertyIdAndDate(eq(PROPERTY_ID), any(), eq(ORG_ID)))
                .thenReturn(Optional.empty());
        lenient().when(priceEngine.resolvePrice(eq(PROPERTY_ID), any(), eq(ORG_ID)))
                .thenReturn(nightlyPrice);
    }

    @SuppressWarnings("unchecked")
    private List<YieldAdjustment> capturedJournalLines() {
        ArgumentCaptor<List<YieldAdjustment>> captor = ArgumentCaptor.forClass(List.class);
        verify(journalRepository).saveAll(captor.capture());
        return captor.getValue();
    }

    // ── Déclenchement des seuils ────────────────────────────────────────────

    @Test
    void whenOccupancyBelowThreshold_thenSimulationJournalsPriceDrop() {
        // 2 nuits réservées sur 10 → 20 % < 40 % → baisse de 8 %
        stubHappyPath(List.of(TODAY.plusDays(1), TODAY.plusDays(2)), new BigDecimal("100.00"));

        engine.evaluateOrganization(ORG_ID);

        List<YieldAdjustment> lines = capturedJournalLines();
        assertThat(lines).hasSize(8); // 10 jours − 2 nuits réservées (jamais re-tarifées)
        assertThat(lines).allSatisfy(line -> {
            assertThat(line.getMode()).isEqualTo(YieldAdjustment.Mode.SIMULATED);
            assertThat(line.getPriceBefore()).isEqualByComparingTo("100.00");
            assertThat(line.getPriceAfter()).isEqualByComparingTo("92.00");
            assertThat(line.getOccupancyPct()).isEqualByComparingTo("20.00");
            assertThat(line.getRuleId()).isEqualTo(RULE_ID);
            assertThat(line.getAdjustmentDay()).isEqualTo(TODAY);
            assertThat(line.getSkipReason()).isNull();
        });
        // SIMULATION : zéro écriture tarifaire, zéro suggestion
        verify(rateOverrideRepository, never()).save(any());
        verifyNoInteractions(suggestionService, searchCacheInvalidator);
    }

    @Test
    void whenOccupancyAboveThreshold_thenPriceIsRaisedAndCappedAtMaxDailyChange() {
        // Règle ABOVE 70 %, ajustement demandé 15 % mais cap journalier 10 % → +10 %
        rule.setComparison(YieldRule.Comparison.ABOVE);
        rule.setOccupancyThresholdPct(new BigDecimal("70.00"));
        rule.setAdjustmentPct(new BigDecimal("15.00"));
        List<LocalDate> booked = List.of(TODAY, TODAY.plusDays(1), TODAY.plusDays(2),
                TODAY.plusDays(3), TODAY.plusDays(4), TODAY.plusDays(5),
                TODAY.plusDays(6), TODAY.plusDays(7)); // 8/10 = 80 % > 70 %
        stubHappyPath(booked, new BigDecimal("100.00"));

        engine.evaluateOrganization(ORG_ID);

        List<YieldAdjustment> lines = capturedJournalLines();
        assertThat(lines).hasSize(2);
        assertThat(lines).allSatisfy(line ->
                assertThat(line.getPriceAfter()).isEqualByComparingTo("110.00"));
    }

    @Test
    void whenOccupancyDoesNotCrossThreshold_thenNothingIsJournaled() {
        // 5/10 = 50 % : ni < 40 (BELOW), rien ne se déclenche
        stubHappyPath(List.of(TODAY, TODAY.plusDays(1), TODAY.plusDays(2),
                TODAY.plusDays(3), TODAY.plusDays(4)), new BigDecimal("100.00"));

        engine.evaluateOrganization(ORG_ID);

        verify(journalRepository, never()).saveAll(any());
        verify(journalRepository, never()).save(any());
        verify(rateOverrideRepository, never()).save(any());
    }

    // ── Bornes plancher / plafond ───────────────────────────────────────────

    @Test
    void whenDropWouldGoBelowFloor_thenPriceIsClampedAtFloor() {
        property.setYieldPriceFloor(new BigDecimal("95.00"));
        stubHappyPath(List.of(), new BigDecimal("100.00")); // 0 % < 40 % → −8 % = 92 → plancher 95

        engine.evaluateOrganization(ORG_ID);

        assertThat(capturedJournalLines()).allSatisfy(line ->
                assertThat(line.getPriceAfter()).isEqualByComparingTo("95.00"));
    }

    @Test
    void whenRaiseWouldExceedCeiling_thenPriceIsClampedAtCeiling() {
        rule.setComparison(YieldRule.Comparison.ABOVE);
        rule.setOccupancyThresholdPct(new BigDecimal("70.00"));
        property.setYieldPriceCeiling(new BigDecimal("105.00"));
        List<LocalDate> booked = List.of(TODAY, TODAY.plusDays(1), TODAY.plusDays(2),
                TODAY.plusDays(3), TODAY.plusDays(4), TODAY.plusDays(5),
                TODAY.plusDays(6), TODAY.plusDays(7));
        stubHappyPath(booked, new BigDecimal("100.00")); // +8 % = 108 → plafond 105

        engine.evaluateOrganization(ORG_ID);

        assertThat(capturedJournalLines()).allSatisfy(line ->
                assertThat(line.getPriceAfter()).isEqualByComparingTo("105.00"));
    }

    @Test
    void whenPropertyHasNoBounds_thenSkipIsJournaledAndNothingChanges() {
        property.setYieldPriceFloor(null); // plafond présent mais plancher absent → NO_BOUNDS
        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(config));
        when(yieldRuleRepository.findActiveV1ByOrganization(ORG_ID)).thenReturn(List.of(rule));
        when(propertyRepository.findByOrganizationIdAndStatus(ORG_ID, PropertyStatus.ACTIVE))
                .thenReturn(List.of(property));

        engine.evaluateOrganization(ORG_ID);

        ArgumentCaptor<YieldAdjustment> captor = ArgumentCaptor.forClass(YieldAdjustment.class);
        verify(journalRepository).save(captor.capture());
        assertThat(captor.getValue().getSkipReason()).isEqualTo(YieldAdjustment.SKIP_NO_BOUNDS);
        assertThat(captor.getValue().getTargetDate()).isNull();
        verifyNoInteractions(priceEngine, rateOverrideRepository, suggestionService);
    }

    // ── Cap journalier ──────────────────────────────────────────────────────

    @Test
    void whenAlreadyEvaluatedToday_thenSecondPassSkipsWithDailyCap() {
        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(config));
        when(yieldRuleRepository.findActiveV1ByOrganization(ORG_ID)).thenReturn(List.of(rule));
        when(propertyRepository.findByOrganizationIdAndStatus(ORG_ID, PropertyStatus.ACTIVE))
                .thenReturn(List.of(property));
        when(journalRepository.existsByPropertyIdAndAdjustmentDayAndSkipReasonIsNull(
                PROPERTY_ID, TODAY)).thenReturn(true); // un run a déjà eu lieu aujourd'hui

        engine.evaluateOrganization(ORG_ID);

        ArgumentCaptor<YieldAdjustment> captor = ArgumentCaptor.forClass(YieldAdjustment.class);
        verify(journalRepository).save(captor.capture());
        assertThat(captor.getValue().getSkipReason())
                .isEqualTo(YieldAdjustment.SKIP_DAILY_CAP_REACHED);
        verifyNoInteractions(priceEngine, rateOverrideRepository, suggestionService);
    }

    // ── Modes SUGGEST et AUTO ───────────────────────────────────────────────

    @Test
    void whenModeIsSuggest_thenActionableSuggestionIsCreatedAndJournalLinked() {
        config.setMode(YieldMode.SUGGEST);
        stubHappyPath(List.of(), new BigDecimal("100.00"));
        when(suggestionService.recordActionableWithId(eq(ORG_ID), eq(PROPERTY_ID), anyString(),
                any(), anyString(), anyString(), eq(SupervisionActionType.YIELD_PRICE_ADJUST),
                anyString(), anyLong(), anyString()))
                .thenReturn(Optional.of(99L));

        engine.evaluateOrganization(ORG_ID);

        List<YieldAdjustment> lines = capturedJournalLines();
        assertThat(lines).hasSize(10);
        assertThat(lines).allSatisfy(line -> {
            assertThat(line.getMode()).isEqualTo(YieldAdjustment.Mode.SUGGESTED);
            assertThat(line.getSuggestionId()).isEqualTo(99L);
        });
        // SUGGEST : aucune écriture tarifaire tant que l'opérateur n'applique pas
        verify(rateOverrideRepository, never()).save(any());
        verifyNoInteractions(searchCacheInvalidator);
    }

    @Test
    void whenSuggestIsDuplicate_thenNoJournalNoise() {
        config.setMode(YieldMode.SUGGEST);
        stubHappyPath(List.of(), new BigDecimal("100.00"));
        when(suggestionService.recordActionableWithId(anyLong(), anyLong(), anyString(),
                any(), anyString(), anyString(), anyString(), anyString(), anyLong(), anyString()))
                .thenReturn(Optional.empty()); // proposition identique déjà en attente

        engine.evaluateOrganization(ORG_ID);

        verify(journalRepository, never()).saveAll(any());
        verify(rateOverrideRepository, never()).save(any());
    }

    @Test
    void whenModeIsAuto_thenBoundedOverridesAreWrittenAndJournaledApplied() {
        config.setMode(YieldMode.AUTO);
        stubHappyPath(List.of(), new BigDecimal("100.00"));

        engine.evaluateOrganization(ORG_ID);

        ArgumentCaptor<RateOverride> overrideCaptor = ArgumentCaptor.forClass(RateOverride.class);
        verify(rateOverrideRepository, org.mockito.Mockito.times(10)).save(overrideCaptor.capture());
        assertThat(overrideCaptor.getAllValues()).allSatisfy(override -> {
            assertThat(override.getNightlyPrice()).isEqualByComparingTo("92.00");
            assertThat(override.getSource()).isEqualTo("YIELD_RULE");
        });
        assertThat(capturedJournalLines()).allSatisfy(line ->
                assertThat(line.getMode()).isEqualTo(YieldAdjustment.Mode.APPLIED));
        verify(searchCacheInvalidator).onAvailabilityOrPriceChanged();
        // R1 : l'agent Revenue émet un feed « En direct » sur application AUTO.
        verify(activityService).recordModuleAct(eq(ORG_ID), eq(PROPERTY_ID),
                eq("rev"), eq("yield_price_adjusted"), anyString());
        verifyNoInteractions(suggestionService);
    }

    @Test
    void whenAutoChangeExceedsImpactThreshold_thenRoutedToHitlInsteadOfApplied() {
        // R1 : ampleur 15 % > seuil 12 % → même en AUTO, on n'applique pas → carte HITL.
        config.setMode(YieldMode.AUTO);
        rule.setAdjustmentPct(new BigDecimal("15.00"));
        rule.setMaxDailyChangePct(new BigDecimal("20.00")); // magnitude = min(15, 20) = 15
        stubHappyPath(List.of(), new BigDecimal("100.00"));
        when(suggestionService.recordActionableWithId(eq(ORG_ID), eq(PROPERTY_ID), anyString(),
                any(), anyString(), anyString(), eq(SupervisionActionType.YIELD_PRICE_ADJUST),
                anyString(), anyLong(), anyString()))
                .thenReturn(Optional.of(77L));

        engine.evaluateOrganization(ORG_ID);

        // Pas d'écriture tarifaire ni de feed « action faite » : c'est une proposition.
        verify(rateOverrideRepository, never()).save(any());
        verify(activityService, never()).recordModuleAct(anyLong(), anyLong(), anyString(),
                anyString(), anyString());
        verify(suggestionService).recordActionableWithId(eq(ORG_ID), eq(PROPERTY_ID), anyString(),
                any(), anyString(), anyString(), eq(SupervisionActionType.YIELD_PRICE_ADJUST),
                anyString(), anyLong(), anyString());
        assertThat(capturedJournalLines()).allSatisfy(line ->
                assertThat(line.getMode()).isEqualTo(YieldAdjustment.Mode.SUGGESTED));
        verifyNoInteractions(searchCacheInvalidator);
    }

    @Test
    void whenManualOverrideExistsOnDate_thenAutoNeverOverwritesIt() {
        config.setMode(YieldMode.AUTO);
        stubHappyPath(List.of(), new BigDecimal("100.00"));
        RateOverride manual = new RateOverride(property, TODAY, new BigDecimal("150.00"), "MANUAL", ORG_ID);
        when(rateOverrideRepository.findByPropertyIdAndDate(PROPERTY_ID, TODAY, ORG_ID))
                .thenReturn(Optional.of(manual));

        engine.evaluateOrganization(ORG_ID);

        // 9 nuits ajustées (la nuit sous override MANUAL est intouchée)
        verify(rateOverrideRepository, org.mockito.Mockito.times(9)).save(any());
        assertThat(manual.getNightlyPrice()).isEqualByComparingTo("150.00");
        assertThat(manual.getSource()).isEqualTo("MANUAL");
    }

    // ── Kill-switch ─────────────────────────────────────────────────────────

    @Test
    void whenKillSwitchIsOff_thenNothingRunsAtAll() {
        config.setEnabled(false);
        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(config));

        engine.evaluateOrganization(ORG_ID);

        verifyNoInteractions(yieldRuleRepository, propertyRepository, calendarDayRepository,
                priceEngine, rateOverrideRepository, journalRepository,
                suggestionService, searchCacheInvalidator);
    }

    @Test
    void whenNoConfigExists_thenNothingRunsAtAll() {
        when(configRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

        engine.evaluateOrganization(ORG_ID);

        verifyNoInteractions(yieldRuleRepository, propertyRepository, journalRepository);
    }
}
