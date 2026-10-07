package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vrais repositories, CAS, JPA et ledger : rollback intégral puis rejeu sans double écriture. */
class InterventionBatchPersistenceTest {
    static SessionFactory factory;
    EntityManager em;
    InterventionBatchReconciliationService writer;
    LedgerService ledger;
    PaymentTransactionRepository payments;
    InterventionPaymentAllocationRepository allocations;
    String reference;

    @BeforeAll static void mappings() {
        var fields = Set.of("organizationId","stripeSessionId","paymentStatus","paidAt","status","title","completedAt");
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\"><entity class=\"com.clenzy.model.Intervention\" access=\"FIELD\" metadata-complete=\"true\"><table name=\"interventions\"/><attributes><id name=\"id\"/>");
        for(var field:Intervention.class.getDeclaredFields()) {
            if(Modifier.isStatic(field.getModifiers()) || field.getName().equals("id")) continue;
            if(fields.contains(field.getName())) {
                xml.append("<basic name=\"").append(field.getName()).append("\">");
                if(field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                xml.append("</basic>");
            } else xml.append("<transient name=\"").append(field.getName()).append("\"/>");
        }
        xml.append("</attributes></entity></entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(PaymentTransaction.class).addAnnotatedClass(InterventionPaymentAllocation.class)
                .addAnnotatedClass(LedgerEntry.class)
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url","jdbc:h2:mem:batchalloc;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto","create-drop")
                .setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
    }
    @AfterAll static void closeFactory() { if(factory!=null) factory.close(); }
    @BeforeEach void seedAndWire() {
        em=factory.createEntityManager(); em.getTransaction().begin();
        em.createQuery("delete from InterventionPaymentAllocation").executeUpdate();
        em.createQuery("delete from PaymentTransaction").executeUpdate();
        em.createQuery("delete from Intervention").executeUpdate();
        em.createQuery("delete from LedgerEntry").executeUpdate();
        var tx=InterventionBatchCheckoutServiceTest.batch(); tx.setId(null); em.persist(tx); reference=tx.getTransactionRef();
        em.persist(new InterventionPaymentAllocation(tx,1L,new BigDecimal("30")));
        em.persist(new InterventionPaymentAllocation(tx,2L,new BigDecimal("50")));
        for(long id:List.of(1L,2L)) {
            var mission=new Intervention(); mission.setId(id); mission.setOrganizationId(7L);
            mission.setStripeSessionId("cs_batch"); mission.setPaymentStatus(PaymentStatus.PROCESSING);
            mission.setStatus(InterventionStatus.PENDING); mission.setTitle("Mission test"); em.persist(mission);
        }
        em.getTransaction().commit(); em.clear();
        var repos=new JpaRepositoryFactory(em);
        payments=repos.getRepository(PaymentTransactionRepository.class);
        allocations=repos.getRepository(InterventionPaymentAllocationRepository.class);
        ledger=spy(new LedgerService(repos.getRepository(LedgerEntryRepository.class)));
        var interventions=mock(InterventionRepository.class);
        when(interventions.findById(anyLong())).thenAnswer(c->Optional.ofNullable(em.find(Intervention.class,c.getArgument(0))));
        when(interventions.save(any())).thenAnswer(c->em.merge(c.getArgument(0)));
        var documents=mock(DocumentGenerationOutbox.class);
        var transitions=new PaymentStatusTransitionService(em,interventions,documents);
        var wallets=mock(WalletService.class);
        var platform=new Wallet(); platform.setId(10L); platform.setOrganizationId(7L); platform.setCurrency("EUR");
        var escrow=new Wallet(); escrow.setId(20L); escrow.setOrganizationId(7L); escrow.setCurrency("EUR");
        when(wallets.getOrCreatePlatformWallet(7L,"EUR")).thenReturn(platform);
        when(wallets.getOrCreateEscrowWallet(7L,"EUR")).thenReturn(escrow);
        var confirmation=new StripePaymentConfirmationService(interventions,mock(ReservationRepository.class),mock(ServiceRequestRepository.class),
                mock(NotificationService.class),mock(ServiceRequestService.class),wallets,ledger,mock(SplitPaymentService.class),mock(AutoInvoiceService.class),documents,
                transitions,mock(com.clenzy.service.email.BookingConfirmationEmailService.class),mock(WebhookEventPublisher.class), org.mockito.Mockito.mock(com.clenzy.booking.service.BaitlyReservationCredit.class));
        var persistence=new PaymentPersistence(payments,mock(OutboxPublisher.class),new com.fasterxml.jackson.databind.ObjectMapper(),
                mock(DepositReconciler.class),mock(InterventionPaymentCoordination.class),mock(InvoicePaymentCoordination.class), org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));
        var tenant=mock(TenantContext.class); when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        writer=new InterventionBatchReconciliationService(payments,allocations,persistence,confirmation,tenant,em,mock(InvoicePaymentCoordination.class));
    }
    @AfterEach void close() {
        if(em.getTransaction().isActive()) em.getTransaction().rollback();
        em.close();
    }
    void transact(Runnable action) {
        em.getTransaction().begin();
        try { action.run(); em.getTransaction().commit(); }
        catch(RuntimeException ex) { em.getTransaction().rollback(); throw ex; }
        finally { em.clear(); }
    }
    long entries() { return em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult(); }
    @Test void replayAfterCommitDoesNotDuplicateLedgerAndQueriesRespectOrganization() throws Exception {
        transact(()->writer.confirm(reference,"cs_batch"));
        transact(()->writer.confirm(reference,"cs_batch"));
        transact(()->writer.reconcile(reference));
        assertThat(entries()).isEqualTo(4);
        assertThat(payments.findByTransactionRef(reference).orElseThrow().getStatus()).isEqualTo(TransactionStatus.COMPLETED);
        assertThat(allocations.findForTransaction(7L,reference)).hasSize(2).allMatch(p->p.getConfirmedAt()!=null);
        assertThat(allocations.findForTransaction(8L,reference)).isEmpty();
        assertThat(allocations.findForMission(7L,2L)).extracting(InterventionPaymentAllocation::getAmount).containsExactly(new BigDecimal("50.00"));
        String guard=InterventionRepository.class.getMethod("hasAllocatedPayment",Long.class,Long.class,String.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertThat(em.createQuery(guard,Boolean.class).setParameter("org",7L).setParameter("mission",1L).setParameter("session","cs_batch").getSingleResult()).isTrue();
        assertThat(em.createQuery(guard,Boolean.class).setParameter("org",8L).setParameter("mission",1L).setParameter("session","cs_batch").getSingleResult()).isFalse();
    }
    @Test void failureOnSecondMissionRollsBackFirstMissionAndFirstLedgerThenRetrySucceeds() {
        doAnswer(call->{ if("TX-batch:2".equals(call.getArgument(4))) throw new IllegalStateException("second ledger fails"); return call.callRealMethod(); })
                .when(ledger).recordTransfer(any(),any(),any(),any(),anyString(),anyString());
        assertThatThrownBy(()->transact(()->writer.confirm(reference,"cs_batch"))).hasMessage("second ledger fails");
        assertThat(entries()).isZero();
        assertThat(payments.findByTransactionRef(reference).orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING);
        assertThat(allocations.findForTransaction(7L,reference)).allMatch(p->p.getConfirmedAt()==null);
        assertThat(em.find(Intervention.class,1L).getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
        assertThat(em.find(Intervention.class,2L).getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
        doCallRealMethod().when(ledger).recordTransfer(any(),any(),any(),any(),anyString(),anyString());
        transact(()->writer.confirm(reference,"cs_batch"));
        assertThat(entries()).isEqualTo(4);
    }
}
