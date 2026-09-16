package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.stripe.model.Refund;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class MissionFinancialPostgresTest {
    SingleConnectionDataSource source; JdbcTemplate db; String schema; TransactionTemplate tx;
    MissionFinancialService service; MissionFinancialWorker worker;
    StripeGateway gateway; ServiceQuoteAmendmentService access;
    Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("manager").build();
    @BeforeEach void setup() throws Exception {
        source=new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),"",true);
        db=new JdbcTemplate(source); schema="baitly_fin_"+UUID.randomUUID().toString().replace("-","");
        db.execute("CREATE SCHEMA "+schema); db.execute("SET search_path TO "+schema);
        db.execute("CREATE TABLE service_quote_cancellations(quote_id bigint PRIMARY KEY,organization_id bigint,intervention_id bigint,reason text DEFAULT 'Motif',agreed_amount numeric DEFAULT 100,currency text DEFAULT 'EUR')");
        db.execute("CREATE TABLE interventions(id bigint PRIMARY KEY,service_request_id bigint,stripe_session_id text)");
        db.execute("CREATE TABLE service_requests(id bigint PRIMARY KEY,stripe_session_id text)");
        db.execute("CREATE TABLE payment_transactions(organization_id bigint,provider_type text,provider_tx_id text,source_type text,source_id bigint,payment_type text,metadata jsonb,id bigserial PRIMARY KEY,transaction_ref text, status text, amount numeric(12,2), currency text, idempotency_key text UNIQUE,created_at timestamp,updated_at timestamp)");
        try(var sql=getClass().getResourceAsStream("/db/changelog/changes/0459__mission_financial_cases.sql")) { db.execute(new String(sql.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8)); }
        db.execute("INSERT INTO service_quote_cancellations(quote_id,organization_id,intervention_id) VALUES(1,7,10),(2,8,20)");
        access=mock(ServiceQuoteAmendmentService.class);
        lenient().when(access.access(1L,7L,jwt)).thenReturn(new ServiceQuoteAmendmentService.Access(5L,false,true,false,false));
        service=new MissionFinancialService(db,access,mock(ServiceQuoteAmendmentDiscussion.class),mock(EntityManager.class));
        var manager=new DataSourceTransactionManager(source); tx=new TransactionTemplate(manager);
        gateway=mock(StripeGateway.class); worker=new MissionFinancialWorker(db,gateway,manager,mock(MissionFinancialSettlement.class));
        service.open(1L,7L,"Annulation","manager");
        db.execute("UPDATE mission_financial_cases SET amount_due=0");
        db.execute("INSERT INTO mission_financial_payments(id,quote_id,provider,session_ref,payment_intent,currency,collected,state) VALUES(5,1,'STRIPE','cs_1','pi_1','eur',10000,'VERIFIED')");
    }
    @AfterEach void cleanup() { db.execute("DROP SCHEMA "+schema+" CASCADE"); source.destroy(); }
    long version() { return db.queryForObject("SELECT version FROM mission_financial_cases WHERE quote_id=1",Long.class); }
    UUID proposal(long amount,String evidence) {
        tx.executeWithoutResult(s -> service.command(1L,7L,jwt,version(),"PROPOSE",5L,amount,null,"Motif",evidence,null,evidence==null ? null : 10000L));
        return db.queryForObject("SELECT id FROM mission_financial_decisions ORDER BY created_at DESC LIMIT 1",UUID.class);
    }
    void command(String action,UUID id) { tx.executeWithoutResult(s -> service.command(1L,7L,jwt,version(),action,null,null,id,"Motif",null)); }
    @Test void requiresApprovalAndDisputeSuspendsExecution() {
        UUID id=proposal(2500,null); worker.process(id); verifyNoInteractions(gateway);
        command("APPROVE",id); command("DISPUTE",null); worker.process(id); verifyNoInteractions(gateway);
        assertThat(db.queryForObject("SELECT state FROM mission_financial_decisions WHERE id=?",String.class,id)).isEqualTo("APPROVED");
    }
    @Test void pendingRefundIsPolledWithoutAnotherCreation() throws Exception {
        UUID id=proposal(2500,null); command("APPROVE",id);
        var pending=new Refund(); pending.setId("re_1"); pending.setCurrency("eur"); pending.setStatus("pending"); pending.setAmount(2500L); pending.setPaymentIntent("pi_1"); pending.setMetadata(Map.of("baitly_financial_decision",id.toString()));
        when(gateway.createRefund(any(),eq("baitly-financial-"+id))).thenReturn(pending);
        worker.process(id);
        assertThat(db.queryForObject("SELECT state FROM mission_financial_decisions WHERE id=?",String.class,id)).isEqualTo("PENDING");
        var done=new Refund(); done.setId("re_1"); done.setCurrency("eur"); done.setStatus("succeeded"); done.setAmount(2500L); done.setPaymentIntent("pi_1"); done.setMetadata(Map.of("baitly_financial_decision",id.toString())); when(gateway.retrieveRefund("re_1")).thenReturn(done);
        worker.process(id); worker.process(id);
        verify(gateway,times(1)).createRefund(any(),eq("baitly-financial-"+id));
        assertThat(db.queryForObject("SELECT state FROM mission_financial_decisions WHERE id=?",String.class,id)).isEqualTo("SUCCEEDED");
    }
    @Test void staleVersionAndSecondActiveProposalAreRejected() {
        proposal(1000,null);
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> service.command(1L,7L,jwt,0,"CLOSE",null,null,null,"Motif",null))).hasMessageContaining("changé");
        assertThatThrownBy(() -> proposal(1000,null)).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        assertThat(db.queryForObject("SELECT count(*) FROM mission_financial_decisions",Integer.class)).isEqualTo(1);
    }
    @Test void boundByRemainingMoneyAndSharedAllocationEvidence() {
        assertThatThrownBy(() -> proposal(10001,null)).hasMessageContaining("solde");
        db.execute("UPDATE mission_financial_payments SET shared=true");
        assertThatThrownBy(() -> proposal(1000,null)).hasMessageContaining("justificatif");
        assertThat(proposal(1000,"Part de la mission documentée dans le reçu du lot")).isNotNull();
    }
    @Test void discoverFindsSecondaryGroupMembersAndKeepsReferencesUnique() {
        db.execute("INSERT INTO interventions VALUES(10,null,'cs_group')");
        db.execute("INSERT INTO payment_transactions(organization_id,provider_type,provider_tx_id,source_type,source_id,payment_type,metadata) VALUES(7,'STRIPE','cs_group','INTERVENTION',99,'PAYMENT','{\"interventionIds\":\"99,10\"}')");
        worker.discover(1L); worker.discover(1L);
        assertThat(db.queryForObject("SELECT count(*) FROM mission_financial_payments WHERE session_ref='cs_group'",Integer.class)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT shared FROM mission_financial_payments WHERE session_ref='cs_group'",Boolean.class)).isTrue();
    }
    @Test void anotherOrganizationCannotReadOrChangeCase() {
        when(access.access(1L,8L,jwt)).thenThrow(new org.springframework.security.access.AccessDeniedException("Organisation"));
        assertThatThrownBy(() -> service.view(1L,8L,jwt)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> service.command(1L,8L,jwt,0,"CLOSE",null,null,null,"Motif",null)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test void amountDueAndSuccessfulRefundsLimitFurtherProposals() {
        tx.executeWithoutResult(s -> service.command(1L,7L,jwt,version(),"ASSESS",null,null,null,"Travail effectué",null,new java.math.BigDecimal("80")));
        assertThatThrownBy(() -> proposal(2001,null)).hasMessageContaining("montant dû");
        UUID id=proposal(2000,null);
        db.update("UPDATE mission_financial_decisions SET state='SUCCEEDED' WHERE id=?",id);
        // Le PSP n'a pas encore rafraîchi refunded : la décision durable suffit.
        assertThatThrownBy(() -> proposal(1,null)).hasMessageContaining("montant dû");
    }
    @Test void uncertainRefundCannotBeWithdrawnAndRetryReusesExistingPspRefund() throws Exception {
        UUID id=proposal(2500,null); command("APPROVE",id);
        db.update("UPDATE mission_financial_decisions SET state='REVIEW',started_at=now()-interval '2 days' WHERE id=?",id);
        assertThatThrownBy(() -> command("WITHDRAW",id)).hasMessageContaining("déjà");
        command("RETRY_REVIEW",id);
        var existing=new Refund(); existing.setId("re_existing"); existing.setAmount(2500L);
        existing.setPaymentIntent("pi_1"); existing.setCurrency("eur"); existing.setStatus("succeeded");
        existing.setMetadata(Map.of("baitly_financial_decision",id.toString()));
        when(gateway.findFinancialRefund("pi_1",id.toString())).thenReturn(existing);
        worker.process(id);
        verify(gateway,never()).createRefund(any(),anyString());
        assertThat(db.queryForObject("SELECT state FROM mission_financial_decisions WHERE id=?",String.class,id)).isEqualTo("SUCCEEDED");
        assertThat(db.queryForObject("SELECT status FROM payment_transactions WHERE provider_tx_id='re_existing'",String.class)).isEqualTo("COMPLETED");
    }
    @Test void wrongCurrencyIsNeverMarkedRefunded() throws Exception {
        UUID id=proposal(2500,null); command("APPROVE",id);
        var wrong=new Refund(); wrong.setId("re_wrong"); wrong.setAmount(2500L); wrong.setCurrency("usd");
        wrong.setPaymentIntent("pi_1"); wrong.setStatus("succeeded");
        wrong.setMetadata(Map.of("baitly_financial_decision",id.toString()));
        when(gateway.createRefund(any(),anyString())).thenReturn(wrong); worker.process(id);
        assertThat(db.queryForObject("SELECT state FROM mission_financial_decisions WHERE id=?",String.class,id)).isEqualTo("REVIEW");
        assertThat(db.queryForObject("SELECT count(*) FROM payment_transactions",Integer.class)).isZero();
    }
    @Test void sharedPaymentAllocationsCannotExceedGroupCollection() {
        db.execute("UPDATE mission_financial_payments SET shared=true");
        service.open(2L,8L,"Autre annulation","manager");
        db.execute("INSERT INTO mission_financial_payments(quote_id,provider,session_ref,collected,allocation,shared) VALUES(2,'STRIPE','cs_1',10000,9000,true)");
        assertThatThrownBy(() -> proposal(2000,"Part du lot")).hasMessageContaining("parts du lot");
    }
    @Test void settlementWaitsForVerifiedFullRefundAndNotifiesOnlyOnce() {
        var em=mock(EntityManager.class);
        var transitions=mock(PaymentStatusTransitionService.class);
        var ledger=mock(PaymentLedgerReversalService.class);
        var discussion=mock(ServiceQuoteAmendmentDiscussion.class);
        var settlement=new MissionFinancialSettlement(db,em,transitions,ledger,discussion);
        var cancellation=mock(com.clenzy.model.ServiceQuoteCancellation.class);
        when(cancellation.getInterventionId()).thenReturn(10L); when(cancellation.getOrganizationId()).thenReturn(7L);
        var mission=new com.clenzy.model.Intervention(); mission.setId(10L); mission.setOrganizationId(7L);
        var request=new com.clenzy.model.ServiceRequest(); mission.setServiceRequest(request);
        when(em.find(com.clenzy.model.ServiceQuoteCancellation.class,1L)).thenReturn(cancellation);
        when(em.find(com.clenzy.model.Intervention.class,10L)).thenReturn(mission);
        tx.executeWithoutResult(s -> settlement.settle(1L));
        verify(transitions,never()).markInterventionRefunded(anyLong());
        db.execute("UPDATE mission_financial_payments SET refunded=10000");
        tx.executeWithoutResult(s -> settlement.settle(1L));
        verify(transitions).markInterventionRefunded(10L); verify(ledger).reverseInterventionPaymentEntries(10L);
        assertThat(request.getPaymentStatus()).isEqualTo(com.clenzy.model.PaymentStatus.REFUNDED);
        db.execute("UPDATE mission_financial_payments SET refunded=0");
        UUID id=proposal(1000,null); command("APPROVE",id);
        db.update("UPDATE mission_financial_decisions SET state='SUCCEEDED' WHERE id=?",id);
        tx.executeWithoutResult(s -> settlement.notifyDecision(id));
        tx.executeWithoutResult(s -> settlement.notifyDecision(id));
        verify(discussion,times(1)).financial(any(),eq("manager"),anyString(),anyString());
    }

    @Test void externalRefundNeedsVerifiedStatementApprovalAndExecutionEvidence() {
        db.execute("UPDATE mission_financial_payments SET provider='PAYPAL',state='UNVERIFIED',collected=0");
        assertThatThrownBy(() -> proposal(1000,null)).hasMessageContaining("rapproché");
        tx.executeWithoutResult(s -> service.command(1L,7L,jwt,version(),"VERIFY_EXTERNAL",5L,null,null,"Relevé contrôlé","Relevé PAYPAL-2026-09",null,null,
                new MissionFinancialService.ExternalEvidence("EUR",10000L,0L)));
        UUID id=proposal(1000,null);
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> service.command(1L,7L,jwt,version(),"CONFIRM_EXTERNAL",null,null,id,"Exécuté","Reçu PAYPAL-R1")))
                .hasMessageContaining("approuvée");
        command("APPROVE",id); worker.process(id); verifyNoInteractions(gateway);
        tx.executeWithoutResult(s -> service.command(1L,7L,jwt,version(),"CONFIRM_EXTERNAL",null,null,id,"Exécuté","Reçu PAYPAL-R1"));
        assertThat(db.queryForObject("SELECT status FROM payment_transactions WHERE idempotency_key=?",String.class,"baitly-financial-"+id)).isEqualTo("COMPLETED");
        assertThat(db.queryForObject("SELECT accounting_state FROM mission_financial_cases WHERE quote_id=1",String.class)).isEqualTo("REVIEW");
        assertThatThrownBy(() -> command("CLOSE",null)).hasMessageContaining("comptable");
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> service.command(1L,7L,jwt,version(),"CONFIRM_EXTERNAL",null,null,id,"Exécuté","Reçu PAYPAL-R1")))
                .hasMessageContaining("approuvée");
    }

    @Test void legacyRefundCannotBypassCaseForSecondaryGroupOrLinkedRequestBeforeDiscovery() {
        var em=mock(EntityManager.class);
        var named=new org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate(db);
        when(em.createNativeQuery(anyString())).thenAnswer(call -> {
            String sql=call.getArgument(0);
            var query=mock(jakarta.persistence.Query.class);
            var params=new HashMap<String,Object>();
            when(query.setParameter(anyString(),any())).thenAnswer(bind -> { params.put(bind.getArgument(0),bind.getArgument(1)); return query; });
            when(query.getSingleResult()).thenAnswer(read -> named.queryForObject(sql,params,Long.class));
            return query;
        });
        var guard=new InterventionPaymentCoordination(em,mock(com.clenzy.repository.PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class),mock(CurrencyConverterService.class));
        db.execute("INSERT INTO interventions VALUES(10,22,null)");
        db.execute("INSERT INTO service_requests VALUES(22,'cs_linked')");
        db.execute("INSERT INTO payment_transactions(id,organization_id,provider_type,provider_tx_id,source_type,source_id,payment_type,metadata) VALUES(90,7,'STRIPE','cs_group','INTERVENTION',99,'CHECKOUT','{\"interventionIds\":\"99,10\"}')");
        var payment=new com.clenzy.model.PaymentTransaction(); payment.setId(90L); payment.setOrganizationId(7L); payment.setProviderTxId("cs_group");
        assertThatThrownBy(() -> guard.requireRefundOutsideCancellationCase(payment)).hasMessageContaining("dossier financier");
        payment.setId(91L); payment.setProviderTxId("cs_linked");
        assertThatThrownBy(() -> guard.requireRefundOutsideCancellationCase(payment)).hasMessageContaining("dossier financier");
        payment.setOrganizationId(8L);
        assertThatCode(() -> guard.requireRefundOutsideCancellationCase(payment)).doesNotThrowAnyException();
    }

}
