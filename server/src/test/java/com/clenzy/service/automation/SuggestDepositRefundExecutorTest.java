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
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.argThat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SuggestDepositRefundExecutor (F2b annulation -> suggestion remboursement caution)")
class SuggestDepositRefundExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long RESERVATION_ID = 100L;
    private static final Long PROPERTY_ID = 7L;
    private static final Long DEPOSIT_ID = 9L;

    @Mock private SecurityDepositRepository depositRepository;
    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private AutoApplyGate autoApplyGate;
    @Mock private SupervisionAutoApplyService autoApplyService;
    @Mock private IssueRepository issueRepository;

    private SuggestDepositRefundExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new SuggestDepositRefundExecutor(
                depositRepository, suggestionService, autoApplyGate, autoApplyService,
                issueRepository, new ObjectMapper(), Clock.systemDefaultZone());
    }

    private static AutomationRule rule() {
        AutomationRule rule = new AutomationRule();
        rule.setId(10L);
        rule.setOrganizationId(ORG_ID);
        rule.setName("caution annulation");
        return rule;
    }

    private static Reservation reservation() {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setOrganizationId(ORG_ID);
        Reservation reservation = new Reservation();
        reservation.setId(RESERVATION_ID);
        reservation.setOrganizationId(ORG_ID);
        reservation.setProperty(property);
        return reservation;
    }

    private static AutomationActionContext ctx(Reservation reservation) {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION,
                RESERVATION_ID, Map.of(), reservation);
    }

    private static SecurityDeposit deposit(SecurityDepositStatus status) {
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setId(DEPOSIT_ID);
        deposit.setOrganizationId(ORG_ID);
        deposit.setReservationId(RESERVATION_ID);
        deposit.setAmount(new BigDecimal("350.00"));
        deposit.setCurrency("EUR");
        deposit.setStatus(status);
        return deposit;
    }

    @Test
    @DisplayName("action() -> SUGGEST_DEPOSIT_REFUND")
    void actionType() {
        assertThat(executor.action()).isEqualTo(AutomationAction.SUGGEST_DEPOSIT_REFUND);
    }

    @Test
    @DisplayName("sujet non-reservation -> echec explicite")
    void wrongSubject_throws() {
        AutomationActionContext ctx = new AutomationActionContext(
                ORG_ID, AutomationSubject.TYPE_INVOICE, 5L, Map.of());

        assertThatThrownBy(() -> executor.execute(rule(), ctx))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESERVATION");
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("aucune caution -> SKIPPED, aucune suggestion")
    void noDeposit_skips() {
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.empty());

        ExecutionResult result = executor.execute(rule(), ctx(reservation()));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("Aucune caution");
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("caution deja liberee (RELEASED) -> SKIPPED")
    void depositNotHeld_skips() {
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.RELEASED)));

        ExecutionResult result = executor.execute(rule(), ctx(reservation()));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("RELEASED");
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("reservation sans logement -> SKIPPED (file de suggestions par logement)")
    void reservationWithoutProperty_skips() {
        Reservation reservation = reservation();
        reservation.setProperty(null);

        ExecutionResult result = executor.execute(rule(), ctx(reservation));

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("cas nominal : suggestion actionnable DEPOSIT_REFUND avec montant serveur en centimes")
    void heldDeposit_createsActionableSuggestion() {
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD)));
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), anyLong(),
                anyString(), anyString(), anyString(), anyString(), anyLong(), anyString()))
                .thenReturn(true);

        ExecutionResult result = executor.execute(rule(), ctx(reservation()));

        assertThat(result.skipped()).isFalse();
        verify(suggestionService).recordActionableStrict(
                eq(ORG_ID), eq(PROPERTY_ID), eq("fin"), eq(RESERVATION_ID),
                contains("350.00 EUR"),               // titre : montant indicatif calcule serveur
                contains("annulee"),
                eq(SupervisionActionType.DEPOSIT_REFUND),
                contains("\"depositId\":9"),
                eq(35000L),                            // impact estime en centimes (HALF_UP)
                eq("warning"));
    }

    @Test
    @DisplayName("V2 : annulation confirmee (statut re-lu) + aucune anomalie -> le gate recoit les inputs")
    void gateReceivesCancellationConfirmedInput() {
        Reservation cancelled = reservation();
        cancelled.setStatus("cancelled");
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD)));
        when(issueRepository.existsByOrganizationIdAndPropertyIdAndStatusIn(
                eq(ORG_ID), eq(PROPERTY_ID), any())).thenReturn(false);
        when(autoApplyGate.decide(eq(ORG_ID), eq("fin"), eq(SupervisionActionType.DEPOSIT_REFUND), any()))
                .thenReturn(AutoApplyGate.AutoDecision.CARD);
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), anyLong(),
                anyString(), anyString(), anyString(), anyString(), anyLong(), anyString()))
                .thenReturn(true);

        executor.execute(rule(), ctx(cancelled));

        verify(autoApplyGate).decide(eq(ORG_ID), eq("fin"), eq(SupervisionActionType.DEPOSIT_REFUND),
                argThat(inputs -> Boolean.FALSE.equals(inputs.get(AutoApplyGate.INPUT_HAS_OPEN_ISSUES))
                        && Boolean.TRUE.equals(inputs.get(AutoApplyGate.INPUT_CANCELLATION_CONFIRMED))));
    }

    @Test
    @DisplayName("V2 : gate AUTO_NOTIFY -> remboursement auto via le pipeline (liberation de hold, zero debit)")
    void gateAllowsAuto_autoRefundViaPipeline() {
        Reservation cancelled = reservation();
        cancelled.setStatus("cancelled");
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD)));
        when(issueRepository.existsByOrganizationIdAndPropertyIdAndStatusIn(
                eq(ORG_ID), eq(PROPERTY_ID), any())).thenReturn(false);
        when(autoApplyGate.decide(eq(ORG_ID), eq("fin"), eq(SupervisionActionType.DEPOSIT_REFUND), any()))
                .thenReturn(AutoApplyGate.AutoDecision.AUTO_NOTIFY);
        when(suggestionService.recordActionableForAutoApply(eq(ORG_ID), eq(PROPERTY_ID), eq("fin"),
                eq(RESERVATION_ID), anyString(), anyString(), eq(SupervisionActionType.DEPOSIT_REFUND),
                anyString(), eq(35000L), eq("warning")))
                .thenReturn(Optional.of(55L));

        ExecutionResult result = executor.execute(rule(), ctx(cancelled));

        assertThat(result.skipped()).isFalse();
        verify(autoApplyService).autoApply(eq(AutoApplyGate.AutoDecision.AUTO_NOTIFY), eq(ORG_ID),
                eq(PROPERTY_ID), eq("fin"), eq(55L), contains("350.00 EUR"), anyString(), eq(35000L));
        verify(suggestionService, org.mockito.Mockito.never()).recordActionableStrict(
                anyLong(), anyLong(), anyString(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    @DisplayName("suggestion identique deja en attente -> SKIPPED (deduplication)")
    void duplicatePending_skips() {
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD)));
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), anyLong(),
                anyString(), anyString(), anyString(), anyString(), anyLong(), anyString()))
                .thenReturn(false);

        ExecutionResult result = executor.execute(rule(), ctx(reservation()));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("deja en attente");
    }

    @Test
    @DisplayName("echec de persistance de la suggestion -> exception propagee (statut FAILED moteur)")
    void persistenceFailure_propagates() {
        when(depositRepository.findByOrganizationIdAndReservationId(ORG_ID, RESERVATION_ID))
                .thenReturn(Optional.of(deposit(SecurityDepositStatus.HELD)));
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), anyLong(),
                anyString(), anyString(), anyString(), anyString(), anyLong(), anyString()))
                .thenThrow(new RuntimeException("DB down"));

        assertThatThrownBy(() -> executor.execute(rule(), ctx(reservation())))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("DB down");
    }
}
