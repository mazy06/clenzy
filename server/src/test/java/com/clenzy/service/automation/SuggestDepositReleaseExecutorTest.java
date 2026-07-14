package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.repository.IssueRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.agent.supervision.AutoApplyGate;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionAutoApplyService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SuggestDepositReleaseExecutor (F4c check-out+J+X -> suggestion liberation caution)")
class SuggestDepositReleaseExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long RESERVATION_ID = 200L;
    private static final Long PROPERTY_ID = 7L;

    @Mock private SecurityDepositRepository depositRepository;
    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private AutoApplyGate autoApplyGate;
    @Mock private SupervisionAutoApplyService autoApplyService;
    @Mock private IssueRepository issueRepository;

    private SuggestDepositReleaseExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new SuggestDepositReleaseExecutor(
                depositRepository, suggestionService, autoApplyGate, autoApplyService,
                issueRepository, new ObjectMapper(), Clock.systemDefaultZone());
    }

    private static AutomationRule rule() {
        AutomationRule rule = new AutomationRule();
        rule.setId(11L);
        rule.setOrganizationId(ORG_ID);
        rule.setName("liberation caution J+2");
        return rule;
    }

    private static Reservation departedReservation() {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setOrganizationId(ORG_ID);
        Reservation reservation = new Reservation();
        reservation.setId(RESERVATION_ID);
        reservation.setOrganizationId(ORG_ID);
        reservation.setProperty(property);
        reservation.setCheckOut(LocalDate.now().minusDays(2));
        return reservation;
    }

    private static AutomationActionContext ctx(Reservation reservation) {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION,
                RESERVATION_ID, Map.of(), reservation);
    }

    @Test
    @DisplayName("action() -> SUGGEST_DEPOSIT_RELEASE")
    void actionType() {
        assertThat(executor.action()).isEqualTo(AutomationAction.SUGGEST_DEPOSIT_RELEASE);
    }

    @Test
    @DisplayName("caution encore HELD apres depart -> suggestion actionnable DEPOSIT_RELEASE")
    void heldDeposit_createsReleaseSuggestion() {
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setId(21L);
        deposit.setOrganizationId(ORG_ID);
        deposit.setReservationId(RESERVATION_ID);
        deposit.setAmount(new BigDecimal("500.00"));
        deposit.setCurrency("EUR");
        deposit.setStatus(SecurityDepositStatus.HELD);
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit));
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), anyLong(),
                anyString(), anyString(), anyString(), anyString(), anyLong(), anyString()))
                .thenReturn(true);

        ExecutionResult result = executor.execute(rule(), ctx(departedReservation()));

        assertThat(result.skipped()).isFalse();
        verify(suggestionService).recordActionableStrict(
                eq(ORG_ID), eq(PROPERTY_ID), eq("fin"), eq(RESERVATION_ID),
                contains("Liberer la caution de 500.00 EUR"),
                contains("termine"),
                eq(SupervisionActionType.DEPOSIT_RELEASE),
                contains("\"reservationId\":200"),
                eq(50000L),
                eq("warning"));
    }

    @Test
    @DisplayName("caution deja encaissee pour degats (CAPTURED) -> SKIPPED, rien a liberer")
    void capturedDeposit_skips() {
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setId(21L);
        deposit.setOrganizationId(ORG_ID);
        deposit.setReservationId(RESERVATION_ID);
        deposit.setAmount(new BigDecimal("500.00"));
        deposit.setStatus(SecurityDepositStatus.CAPTURED);
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit));

        ExecutionResult result = executor.execute(rule(), ctx(departedReservation()));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("CAPTURED");
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("V2 : le gate recoit hasOpenIssues (Issue OPEN/QUALIFIED sur le bien) + daysSinceCheckout")
    void gateReceivesEnvelopeInputs() {
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setId(21L);
        deposit.setOrganizationId(ORG_ID);
        deposit.setReservationId(RESERVATION_ID);
        deposit.setAmount(new BigDecimal("500.00"));
        deposit.setStatus(SecurityDepositStatus.HELD);
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit));
        when(issueRepository.existsByOrganizationIdAndPropertyIdAndStatusIn(
                eq(ORG_ID), eq(PROPERTY_ID), any())).thenReturn(true);
        when(autoApplyGate.decide(eq(ORG_ID), eq("fin"), eq(SupervisionActionType.DEPOSIT_RELEASE), any()))
                .thenReturn(AutoApplyGate.AutoDecision.CARD);
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), anyLong(),
                anyString(), anyString(), anyString(), anyString(), anyLong(), anyString()))
                .thenReturn(true);

        executor.execute(rule(), ctx(departedReservation()));

        // Anomalie ouverte → input true (le gate rendra CARD) ; delai post-checkout re-calcule ici.
        verify(autoApplyGate).decide(eq(ORG_ID), eq("fin"), eq(SupervisionActionType.DEPOSIT_RELEASE),
                argThat(inputs -> Boolean.TRUE.equals(inputs.get(AutoApplyGate.INPUT_HAS_OPEN_ISSUES))
                        && Long.valueOf(2L).equals(inputs.get(AutoApplyGate.INPUT_DAYS_SINCE_CHECKOUT))));
        verifyNoInteractions(autoApplyService);
    }

    @Test
    @DisplayName("V2 : gate AUTO_NOTIFY -> liberation auto via le pipeline d'apply (montant indicatif porte)")
    void gateAllowsAuto_autoReleaseViaPipeline() {
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setId(21L);
        deposit.setOrganizationId(ORG_ID);
        deposit.setReservationId(RESERVATION_ID);
        deposit.setAmount(new BigDecimal("500.00"));
        deposit.setCurrency("EUR");
        deposit.setStatus(SecurityDepositStatus.HELD);
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit));
        when(issueRepository.existsByOrganizationIdAndPropertyIdAndStatusIn(
                eq(ORG_ID), eq(PROPERTY_ID), any())).thenReturn(false);
        when(autoApplyGate.decide(eq(ORG_ID), eq("fin"), eq(SupervisionActionType.DEPOSIT_RELEASE), any()))
                .thenReturn(AutoApplyGate.AutoDecision.AUTO_NOTIFY);
        when(suggestionService.recordActionableForAutoApply(eq(ORG_ID), eq(PROPERTY_ID), eq("fin"),
                eq(RESERVATION_ID), anyString(), anyString(), eq(SupervisionActionType.DEPOSIT_RELEASE),
                anyString(), eq(50000L), eq("warning")))
                .thenReturn(Optional.of(99L));

        ExecutionResult result = executor.execute(rule(), ctx(departedReservation()));

        assertThat(result.skipped()).isFalse();
        // Meme pipeline que le bouton humain (statut caution RE-LU a l'apply, releaseHold
        // hors transaction, zero debit) ; la notif porte le montant indicatif.
        verify(autoApplyService).autoApply(eq(AutoApplyGate.AutoDecision.AUTO_NOTIFY), eq(ORG_ID),
                eq(PROPERTY_ID), eq("fin"), eq(99L), contains("500.00 EUR"), anyString(), eq(50000L));
        verify(suggestionService, org.mockito.Mockito.never()).recordActionableStrict(
                anyLong(), anyLong(), anyString(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    @DisplayName("aucune caution -> SKIPPED")
    void noDeposit_skips() {
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.empty());

        ExecutionResult result = executor.execute(rule(), ctx(departedReservation()));

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(suggestionService);
    }
}
