package com.clenzy.service.messaging;

import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class BaitlyReservationAutomationStarterTest {
    private JdbcTemplate jdbc;
    private TransactionTemplate bookingTransaction;
    private TransactionTemplate attemptTransaction;
    private AutomationEvaluationService automations;
    private BaitlyReservationAutomationStarter starter;

    @BeforeEach
    void setUp() {
        JdbcDataSource source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:automation_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("create table stays (id bigint primary key, org bigint, status varchar(32))");
        jdbc.execute("create table attempts (stay_id bigint references stays(id))");
        jdbc.execute("create table executions (stay_id bigint references stays(id))");
        var manager = new DataSourceTransactionManager(source);
        bookingTransaction = new TransactionTemplate(manager);
        attemptTransaction = new TransactionTemplate(manager);
        attemptTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        ReservationRepository reservations = mock(ReservationRepository.class);
        when(reservations.findById(any())).thenAnswer(call -> jdbc.query(
                "select * from stays where id = ?", (row, index) -> {
                    Reservation stay = new Reservation();
                    stay.setId(row.getLong("id"));
                    stay.setOrganizationId(row.getLong("org"));
                    stay.setStatus(row.getString("status"));
                    return stay;
                }, call.getArgument(0, Long.class)).stream().findFirst());
        automations = mock(AutomationEvaluationService.class);
        starter = new BaitlyReservationAutomationStarter(reservations, automations, manager);
        doAnswer(call -> {
            Reservation stay = call.getArgument(0);
            // The message attempt uses its own transaction, as GuestMessageAttemptLog does.
            attemptTransaction.executeWithoutResult(tx ->
                    jdbc.update("insert into attempts values (?)", stay.getId()));
            jdbc.update("insert into executions values (?)", stay.getId());
            return null;
        }).when(automations).onReservationCreated(any(), eq(2L));
    }

    @Test
    void independentMessageJournalSeesCommittedBookingAndExecutionIsDurable() {
        bookingTransaction.executeWithoutResult(tx -> {
            insertStay();
            starter.schedule(550L, 2L);
            verifyNoInteractions(automations);
            assertThat(count("attempts")).isZero();
        });
        verify(automations).onReservationCreated(any(), eq(2L));
        assertThat(count("stays")).isOne();
        assertThat(count("attempts")).isOne();
        assertThat(count("executions")).isOne();
    }

    @Test
    void rolledBackBookingNeverStartsExternalActions() {
        bookingTransaction.executeWithoutResult(tx -> {
            insertStay();
            starter.schedule(550L, 2L);
            tx.setRollbackOnly();
        });
        verifyNoInteractions(automations);
        assertThat(count("stays")).isZero();
        assertThat(count("attempts")).isZero();
    }

    @Test
    void automationFailureDoesNotUndoBookingOrReportCreationFailure() {
        doAnswer(call -> {
            jdbc.update("insert into executions values (550)");
            throw new IllegalStateException("Simulated provider failure");
        }).when(automations).onReservationCreated(any(), eq(2L));
        bookingTransaction.executeWithoutResult(tx -> {
            insertStay();
            starter.schedule(550L, 2L);
        });
        verify(automations).onReservationCreated(any(), eq(2L));
        assertThat(count("stays")).isOne();
        assertThat(count("executions")).isZero();
    }

    @Test
    void wrongOrganizationCannotStartActions() {
        bookingTransaction.executeWithoutResult(tx -> {
            insertStay();
            starter.schedule(550L, 99L);
        });
        verifyNoInteractions(automations);
    }

    @Test
    void reloadsFinalStateInsteadOfSendingForCancelledStay() {
        bookingTransaction.executeWithoutResult(tx -> {
            insertStay();
            starter.schedule(550L, 2L);
            jdbc.update("update stays set status = 'cancelled' where id = 550");
        });
        verifyNoInteractions(automations);
    }

    private void insertStay() {
        jdbc.update("insert into stays values (550, 2, 'confirmed')");
    }

    private int count(String table) {
        return jdbc.queryForObject("select count(*) from " + table, Integer.class);
    }
}
