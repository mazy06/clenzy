package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vrais verrous SQL : une caution ne peut être capturée et libérée simultanément. */
class BaitlyDepositOperationPersistenceTest {
    static SessionFactory factory;
    Long id;

    static String mapping() {
        var xml=new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml,Reservation.class,Set.of("organizationId","status","checkIn","checkOut","checkOutTime",
                "stripeCustomerId","stripePaymentMethodId","currency","securityDepositAmount","totalPrice"));
        RefundCreditNotePersistenceTest.mapping(xml,Property.class,Set.of("organizationId","timezone","defaultCheckOutTime","securityDepositAmount","defaultCurrency"));
        RefundCreditNotePersistenceTest.mapping(xml,Intervention.class,Set.of("organizationId","status","type","scheduledDate","completedAt"));
        RefundCreditNotePersistenceTest.mapping(xml,ServiceRequest.class,Set.of("organizationId","serviceType","reservationId"));
        xml.append("</entity-mappings>");
        return xml.toString().replace("<transient name=\"property\"/>","<many-to-one name=\"property\"/>")
                .replace("<transient name=\"serviceRequest\"/>","<many-to-one name=\"serviceRequest\"/>");
    }

    static Configuration configuration(String url) {
        return new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(SecurityDeposit.class).addAnnotatedClass(Issue.class)
                .addInputStream(new ByteArrayInputStream(mapping().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url",url)
                .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("jakarta.persistence.validation.mode","none");
    }

    @BeforeAll static void start() {
        factory=configuration("jdbc:h2:mem:baitlyDepositOperations;MODE=PostgreSQL;LOCK_TIMEOUT=5000").buildSessionFactory();
    }
    @AfterAll static void stop() {if(factory!=null)factory.close();}
    <T>T tx(Function<EntityManager,T> fn) {
        try(var em=factory.createEntityManager()) {em.getTransaction().begin();try{
            T result=fn.apply(em);em.getTransaction().commit();return result;
        }catch(RuntimeException failure){em.getTransaction().rollback();throw failure;}}
    }
    @BeforeEach void seed() {
        id=tx(em->{
            for(String entity:List.of("SecurityDeposit","Reservation")) em.createQuery("delete from "+entity).executeUpdate();
            var reservation=new Reservation();reservation.setId(9L);reservation.setOrganizationId(7L);
            reservation.setCheckIn(LocalDate.of(2026,10,10));reservation.setCheckOut(LocalDate.of(2026,10,17));em.persist(reservation);
            var deposit=new SecurityDeposit();deposit.setOrganizationId(7L);deposit.setReservationId(9L);
            deposit.setAmount(new BigDecimal("300"));deposit.setCurrency("EUR");deposit.setStatus(SecurityDepositStatus.HELD);
            deposit.setExternalRef("pi_held");em.persist(deposit);return deposit.getId();
        });
    }
    BaitlyDepositOperationStore store(EntityManager em,boolean eligible) {
        var reservations=mock(ReservationRepository.class);
        when(reservations.findByIdWithGuestAndProperty(9L)).thenAnswer(call->Optional.ofNullable(em.find(Reservation.class,9L)));
        var policy=mock(BaitlyDepositReleasePolicy.class);when(policy.eligible(any())).thenReturn(eligible);
        return new BaitlyDepositOperationStore(new JpaRepositoryFactory(em).getRepository(SecurityDepositRepository.class),reservations,policy,em);
    }

    @Test void releaseClaimIsDurableAndOnlyConfirmationMarksItReleased() {
        var command=tx(em->store(em,true).claimRelease(id,7L).orElseThrow());
        assertThat(this.<SecurityDepositStatus>tx(em->em.find(SecurityDeposit.class,id).getStatus())).isEqualTo(SecurityDepositStatus.RELEASING);
        assertThatThrownBy(()->tx(em->store(em,true).claimCapture(id,7L,BigDecimal.TEN,"Dégât"))).isInstanceOf(IllegalStateException.class);
        tx(em->{store(em,true).released(command);return null;});
        assertThat(this.<Optional<BaitlyDepositOperationStore.Instruction>>tx(em->store(em,true).claimRelease(id,7L))).isEmpty();
        assertThat(this.<SecurityDepositStatus>tx(em->em.find(SecurityDeposit.class,id).getStatus())).isEqualTo(SecurityDepositStatus.RELEASED);
    }
    @Test void missingCleaningNeverClaimsAnAuthorization() {
        assertThat(this.<Optional<BaitlyDepositOperationStore.Instruction>>tx(em->store(em,false).claimRelease(id,7L))).isEmpty();
        assertThat(this.<SecurityDepositStatus>tx(em->em.find(SecurityDeposit.class,id).getStatus())).isEqualTo(SecurityDepositStatus.HELD);
    }
    @Test void captureResumesOnlyWithTheFrozenAmountAndNeverLooksLikeSettledMoneyBeforeStripe() {
        var command=tx(em->store(em,true).claimCapture(id,7L,BigDecimal.TEN,"Dégât"));
        assertThat(this.<BigDecimal>tx(em->em.find(SecurityDeposit.class,id).getCapturedAmount())).isNull();
        assertThatThrownBy(()->tx(em->store(em,true).claimRelease(id,7L))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->tx(em->store(em,true).claimCapture(id,7L,new BigDecimal("20"),"Dégât"))).isInstanceOf(IllegalStateException.class);
        assertThat(this.<BaitlyDepositOperationStore.Instruction>tx(em->store(em,true).claimCapture(id,7L,BigDecimal.TEN,"Dégât"))).isEqualTo(command);
        tx(em->{store(em,true).captured(command);return null;});
        assertThat(this.<BigDecimal>tx(em->em.find(SecurityDeposit.class,id).getCapturedAmount())).isEqualByComparingTo("10");
    }
    @Test void finalInstructionRejectsAnotherAuthorizationOrTenant() {
        tx(em->store(em,true).claimRelease(id,7L));
        assertThatThrownBy(()->tx(em->{store(em,true).released(new BaitlyDepositOperationStore.Instruction(id,7L,"pi_other",BigDecimal.TEN,"EUR"));return null;}))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->tx(em->store(em,true).claimRelease(id,8L))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void simultaneousCaptureWaitsForTheReleaseLockThenFailsWithoutAnExternalCall() throws Exception {
        try(var first=factory.createEntityManager();var executor=Executors.newSingleThreadExecutor()) {
            first.getTransaction().begin();store(first,true).claimRelease(id,7L);
            var entered=new CountDownLatch(1);
            var capture=executor.submit(()->{entered.countDown();return tx(em->store(em,true).claimCapture(id,7L,BigDecimal.TEN,"Dégât"));});
            assertThat(entered.await(2,TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(()->capture.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            first.getTransaction().commit();
            assertThatThrownBy(()->capture.get(5,TimeUnit.SECONDS)).hasCauseInstanceOf(IllegalStateException.class);
        }
    }
}
