package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.exception.NotFoundException;
import org.hibernate.cfg.Configuration;
import org.hibernate.Session;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.*;
import java.util.HashSet;
import static org.assertj.core.api.Assertions.*;

/** Vraies requêtes de pagination et de détail, sous RLS et filtre Hibernate de l'organisation destinataire. */
final class BeneficiaryPayoutPostgresAssertions {
    static void verify(String url,String user,String role) throws Exception {
        try(Connection c=DriverManager.getConnection(url,user,""); Statement s=c.createStatement()) {
            s.execute("INSERT INTO users(id,organization_id) VALUES(44,9)");
            // Treize transferts personnels provenant de deux clients, un autre destinataire et une société.
            s.execute("""
                INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,
                  destination,description,idempotency_key,state,created_at,updated_at)
                SELECT CASE WHEN n%2=0 THEN 7 ELSE 8 END,'INTERVENTION',99100+n,44,80,'EUR','STRIPE',
                  'acct_recipient','Mission '||n,'beneficiary-test-'||n,'SUBMITTING','2031-01-01'::timestamptz+n*interval '1 minute',now()
                FROM generate_series(1,13) n
                """);
            s.execute("""
                INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,
                  destination,description,idempotency_key,state)
                VALUES(7,'INTERVENTION',99114,43,80,'EUR','STRIPE','acct_other','Autre bénéficiaire','beneficiary-other','SUBMITTING')
                """);
            s.execute("""
                INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_organization_id,amount,currency,provider,
                  destination,description,idempotency_key,state)
                VALUES(8,'INTERVENTION',99115,9,80,'EUR','STRIPE','acct_company','Société','beneficiary-company','SUBMITTING')
                """);
            s.execute("""
                UPDATE payout_transfers SET state='TRANSFERRED',external_reference='tr_recipient',
                  destination_payment='py_recipient',stripe_livemode=false WHERE source_id=99113
                """);
            s.execute("""
                INSERT INTO payout_transfer_events(organization_id,transfer_id,state,external_reference,actor_subject,origin)
                SELECT organization_id,id,state,external_reference,'private-operator','RECONCILIATION' FROM payout_transfers WHERE source_id=99113
                """);
            s.execute("""
                INSERT INTO stripe_bank_payout_events(event_id,account_id,payout_id,livemode,status,payout_created,event_created,sources)
                VALUES('evt_recipient','acct_recipient','po_recipient',false,'PAID',now(),now(),
                  '[{"source":"py_recipient","amountMinor":8000,"currency":"eur"}]'),
                  ('evt_foreign','acct_other','po_foreign',false,'PAID',now(),now(),
                  '[{"source":"py_recipient","amountMinor":8000,"currency":"eur"}]')
                """);
        }
        try(var sessions=new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(PayoutTransferEvent.class).addAnnotatedClass(BankPayoutObservation.class)
                .setProperty("hibernate.connection.url",url).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();var em=sessions.createEntityManager()) {
            var factory=new JpaRepositoryFactory(em);
            var reader=new BeneficiaryPayoutReader(factory.getRepository(PayoutTransferRepository.class),
                    factory.getRepository(PayoutTransferEventRepository.class),factory.getRepository(BankPayoutObservationRepository.class), org.mockito.Mockito.mock(com.clenzy.repository.BaitlyTransferRecoveryRepository.class));
            em.getTransaction().begin();
            em.createNativeQuery("SET LOCAL ROLE "+role).executeUpdate();
            em.createNativeQuery("SET LOCAL app.current_org='9'").executeUpdate();
            em.createNativeQuery("SET LOCAL app.bypass_rls='off'").executeUpdate();
            em.unwrap(Session.class).enableFilter("organizationFilter").setParameter("orgId",9L);
            assertThat(reader.list(44L,null,0)).isEmpty(); // Le rôle SQL seul ne lit jamais les clients.
            em.createNativeQuery("SET LOCAL app.bypass_rls='on'").executeUpdate();
            var first=reader.list(44L,null,0); var second=reader.list(44L,null,1);
            assertThat(first.getTotalElements()).isEqualTo(13); assertThat(first.getContent()).hasSize(12);
            assertThat(first.getTotalPages()).isEqualTo(2); assertThat(second.getContent()).hasSize(1);
            assertThat(first.getContent().getFirst().description()).isEqualTo("Mission 13");
            var ids=new HashSet<Long>(); first.forEach(row -> ids.add(row.id())); second.forEach(row -> ids.add(row.id()));
            assertThat(ids).hasSize(13);
            var personal=first.getContent().getFirst();
            var detail=reader.detail(44L,null,personal.id());
            assertThat(detail.events()).hasSize(1);
            assertThat(detail.bankPayouts()).singleElement().satisfies(bank -> {
                assertThat(bank.payoutId()).isEqualTo("po_recipient"); assertThat(bank.status()).isEqualTo("PAID");
            });
            assertThatThrownBy(() -> reader.detail(43L,null,personal.id())).isInstanceOf(NotFoundException.class);
            assertThatThrownBy(() -> reader.detail(null,9L,personal.id())).isInstanceOf(NotFoundException.class);
            var company=reader.list(null,9L,0);
            assertThat(company.getContent()).isNotEmpty().noneMatch(row -> ids.contains(row.id()));
            var companyId=company.getContent().stream().filter(row -> row.description().equals("Société")).findFirst().orElseThrow().id();
            assertThat(reader.detail(null,9L,companyId).bankPayouts()).isEmpty();
            assertThatThrownBy(() -> reader.detail(44L,null,companyId)).isInstanceOf(NotFoundException.class);
            assertThatThrownBy(() -> reader.detail(null,8L,companyId)).isInstanceOf(NotFoundException.class);
            em.getTransaction().commit();
        }
    }
}
