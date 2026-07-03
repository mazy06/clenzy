package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Organization;
import com.clenzy.model.OwnerStatementDispatch;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerStatementDispatchRepository;
import com.clenzy.service.OwnerStatementService;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SendOwnerStatementExecutor (F9a releve mensuel)")
class SendOwnerStatementExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long OWNER_ID = 100L;
    private static final LocalDate FROM = LocalDate.of(2026, 6, 1);
    private static final LocalDate TO = LocalDate.of(2026, 6, 30);

    @Mock private OwnerStatementDispatchRepository dispatchRepository;
    @Mock private OwnerStatementService ownerStatementService;
    @Mock private OrganizationRepository organizationRepository;

    private SendOwnerStatementExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new SendOwnerStatementExecutor(dispatchRepository, ownerStatementService,
                organizationRepository);
    }

    private static AutomationRule rule() {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(ORG_ID);
        rule.setName("releve mensuel");
        return rule;
    }

    private static AutomationActionContext ctxWithPeriod() {
        return new AutomationActionContext(ORG_ID, SendOwnerStatementExecutor.SUBJECT_OWNER, OWNER_ID,
                Map.of(SendOwnerStatementExecutor.DATA_PERIOD_START, FROM.toString(),
                       SendOwnerStatementExecutor.DATA_PERIOD_END, TO.toString()));
    }

    @Test
    @DisplayName("action() -> SEND_OWNER_STATEMENT")
    void actionType() {
        assertThat(executor.action()).isEqualTo(AutomationAction.SEND_OWNER_STATEMENT);
    }

    @Test
    @DisplayName("sujet inattendu -> echec explicite")
    void wrongSubjectType_throws() {
        AutomationActionContext ctx = new AutomationActionContext(ORG_ID, "PAYOUT", 5L, Map.of());

        assertThatThrownBy(() -> executor.execute(rule(), ctx))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("OWNER");
        verifyNoInteractions(ownerStatementService);
    }

    @Test
    @DisplayName("idempotence : mois deja traite -> SKIPPED, aucun envoi")
    void alreadyDispatched_skips() {
        when(dispatchRepository.existsByOrganizationIdAndOwnerIdAndPeriodStart(ORG_ID, OWNER_ID, FROM))
                .thenReturn(true);

        ExecutionResult result = executor.execute(rule(), ctxWithPeriod());

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(ownerStatementService);
        verify(dispatchRepository, times(0)).save(any());
    }

    @Test
    @DisplayName("dernier filet : claim pose hors verrou (contrainte unique) -> SKIPPED, aucun envoi")
    void concurrentClaim_skips() {
        when(dispatchRepository.existsByOrganizationIdAndOwnerIdAndPeriodStart(ORG_ID, OWNER_ID, FROM))
                .thenReturn(false);
        when(dispatchRepository.save(any(OwnerStatementDispatch.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        ExecutionResult result = executor.execute(rule(), ctxWithPeriod());

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(ownerStatementService);
    }

    @Test
    @DisplayName("cas nominal : claim -> envoi de la periode du sujet -> success=true")
    void sendsStatementAndMarksSuccess() {
        when(dispatchRepository.existsByOrganizationIdAndOwnerIdAndPeriodStart(ORG_ID, OWNER_ID, FROM))
                .thenReturn(false);
        when(dispatchRepository.save(any(OwnerStatementDispatch.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        Organization organization = new Organization();
        organization.setName("Conciergerie Sud");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(organization));

        ExecutionResult result = executor.execute(rule(), ctxWithPeriod());

        assertThat(result.skipped()).isFalse();
        // Le verrou advisory serialise les claims concurrents AVANT le check d'existence.
        InOrder inOrder = inOrder(dispatchRepository);
        inOrder.verify(dispatchRepository)
                .acquireDispatchClaimLock("OWNER_STATEMENT:1:100:" + FROM);
        inOrder.verify(dispatchRepository)
                .existsByOrganizationIdAndOwnerIdAndPeriodStart(ORG_ID, OWNER_ID, FROM);
        verify(ownerStatementService).sendStatement(OWNER_ID, ORG_ID, FROM, TO, "Conciergerie Sud");

        ArgumentCaptor<OwnerStatementDispatch> captor = ArgumentCaptor.forClass(OwnerStatementDispatch.class);
        verify(dispatchRepository, times(2)).save(captor.capture());
        OwnerStatementDispatch claimed = captor.getAllValues().get(0);
        assertThat(claimed.getPeriodStart()).isEqualTo(FROM);
        assertThat(claimed.getPeriodEnd()).isEqualTo(TO);
        assertThat(captor.getAllValues().get(1).isSuccess()).isTrue();
    }

    @Test
    @DisplayName("periode absente du sujet -> repli sur le mois civil precedent (Europe/Paris)")
    void missingPeriod_fallsBackToPreviousMonth() {
        LocalDate expectedFrom = LocalDate.now(SendOwnerStatementExecutor.STATEMENT_ZONE)
                .minusMonths(1).withDayOfMonth(1);
        LocalDate expectedTo = expectedFrom.plusMonths(1).minusDays(1);
        when(dispatchRepository.existsByOrganizationIdAndOwnerIdAndPeriodStart(ORG_ID, OWNER_ID, expectedFrom))
                .thenReturn(false);
        when(dispatchRepository.save(any(OwnerStatementDispatch.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

        executor.execute(rule(), new AutomationActionContext(
                ORG_ID, SendOwnerStatementExecutor.SUBJECT_OWNER, OWNER_ID, Map.of()));

        verify(ownerStatementService).sendStatement(
                eq(OWNER_ID), eq(ORG_ID), eq(expectedFrom), eq(expectedTo),
                org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    @DisplayName("echec d'envoi -> exception propagee, un seul save (claim), jamais success=true")
    void sendFailure_propagatesWithoutMarkingSuccess() {
        when(dispatchRepository.existsByOrganizationIdAndOwnerIdAndPeriodStart(ORG_ID, OWNER_ID, FROM))
                .thenReturn(false);
        when(dispatchRepository.save(any(OwnerStatementDispatch.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());
        doThrow(new IllegalStateException("email manquant"))
                .when(ownerStatementService).sendStatement(anyLong(), anyLong(), any(), any(), any());

        assertThatThrownBy(() -> executor.execute(rule(), ctxWithPeriod()))
                .isInstanceOf(IllegalStateException.class);

        // Un seul save : le claim. Jamais de passage a success=true.
        verify(dispatchRepository, times(1)).save(any(OwnerStatementDispatch.class));
    }
}
