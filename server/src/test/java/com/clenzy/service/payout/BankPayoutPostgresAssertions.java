package com.clenzy.service.payout;

import com.clenzy.model.BankPayoutObservation;
import com.clenzy.model.PayoutTransfer;
import com.clenzy.repository.BankPayoutObservationRepository;
import org.hibernate.cfg.Configuration;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.*;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

/** Exerce la migration 0497 dans le même schéma jetable que le journal de transferts. */
final class BankPayoutPostgresAssertions {
    static void verify(String url,String user,String role) throws Exception {
        try(var sessions=new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(BankPayoutObservation.class)
                .setProperty("hibernate.connection.url",url).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();
            var em=sessions.createEntityManager()) {
            var repository=new JpaRepositoryFactory(em).getRepository(BankPayoutObservationRepository.class);
            em.getTransaction().begin();
            Long id=em.createQuery("select t.id from PayoutTransfer t where t.sourceId=31",Long.class).getSingleResult();
            // Le webhook peut arriver avant la persistance de la réponse du transfert.
            assertThat(append(repository,"evt_early","acct_owner",false,"PENDING",200,
                    "[{\"source\":\"py_owner\",\"amountMinor\":8000,\"currency\":\"eur\"}]" )).isEqualTo(1);
            assertThat(repository.findForTransfer(7L,id)).isEmpty();
            var transfer=em.find(PayoutTransfer.class,id);
            transfer.captureDestinationPayment("py_owner",false);em.flush();
            assertThat(repository.findForTransfer(7L,id)).hasSize(1);
            assertThat(repository.findForTransfer(8L,id)).isEmpty(); // Même staff en bypass : scope explicite.
            assertThat(repository.findForTransfer(7L,999999L)).isEmpty();
            assertThat(append(repository,"evt_early","acct_owner",false,"PAID",201,"[]")).isZero();
            assertThat(repository.findForTransfer(7L,id).getFirst().getStatus()).isEqualTo("PENDING");
            append(repository,"evt_paid","acct_owner",false,"PAID",220,"[]");
            append(repository,"evt_failed","acct_owner",false,"FAILED",230,"[]");
            append(repository,"evt_late_paid","acct_owner",false,"PAID",210,"[]");
            var matched=repository.findForTransfer(7L,id);
            assertThat(matched).hasSize(1);
            assertThat(matched.getFirst().getStatus()).isEqualTo("FAILED");
            assertThat(matched.getFirst().getEventCreated()).isEqualTo(Instant.ofEpochSecond(230));
            // Les JSONB se chargent également via le mapping Hibernate réel.
            assertThat(repository.findAll()).hasSize(4);
            em.getTransaction().commit();
        }
        try(Connection c=DriverManager.getConnection(url,user,"");Statement s=c.createStatement()) {
            forbidden(s,"UPDATE payout_transfers SET destination_payment='py_replaced' WHERE source_id=31","23514");
            forbidden(s,"UPDATE stripe_bank_payout_events SET status='PAID'","23514");
            forbidden(s,"DELETE FROM stripe_bank_payout_events","23514");
            s.execute("SET ROLE " + role);s.execute("SET app.current_org='7'");s.execute("SET app.bypass_rls='off'");
            try(var rows=s.executeQuery("SELECT count(*) FROM stripe_bank_payout_events")) { rows.next();assertThat(rows.getLong(1)).isZero(); }
            forbidden(s,"INSERT INTO stripe_bank_payout_events(event_id,account_id,payout_id,livemode,status,payout_created,event_created,sources) VALUES('evt_forged','acct_owner','po_bank',false,'PAID',now(),now(),'[]')","42501");
        }
        try(var sessions=new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(BankPayoutObservation.class)
                .setProperty("hibernate.connection.url",url).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();var em=sessions.createEntityManager()) {
            em.getTransaction().begin();
            var repository=new JpaRepositoryFactory(em).getRepository(BankPayoutObservationRepository.class);
            Long id=em.createQuery("select t.id from PayoutTransfer t where t.sourceId=31",Long.class).getSingleResult();
            // Les preuves d'autres comptes, modes, montants ou devises n'ajoutent aucun virement.
            append(repository,"evt_wrong_account","acct_other",false,"PAID",300,"[{\"source\":\"py_owner\",\"amountMinor\":8000,\"currency\":\"eur\"}]");
            append(repository,"evt_live","acct_owner",true,"PAID",300,"[{\"source\":\"py_owner\",\"amountMinor\":8000,\"currency\":\"eur\"}]");
            append(repository,"evt_amount","acct_owner",false,"PAID",300,"[{\"source\":\"py_owner\",\"amountMinor\":7999,\"currency\":\"eur\"}]");
            append(repository,"evt_currency","acct_owner",false,"PAID",300,"[{\"source\":\"py_owner\",\"amountMinor\":8000,\"currency\":\"usd\"}]");
            assertThat(repository.findForTransfer(7L,id)).hasSize(1);
            assertThat(repository.findForTransfer(7L,id).getFirst().getStatus()).isEqualTo("FAILED");
            em.getTransaction().commit();
        }
    }
    private static int append(BankPayoutObservationRepository repository,String event,String account,boolean live,
            String status,long created,String sources) {
        // Tous les événements légitimes concernent le même virement ; les cas invalides, un autre.
        String payout=created==300 ? "po_unrelated" : "po_bank";
        return repository.append(event,account,payout,live,status,Instant.ofEpochSecond(100),Instant.ofEpochSecond(created),
                Instant.ofEpochSecond(400),"FAILED".equals(status) ? "account_closed" : null,sources);
    }
    private static void forbidden(Statement s,String sql,String state) {
        assertThatThrownBy(() -> s.execute(sql)).isInstanceOf(SQLException.class)
                .extracting(e -> ((SQLException)e).getSQLState()).isEqualTo(state);
    }
}
