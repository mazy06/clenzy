package com.clenzy.service.payout;

import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.math.BigDecimal;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vraies transactions SQL : l'incertitude ne rend pas un versement réémettable. */
class BaitlyProviderPayoutRecoveryPersistenceTest {
    static SessionFactory factory;
    final BaitlyProviderPayoutGuard guard=mock(BaitlyProviderPayoutGuard.class);
    Long id;

    @BeforeAll static void mapping() {
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(HousekeeperPayoutRecord.class)
                .setProperty("hibernate.connection.url","jdbc:h2:mem:providerpayoutrecovery;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").buildSessionFactory();
    }
    @AfterAll static void close() {if(factory!=null) factory.close();}
    @BeforeEach void seed() {
        when(guard.lockRecord(any())).thenAnswer(call -> call.getArgument(0));
        id=tx(em -> {
            em.createQuery("delete from HousekeeperPayoutRecord").executeUpdate();
            var record=new HousekeeperPayoutRecord(7L,42L,11L,new BigDecimal("95"),new BigDecimal("5"),Status.PENDING);
            em.persist(record);em.flush();return record.getId();
        });
    }
    <T>T tx(Function<EntityManager,T> action) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            try {var result=action.apply(em);em.getTransaction().commit();return result;}
            catch(RuntimeException failure) {em.getTransaction().rollback();throw failure;}
        }
    }
    HousekeeperPayoutRecorder recorder(EntityManager em) {
        return new HousekeeperPayoutRecorder(new JpaRepositoryFactory(em).getRepository(HousekeeperPayoutRecordRepository.class),
                mock(HousekeeperPayoutConfigRepository.class),mock(ProviderPayoutBeneficiaryService.class),guard);
    }
    HousekeeperPayoutRecord read() {return tx(em -> em.find(HousekeeperPayoutRecord.class,id));}

    @Test void blockedUnknownResultKeepsAmountAndCannotBeRequeued() {
        int updated=tx(em -> recorder(em).markReconciliationRequired(id));
        assertThat(updated).isEqualTo(1);
        assertThatThrownBy(() -> tx(em -> recorder(em).requeueRecord(id,Status.BLOCKED,new BigDecimal("95"),new BigDecimal("5"))))
                .hasMessageContaining("rapproché");
        var saved=read(); assertThat(saved.getStatus()).isEqualTo(Status.BLOCKED);
        assertThat(saved.getFailureReason()).isEqualTo("RECONCILIATION_REQUIRED");
        assertThat(saved.getAmount()).isEqualByComparingTo("95");
        assertThat(saved.getCommissionAmount()).isEqualByComparingTo("5");
    }
    @Test void lateFailureCannotEraseAnUncertainReservation() {
        tx(em -> recorder(em).markReconciliationRequired(id));
        int changed=tx(em -> recorder(em).markFailed(id,"token=private-canary"));
        assertThat(changed).isZero();assertThat(read().getFailureReason()).isEqualTo("RECONCILIATION_REQUIRED");
        assertThat(read().getStatus()).isEqualTo(Status.BLOCKED);
    }
    @Test void confirmedTransferSurvivesLateUncertaintyAndFailure() {
        tx(em -> recorder(em).markSent(id,"tr_synthetic"));
        tx(em -> recorder(em).markReconciliationRequired(id));
        tx(em -> recorder(em).markFailed(id,"token=private-canary"));
        var saved=read();assertThat(saved.getStatus()).isEqualTo(Status.SENT);
        assertThat(saved.getStripeTransferId()).isEqualTo("tr_synthetic");assertThat(saved.getFailureReason()).isNull();
    }
    @Test void persistedFailureUsesOnlyBoundedDiagnostics() {
        tx(em -> recorder(em).markFailed(id,"email=synthetic@example.invalid token=private-canary"));
        var saved=read();assertThat(saved.getStatus()).isEqualTo(Status.FAILED);
        assertThat(saved.getFailureReason()).isEqualTo(BaitlyPayoutDiagnostics.PREPARATION_FAILED);
    }
}
