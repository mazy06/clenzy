package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.hibernate.cfg.Configuration;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.*;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;

/** Vraies écritures JPA dans un schéma jetable : audit, rollback, idempotence et RLS. */
final class PayoutReconciliationPostgresAssertions {
    static void verify(String url,String user,String role) throws Exception {
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {
            s.execute("ALTER TABLE housekeeper_payout_records ADD COLUMN commission_amount numeric(10,2) NOT NULL DEFAULT 0, ADD COLUMN failure_reason varchar(255), ADD COLUMN updated_at timestamp");
            s.execute("INSERT INTO interventions(id,organization_id) VALUES(1000,7)");
            s.execute("INSERT INTO housekeeper_payout_records(id,organization_id,intervention_id,beneficiary_organization_id,amount,status,created_at) VALUES(1000,7,1000,9,80,'FAILED',now())");
        }
        var instruction=new PayoutTransferInstruction(7L,PayoutTransfer.Source.INTERVENTION,1000L,null,9L,new BigDecimal("80"),"EUR","acct_company","Maintenance #1000");
        var receipt=PayoutReconciliationServiceTest.receipt(instruction);
        receipt.setDestinationPayment("py_reconciliation");receipt.setId("tr_reconciliation");
        var proof=PayoutTransferEvidence.from(receipt,"tr_reconciliation");
        Long id;
        try(var sessions=new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(PayoutTransferEvent.class)
                .addAnnotatedClass(HousekeeperPayoutRecord.class).addAnnotatedClass(OwnerPayout.class)
                .setProperty("hibernate.connection.url",url).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","none").buildSessionFactory();var em=sessions.createEntityManager()) {
            var factory=new JpaRepositoryFactory(em);
            var transfers=factory.getRepository(PayoutTransferRepository.class);
            var events=factory.getRepository(PayoutTransferEventRepository.class);
            var owners=factory.getRepository(OwnerPayoutRepository.class);
            var providers=factory.getRepository(HousekeeperPayoutRecordRepository.class);
            var writer=new PayoutReconciliationWriter(transfers,events,owners,providers,org.mockito.Mockito.mock(BaitlyOwnerPayoutDocuments.class), org.mockito.Mockito.mock(BaitlyExpensePayoutStore.class));
            em.getTransaction().begin();
            transfers.insertIfAbsent(7L,"INTERVENTION",1000L,null,9L,instruction.amount(),"EUR","acct_company",instruction.description(),instruction.idempotencyKey());
            var row=transfers.lockBySource(7L,instruction.source(),1000L).orElseThrow();id=row.getId();row.requireReconciliation();
            em.getTransaction().commit();em.clear();
            em.getTransaction().begin();
            assertThat(transfers.lockByIdAndOrganizationId(id,8L)).isEmpty();
            assertThatThrownBy(() -> writer.confirm(7L,id,proof," ")).isInstanceOf(IllegalArgumentException.class);
            em.getTransaction().rollback();em.clear();
            assertThat(transfers.findByIdAndOrganizationId(id,7L).orElseThrow().getState()).isEqualTo(PayoutTransfer.State.RECONCILIATION_REQUIRED);
            assertThat(providers.findByInterventionId(1000L).orElseThrow().getStatus()).isEqualTo(HousekeeperPayoutRecord.Status.FAILED);
            em.clear();em.getTransaction().begin();
            writer.confirm(7L,id,proof,"staff-subject");em.getTransaction().commit();em.clear();
            em.getTransaction().begin();writer.confirm(7L,id,proof,"second-click");em.getTransaction().commit();em.clear();
            var audit=events.findByOrganizationIdAndTransferIdOrderByIdAsc(7L,id);
            assertThat(audit).hasSize(1);assertThat(audit.getFirst().getActorSubject()).isEqualTo("staff-subject");
            assertThat(providers.findByInterventionId(1000L).orElseThrow().getStatus()).isEqualTo(HousekeeperPayoutRecord.Status.SENT);
            var query=new PayoutTransferQueryService(transfers,events,org.mockito.Mockito.mock(BankPayoutObservationRepository.class),
                    org.mockito.Mockito.mock(UserRepository.class),org.mockito.Mockito.mock(OrganizationRepository.class), org.mockito.Mockito.mock(com.clenzy.repository.BaitlyTransferRecoveryRepository.class));
            assertThat(query.list(7L,0,12,PayoutTransfer.State.TRANSFERRED,PayoutTransfer.Source.INTERVENTION,"Maintenance #1000").getTotalElements()).isEqualTo(1);
            assertThat(query.list(8L,0,12,null,null,"Maintenance #1000").getTotalElements()).isZero();
            assertThat(query.list(7L,0,12,null,null,"%").getTotalElements()).isZero();
        }
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {
            forbidden(s,"UPDATE payout_transfer_events SET actor_subject='other' WHERE origin='RECONCILIATION'","23514");
            forbidden(s,"INSERT INTO payout_transfer_events(organization_id,transfer_id,state,external_reference,origin,actor_subject) VALUES(7,"+id+",'TRANSFERRED','tr_reconciliation','RECONCILIATION','other')","23505");
            s.execute("SET ROLE "+role);s.execute("SET app.current_org='8'");s.execute("SET app.bypass_rls='off'");
            try(var result=s.executeQuery("SELECT count(*) FROM payout_transfer_events WHERE origin='RECONCILIATION'")) { result.next();assertThat(result.getInt(1)).isZero(); }
        }
    }
    private static void forbidden(Statement s,String sql,String state) {
        assertThatThrownBy(() -> s.execute(sql)).isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo(state);
    }
}
