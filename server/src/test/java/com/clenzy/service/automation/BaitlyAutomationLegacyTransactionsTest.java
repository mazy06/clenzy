package com.clenzy.service.automation;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.access.AccessCodeResolverService;
import com.clenzy.service.access.AccessCodeResult;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.maps.BaitlyStaticMapService;
import com.clenzy.service.messaging.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Actual Spring transaction proxies and SQL commits, on H2 locally / PostgreSQL in CI.
 * Provider calls are synthetic; no recipient, credential or remote endpoint is used. */
class BaitlyAutomationLegacyTransactionsTest extends BaitlyAutomationFixture {
    private static final String PRIVATE_DIAGNOSTIC = "synthetic-private-provider-data";
    private MessageChannel channel;
    private GuestMessageLogRepository logs;
    private GuestMessagingService messaging;
    private CheckInInstructionsRepository instructions;
    private EmailService email;
    private OwnerStatementService statements;
    private AtomicInteger sends;

    @BeforeEach void deliverySetup() {
        db.execute("CREATE TABLE baitly_delivery_fixture(id BIGINT PRIMARY KEY, status VARCHAR(30), diagnostic VARCHAR(100))");
        sends = new AtomicInteger();
        Property property = new Property(); property.setId(20L); property.setOrganizationId(7L);
        Guest guest = new Guest(); guest.setOrganizationId(7L); guest.setEmail("recipe@example.invalid"); guest.setLanguage("fr");
        stay.setProperty(property); stay.setGuest(guest);
        queue();
        db.update("UPDATE automation_executions SET durable_context=? WHERE id=11",
            codec.encode(7L, "RESERVATION", 100L, Map.of("_baitlyProperty", "20", "_baitlyGuest", "null", "_baitlyGuestVersion", "null")));
        MessageTemplate template = new MessageTemplate(); template.setId(30L); template.setOrganizationId(7L);
        channel = mock(MessageChannel.class);
        when(channel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
        when(channel.isAvailable()).thenReturn(true);
        when(channel.send(any())).thenAnswer(call -> {
            assertOutsideTransaction();
            assertThat(observer.queryForObject("SELECT status FROM baitly_delivery_fixture WHERE id=1", String.class))
                .isEqualTo("PENDING"); // the intention is visible from a separate connection
            sends.incrementAndGet();
            return MessageDeliveryResult.success("synthetic-reference");
        });
        logs = mock(GuestMessageLogRepository.class);
        when(logs.save(any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            GuestMessageLog entry = call.getArgument(0);
            if (entry.getId() == null) {
                entry.setId(1L);
                db.update("INSERT INTO baitly_delivery_fixture VALUES (1,?,?)", entry.getStatus().name(), entry.getErrorMessage());
            } else db.update("UPDATE baitly_delivery_fixture SET status=?,diagnostic=? WHERE id=1",
                entry.getStatus().name(), entry.getErrorMessage());
            return entry;
        });
        when(logs.findById(1L)).thenAnswer(call -> {
            GuestMessageLog entry = new GuestMessageLog(); entry.setId(1L);
            entry.setStatus(MessageStatus.valueOf(db.queryForObject("SELECT status FROM baitly_delivery_fixture WHERE id=1", String.class)));
            return Optional.of(entry);
        });
        instructions = mock(CheckInInstructionsRepository.class);
        when(instructions.findByPropertyIdAndOrganizationId(20L, 7L)).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isTrue();
            return Optional.empty();
        });
        var interpolation = mock(TemplateInterpolationService.class);
        when(interpolation.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any())).thenAnswer(call -> {
            assertOutsideTransaction();
            return new TemplateInterpolationService.InterpolatedMessage("Synthetic", "Synthetic", "Synthetic");
        });
        var access = mock(AccessCodeResolverService.class);
        when(access.resolveForReservation(any(), any(), any())).thenAnswer(call -> {
            assertOutsideTransaction(); return AccessCodeResult.manual();
        });
        var templates = mock(MessageTemplateRepository.class);
        when(templates.findByIdAndOrganizationId(30L, 7L)).thenReturn(Optional.of(template));
        messaging = proxy(new GuestMessagingService(List.of(channel), interpolation, logs,
            proxy(new GuestMessageAttemptLog(logs)), instructions, templates, reservations,
            mock(NotificationService.class), access, mock(BaitlyStaticMapService.class), mock(WelcomeGuideService.class), manager));
        when(executor.execute(any(), any())).thenAnswer(call -> {
            GuestMessageLog result = messaging.sendForReservationViaChannel(stay, template, 7L, MessageChannelType.EMAIL, Map.of());
            if (result.getStatus() != MessageStatus.SENT) throw new IllegalStateException("AUTOMATION_DELIVERY_UNCONFIRMED");
            return AutomationActionExecutor.ExecutionResult.executed(result.getId());
        });

        var owners = mock(UserRepository.class);
        User owner = new User(); owner.setId(40L); owner.setEmail("owner@example.invalid");
        when(owners.findById(40L)).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isTrue();
            return Optional.of(owner);
        });
        var payouts = mock(OwnerPayoutRepository.class);
        when(payouts.findByOwnerId(40L, 7L)).thenReturn(List.of());
        email = mock(EmailService.class);
        doAnswer(call -> { assertOutsideTransaction(); sends.incrementAndGet(); return null; })
            .when(email).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        statements = proxy(new OwnerStatementService(payouts, owners, email, mock(ProviderExpenseRepository.class),
            mock(PropertyRepository.class), mock(SupervisionActivityService.class), manager));
    }

    @SuppressWarnings("unchecked") private <T> T proxy(T target) {
        ProxyFactory factory = new ProxyFactory(target); factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        return (T) factory.getProxy();
    }

    private void assertOutsideTransaction() {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(TransactionSynchronizationManager.hasResource(source)).isFalse();
    }

    private void statement() {
        statements.sendStatement(40L, 7L, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), "Baitly recipe");
    }

    @Test void guestDeliveryCommitsIntentionBeforeProviderAndOutcomeAfterwards() {
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("DONE"); assertThat(sends.get()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT status FROM baitly_delivery_fixture", String.class)).isEqualTo("SENT");
    }

    @Test void guestDeliverySuspendsAndRestoresAnExistingCallerTransaction() {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            messaging.sendMessage(100L, 30L, 7L);
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            status.setRollbackOnly();
        });
        assertThat(db.queryForObject("SELECT status FROM baitly_delivery_fixture", String.class)).isEqualTo("SENT");
    }

    @Test void guestThrownOutcomeRemainsPendingAndCannotReplay() {
        doAnswer(call -> {
            assertOutsideTransaction(); sends.incrementAndGet(); throw new IllegalStateException(PRIVATE_DIAGNOSTIC);
        }).when(channel).send(any());
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("UNKNOWN"); assertThat(sends.get()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT status FROM baitly_delivery_fixture", String.class)).isEqualTo("PENDING");
        assertThat(db.queryForObject("SELECT diagnostic FROM baitly_delivery_fixture", String.class)).isEqualTo("DELIVERY_UNCONFIRMED");
    }

    @Test void guestLegacyFailureResultDoesNotReleasePendingFence() {
        doAnswer(call -> {
            assertOutsideTransaction(); sends.incrementAndGet(); return MessageDeliveryResult.failure(PRIVATE_DIAGNOSTIC);
        }).when(channel).send(any());
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("UNKNOWN"); assertThat(sends.get()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT status FROM baitly_delivery_fixture", String.class)).isEqualTo("PENDING");
        assertThat(db.queryForObject("SELECT diagnostic FROM baitly_delivery_fixture", String.class)).isEqualTo("DELIVERY_UNCONFIRMED");
    }

    @Test void guestMissingReturnDoesNotProduceSuccessProof() {
        doAnswer(call -> { sends.incrementAndGet(); return null; }).when(channel).send(any());
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("UNKNOWN"); assertThat(sends.get()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT status FROM baitly_delivery_fixture", String.class)).isEqualTo("PENDING");
    }

    @Test void guestOutcomeWriteFailureRollsBackOnlyOutcomeAndDoesNotReplay() {
        doAnswer(call -> {
            GuestMessageLog entry = call.getArgument(0);
            if (entry.getId() == null) {
                entry.setId(1L); db.update("INSERT INTO baitly_delivery_fixture VALUES (1,'PENDING',NULL)"); return entry;
            }
            db.update("UPDATE baitly_delivery_fixture SET status='SENT'");
            throw new IllegalStateException(PRIVATE_DIAGNOSTIC);
        }).when(logs).save(any());
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("UNKNOWN"); assertThat(sends.get()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT status FROM baitly_delivery_fixture", String.class)).isEqualTo("PENDING");
    }

    @Test void guestPreparationFailureDoesNotInvokeProvider() {
        doThrow(new IllegalStateException("PREPARATION_FAILED")).when(instructions).findByPropertyIdAndOrganizationId(20L, 7L);
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        verify(channel, never()).send(any()); assertThat(state()).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_delivery_fixture", Integer.class)).isZero();
    }

    @Test void guestIntentionWriteFailurePreventsProviderAndRollsBackPartialWrite() {
        doAnswer(call -> {
            db.update("INSERT INTO baitly_delivery_fixture VALUES (1,'PENDING',NULL)");
            throw new IllegalStateException("SYNTHETIC_STORAGE_FAILURE");
        }).when(logs).save(any());
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        verify(channel, never()).send(any()); assertThat(state()).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_delivery_fixture", Integer.class)).isZero();
    }

    @Test void guestForeignOrganizationCannotSend() {
        stay.setOrganizationId(8L);
        assertThatThrownBy(() -> messaging.sendMessage(100L, 30L, 7L))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(channel, never()).send(any());
    }

    @Test void guestProviderFailureIsNotExposedToCaller() {
        doThrow(new IllegalStateException(PRIVATE_DIAGNOSTIC)).when(channel).send(any());
        assertThatThrownBy(() -> messaging.sendMessage(100L, 30L, 7L))
            .hasMessage("AUTOMATION_DELIVERY_UNCONFIRMED").hasNoCause();
    }

    @Test void missingDeliveryJournalCannotConfirmSuccess() {
        assertThatThrownBy(() -> proxy(new GuestMessageAttemptLog(logs)).complete(999L, MessageStatus.SENT, null))
            .hasMessage("DELIVERY_JOURNAL_MISSING");
    }

    @Test void ownerStatementPreparesInTransactionAndSendsOutside() {
        statement(); assertThat(sends.get()).isEqualTo(1);
    }

    @Test void ownerStatementPreparationFailureDoesNotSend() {
        assertThatThrownBy(() -> statements.sendStatement(41L, 7L,
            LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), "Baitly recipe"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(email, never()).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
    }

    @Test void ownerStatementSuspendsAndRestoresCallerEvenOnRollback() {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            statement(); assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue(); status.setRollbackOnly();
        });
        assertThat(sends.get()).isEqualTo(1);
    }

    @Test void ownerStatementFailureKeepsAutomationUncertainWithoutReplayOrRawCause() {
        doThrow(new IllegalStateException(PRIVATE_DIAGNOSTIC)).when(email).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        doAnswer(call -> { statement(); return AutomationActionExecutor.ExecutionResult.executed(); }).when(executor).execute(any(), any());
        worker(journal).processScheduledExecutions(); worker(journal).processScheduledExecutions();
        assertThat(state()).isEqualTo("UNKNOWN");
        verify(email, times(1)).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        assertThat(db.queryForObject("SELECT error_message FROM automation_executions WHERE id=11", String.class))
            .doesNotContain(PRIVATE_DIAGNOSTIC);
    }

    @Test void ownerStatementProviderFailureIsNotExposedToCaller() {
        doThrow(new IllegalStateException(PRIVATE_DIAGNOSTIC)).when(email).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        assertThatThrownBy(this::statement).hasMessage("OWNER_STATEMENT_DELIVERY_UNCONFIRMED").hasNoCause();
    }
}
