package com.clenzy.service.payout;

import com.clenzy.model.PayoutRecoveryJob;
import com.clenzy.payment.StripeGateway;
import jakarta.persistence.EntityManager;
import org.hibernate.cfg.Configuration;
import java.sql.*;
import java.time.*;
import java.util.function.Supplier;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Migrations réelles, bail concurrent, reprise, audit atomique et alertes isolées par organisation. */
final class PayoutRecoveryPostgresAssertions {
    static void verify(String url,String user,String role) throws Exception {
        Instant now=Instant.parse("2030-01-05T12:00:00Z");
        try(var sessions=new Configuration().addAnnotatedClass(PayoutRecoveryJob.class)
                .setProperty("hibernate.connection.url",url).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();
            var em=sessions.createEntityManager();var other=sessions.createEntityManager()) {
            var store=new PayoutRecoveryStore(em);var competing=new PayoutRecoveryStore(other);
            tx(em,() -> { store.seed(); store.seed(); return null; });
            // Isoler le compte utilisé pour la preuve bancaire de ce scénario.
            tx(em,() -> em.createNativeQuery("UPDATE payout_recovery_jobs SET next_attempt_at=:later WHERE account_id <> 'acct_owner'")
                    .setParameter("later",now.plusSeconds(100000)).executeUpdate());
            em.getTransaction().begin();
            var job=store.claim(now).orElseThrow();
            assertThat(job.getAccountId()).isEqualTo("acct_owner");
            assertThat(tx(other,() -> competing.claim(now))).isEmpty(); // SKIP LOCKED avant commit.
            em.getTransaction().commit();
            assertThat(tx(other,() -> competing.claim(now))).isEmpty(); // Bail après commit.
            tx(em,() -> { store.checkpoint(job,"po_cursor",false,now);return null; });
            em.clear();
            var resumed=tx(em,() -> store.claim(now.plusSeconds(2))).orElseThrow();
            assertThat(resumed.getAfterPayoutId()).isEqualTo("po_cursor");
            assertThat(resumed.getWindowEnd()).isEqualTo(now);
            tx(em,() -> { store.failed(resumed,now.plusSeconds(3));return null; });
            em.clear();
            assertThat(tx(em,() -> store.claim(now.plusSeconds(4)))).isEmpty();
            var retry=tx(em,() -> store.claim(now.plusSeconds(400))).orElseThrow();
            assertThat(retry.getFailures()).isEqualTo(1);assertThat(retry.getAfterPayoutId()).isEqualTo("po_cursor");
            // Un ancien worker ne peut ni avancer ni remettre à zéro le bail repris.
            assertThatThrownBy(() -> tx(other,() -> { competing.checkpoint(job,"po_wrong",true,now.plusSeconds(401));return null; }))
                    .isInstanceOf(IllegalStateException.class);
            assertThat(tx(other,() -> competing.renew(job,now.plusSeconds(401)))).isFalse();
            tx(em,() -> {store.checkpoint(retry,null,true,now.plusSeconds(402));return null;});
            em.clear();
            var finished=tx(em,() -> em.find(PayoutRecoveryJob.class,retry.getId()));
            assertThat(finished.getLastCompletedAt()).isEqualTo(now.plusSeconds(402));
            assertThat(finished.getAfterPayoutId()).isNull();assertThat(finished.getWindowEnd()).isNull();
            assertThat(finished.getFailures()).isZero();assertThat(finished.getErrorCode()).isNull();
            assertThat(tx(em,() -> store.claim(now.plusSeconds(403)))).isEmpty();

            // Un virement en attente ne devient jamais payé par le watchdog.
            long stalled=tx(em,() -> ((Number)em.createNativeQuery("""
                INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,
                  destination,description,idempotency_key,state,created_at,updated_at)
                VALUES(8,'INTERVENTION',99001,42,90,'EUR','STRIPE','acct_stalled','Mission en attente','recovery-test',
                  'SUBMITTING',:created,:created) RETURNING id
                """).setParameter("created",now.minusSeconds(2000)).getSingleResult()).longValue());
            tx(em,() -> store.flagStalled(now));
            assertThat(tx(em,() -> store.flagStalled(now))).isZero();
            assertThat(tx(em,() -> em.createNativeQuery("SELECT state FROM payout_transfers WHERE id=:id").setParameter("id",stalled).getSingleResult()))
                    .isEqualTo("RECONCILIATION_REQUIRED");
            assertThat(((Number)tx(em,() -> em.createNativeQuery("SELECT count(*) FROM payout_transfer_events WHERE transfer_id=:id").setParameter("id",stalled).getSingleResult())).longValue()).isEqualTo(1);

            var stripe=mock(StripeGateway.class);when(stripe.isConfigured()).thenReturn(true);
            var monitoring=new PayoutMonitoringService(em,stripe,Clock.fixed(now,ZoneOffset.UTC),true);
            var org7=tx(em,() -> monitoring.read(7L,0));
            assertThat(org7.alerts().getContent()).noneMatch(a -> a.transferId()==stalled);
            var org8=tx(em,() -> monitoring.read(8L,0));
            assertThat(org8.alerts().getContent()).anyMatch(a -> a.transferId()==stalled && a.code().equals("RECONCILIATION_REQUIRED"));
            // Même compte, mode, montant et devise obligatoires, puis disparition après preuve PAID.
            long id=tx(em,() -> ((Number)em.createNativeQuery("""
                INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,
                  destination,description,idempotency_key,state,external_reference,destination_payment,stripe_livemode,created_at,updated_at)
                VALUES(8,'INTERVENTION',99002,42,90,'EUR','STRIPE','acct_testmonitor','Mission bancaire','recovery-bank-test',
                  'TRANSFERRED','tr_monitor','py_monitor',false,:created,:created) RETURNING id
                """).setParameter("created",now.minusSeconds(900000)).getSingleResult()).longValue());
            assertThat(tx(em,() -> monitoring.read(8L,0)).alerts().getContent()).anyMatch(a -> a.transferId()==id && a.code().equals("BANK_UNCONFIRMED"));
            tx(em,() -> em.createNativeQuery("""
                INSERT INTO stripe_bank_payout_events(event_id,account_id,payout_id,livemode,status,payout_created,event_created,arrival_date,sources)
                VALUES('evt_monitor','acct_testmonitor','po_monitor',false,'PENDING',:now,:now,:arrival,
                  '[{"source":"py_monitor","amountMinor":9000,"currency":"eur"}]')
                """).setParameter("now",now).setParameter("arrival",now.minusSeconds(200000)).executeUpdate());
            assertThat(tx(em,() -> monitoring.read(8L,0)).alerts().getContent()).anyMatch(a -> a.transferId()==id && a.code().equals("BANK_LATE"));
            tx(em,() -> em.createNativeQuery("""
                INSERT INTO stripe_bank_payout_events(event_id,account_id,payout_id,livemode,status,payout_created,event_created,sources)
                VALUES('evt_monitor_paid','acct_testmonitor','po_monitor',false,'PAID',:now,:now,'[]')
                """).setParameter("now",now).executeUpdate());
            var disabled=new PayoutMonitoringService(em,stripe,Clock.fixed(now,ZoneOffset.UTC),false);
            assertThat(tx(em,() -> disabled.read(8L,0)).alerts().getContent()).noneMatch(a -> a.transferId()==id);
            assertThat(tx(em,() -> monitoring.read(8L,0)).alerts().getContent()).anyMatch(a -> a.transferId()==id && a.code().equals("RECOVERY_LATE"));
            assertFundingIncidents(em, disabled, id);
            assertThatThrownBy(() -> monitoring.read(null,0)).isInstanceOf(IllegalArgumentException.class);
        }
        try(Connection c=DriverManager.getConnection(url,user,"");Statement s=c.createStatement()) {
            s.execute("SET ROLE "+role);s.execute("SET app.bypass_rls='off'");s.execute("SET app.current_org='7'");
            try(var r=s.executeQuery("SELECT count(*) FROM payout_recovery_jobs")) {r.next();assertThat(r.getLong(1)).isZero();}
            assertThatThrownBy(() -> s.execute("INSERT INTO payout_recovery_jobs(account_id,livemode,earliest_at) VALUES('acct_forged',false,now())"))
                    .isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("42501");
        }
    }
    private static void assertFundingIncidents(EntityManager em, PayoutMonitoringService monitoring, long transferId) {
        // La banque peut avoir payé : un litige sur la source reste visible, même sans worker activé.
        tx(em, () -> em.createNativeQuery("INSERT INTO payment_transactions VALUES(99001,7,'INTERVENTION',99002,'STRIPE','CHECKOUT','COMPLETED',90)").executeUpdate());
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).noneMatch(a -> a.transferId()==transferId);
        tx(em, () -> em.createNativeQuery("INSERT INTO payment_transactions VALUES(99002,8,'INTERVENTION',99002,'STRIPE','CHECKOUT','COMPLETED',90)").executeUpdate());
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).anyMatch(a -> a.transferId()==transferId && a.code().equals("FUNDING_DISPUTED"));
        tx(em, () -> em.createNativeQuery("UPDATE payment_transactions SET disputed_amount=0 WHERE id=99002").executeUpdate());
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).noneMatch(a -> a.transferId()==transferId);
        // Paiement groupé : le lien repose sur l'allocation, pas sur le montant ou le nom du bénéficiaire.
        tx(em, () -> {
            em.createNativeQuery("UPDATE payment_transactions SET source_type='INTERVENTION_BATCH',source_id=123,disputed_amount=90 WHERE id=99002").executeUpdate();
            em.createNativeQuery("INSERT INTO intervention_payment_allocations VALUES(7,99002,99002)").executeUpdate(); return null;
        });
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).noneMatch(a -> a.transferId()==transferId);
        tx(em, () -> em.createNativeQuery("INSERT INTO intervention_payment_allocations VALUES(8,99002,99002)").executeUpdate());
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).anyMatch(a -> a.transferId()==transferId && a.code().equals("FUNDING_DISPUTED"));
        tx(em, () -> {
            em.createNativeQuery("DELETE FROM intervention_payment_allocations").executeUpdate();
            em.createNativeQuery("UPDATE payment_transactions SET source_type='SERVICE_REQUEST',source_id=99003 WHERE id=99002").executeUpdate();
            em.createNativeQuery("INSERT INTO service_requests VALUES(99003,8,99002)").executeUpdate(); return null;
        });
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).anyMatch(a -> a.transferId()==transferId && a.code().equals("FUNDING_DISPUTED"));
        tx(em, () -> {
            em.createNativeQuery("UPDATE payment_transactions SET disputed_amount=0 WHERE id=99002").executeUpdate();
            em.createNativeQuery("INSERT INTO payment_transactions VALUES(99004,8,'INTERVENTION',99002,'STRIPE','REFUND','COMPLETED',0)").executeUpdate();
            em.createNativeQuery("INSERT INTO baitly_transfer_recoveries VALUES(8,:transfer,99004,'REVIEW_REQUIRED')").setParameter("transfer",transferId).executeUpdate();
            return null;
        });
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).anyMatch(a -> a.transferId()==transferId && a.code().equals("REFUND_RECOVERY_REQUIRED"));
        assertThat(tx(em, () -> monitoring.read(7L,0)).alerts().getContent()).noneMatch(a -> a.transferId()==transferId);
        tx(em, () -> em.createNativeQuery("UPDATE baitly_transfer_recoveries SET state='RECOVERED'").executeUpdate());
        assertThat(tx(em, () -> monitoring.read(8L,0)).alerts().getContent()).noneMatch(a -> a.transferId()==transferId);
        tx(em, () -> {
            em.createNativeQuery("UPDATE payment_transactions SET source_type='BOOKING_CHECKOUT',source_id=88001,disputed_amount=90 WHERE id=99002").executeUpdate();
            em.createNativeQuery("INSERT INTO owner_payout_reservations VALUES(8,88002,'[99002]')").executeUpdate();
            em.createNativeQuery("INSERT INTO provider_expenses(id,organization_id,provider_id,owner_payout_id,status) VALUES(88003,8,42,88002,'PAID')").executeUpdate();
            for (String[] source : new String[][]{{"OWNER_PAYOUT","88002"},{"PROVIDER_EXPENSE","88003"}}) {
                em.createNativeQuery("""
                    INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,
                      destination,description,idempotency_key,state,external_reference,created_at,updated_at)
                    VALUES(8,:source,:sourceId,42,90,'EUR','STRIPE','acct_risk',:description,:key,'TRANSFERRED',:reference,now(),now())
                    """).setParameter("source",source[0]).setParameter("sourceId",Long.valueOf(source[1]))
                    .setParameter("description","Risque " + source[0]).setParameter("key","risk-" + source[0])
                    .setParameter("reference","tr_risk_" + source[0]).executeUpdate();
            }
            return null;
        });
        var linked=tx(em, () -> monitoring.read(8L,0)).alerts().getContent();
        assertThat(linked).anyMatch(a -> a.description().equals("Risque OWNER_PAYOUT") && a.code().equals("FUNDING_DISPUTED"));
        assertThat(linked).anyMatch(a -> a.description().equals("Risque PROVIDER_EXPENSE") && a.code().equals("FUNDING_DISPUTED"));
        assertThat(tx(em, () -> monitoring.read(7L,0)).alerts().getContent()).noneMatch(a -> a.description().startsWith("Risque "));
        tx(em, () -> em.createNativeQuery("UPDATE payment_transactions SET disputed_amount=0 WHERE id=99002").executeUpdate());
        // Le litige est résolu, mais ces deux transferts n'ont aucune preuve bancaire :
        // leur alerte bancaire doit rester visible plutôt que disparaître avec le litige.
        var resolved=tx(em, () -> monitoring.read(8L,0)).alerts().getContent();
        assertThat(resolved).noneMatch(a -> a.description().startsWith("Risque ") && a.code().equals("FUNDING_DISPUTED"));
        assertThat(resolved).anyMatch(a -> a.description().equals("Risque OWNER_PAYOUT") && a.code().equals("BANK_UNCONFIRMED"));
        assertThat(resolved).anyMatch(a -> a.description().equals("Risque PROVIDER_EXPENSE") && a.code().equals("BANK_UNCONFIRMED"));
        assertThat(tx(em, () -> em.createNativeQuery("SELECT state FROM payout_transfers WHERE id=:id").setParameter("id",transferId).getSingleResult())).isEqualTo("TRANSFERRED");
    }
    private static <T> T tx(EntityManager em,Supplier<T> action) {
        em.getTransaction().begin();
        try { T value=action.get();em.getTransaction().commit();return value; }
        catch(RuntimeException e) {if(em.getTransaction().isActive())em.getTransaction().rollback();throw e;}
    }
}
