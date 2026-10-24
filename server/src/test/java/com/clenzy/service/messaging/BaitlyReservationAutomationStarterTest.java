package com.clenzy.service.messaging;

import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BaitlyReservationAutomationStarterTest {
    JdbcTemplate db;
    TransactionTemplate tx;
    AutomationEvaluationService engine;
    BaitlyReservationAutomationStarter starter;
    @BeforeEach void setup() {
        var source=new JdbcDataSource();source.setURL("jdbc:h2:mem:starter"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1");
        db=new JdbcTemplate(source);var manager=new DataSourceTransactionManager(source);tx=new TransactionTemplate(manager);
        db.execute("CREATE TABLE stays(id BIGINT PRIMARY KEY,org BIGINT,status VARCHAR(30))");
        db.execute("CREATE TABLE queue(stay BIGINT REFERENCES stays(id))");
        var stays=mock(ReservationRepository.class);engine=mock(AutomationEvaluationService.class);
        when(stays.findById(anyLong())).thenAnswer(c -> db.query("SELECT * FROM stays WHERE id=?",(rs,n)->{
            var stay=new Reservation();stay.setId(rs.getLong(1));stay.setOrganizationId(rs.getLong(2));stay.setStatus(rs.getString(3));return stay;
        },c.getArgument(0,Long.class)).stream().findFirst());
        doAnswer(c -> {db.update("INSERT INTO queue VALUES (?)",c.getArgument(0,Reservation.class).getId());return null;})
            .when(engine).onReservationCreated(any(),eq(2L));
        starter=new BaitlyReservationAutomationStarter(stays,engine,manager);
    }
    void insert() {db.update("INSERT INTO stays VALUES (550,2,'confirmed')");}
    int count(String table) {return db.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class);}
    @Test void bookingAndQueueCommitTogether() {
        tx.executeWithoutResult(s -> {insert();starter.schedule(550L,2L);assertThat(count("queue")).isOne();});
        assertThat(count("stays")).isOne();assertThat(count("queue")).isOne();
    }
    @Test void rollbackCannotLeaveAnOrphanQueueOrSend() {
        tx.executeWithoutResult(s -> {insert();starter.schedule(550L,2L);s.setRollbackOnly();});
        assertThat(count("stays")).isZero();assertThat(count("queue")).isZero();
    }
    @Test void failedAdmissionCannotCommitBookingWithoutQueue() {
        doThrow(new IllegalStateException("QUEUE_UNAVAILABLE")).when(engine).onReservationCreated(any(),eq(2L));
        assertThatThrownBy(()->tx.executeWithoutResult(s->{insert();starter.schedule(550L,2L);})).hasMessage("QUEUE_UNAVAILABLE");
        assertThat(count("stays")).isZero();
    }
    @Test void wrongOrganizationCannotQueueActions() {
        tx.executeWithoutResult(s->{insert();starter.schedule(550L,99L);assertThat(count("queue")).isZero();});
        verifyNoInteractions(engine);
    }
    @Test void cancelledStayCannotQueueActions() {
        tx.executeWithoutResult(s->{insert();db.update("UPDATE stays SET status='cancelled'");starter.schedule(550L,2L);assertThat(count("queue")).isZero();});
        verifyNoInteractions(engine);
    }
}
