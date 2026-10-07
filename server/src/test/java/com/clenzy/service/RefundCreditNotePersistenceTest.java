package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Repositories réels : conservation des taxes, verrous, rollback et liens documentaires. */
class RefundCreditNotePersistenceTest {
    static SessionFactory factory;
    Long originalId;
    final TenantContext tenant = mock(TenantContext.class);

    @BeforeAll static void start() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        mapping(xml, Intervention.class, Set.of("organizationId", "paymentStatus", "estimatedCost", "currency", "stripeSessionId"));
        mapping(xml, Reservation.class, Set.of("organizationId", "paymentStatus", "paymentCollection", "totalPrice", "creditApplied", "currency", "stripeSessionId", "status"));
        xml.append("</entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
            .addAnnotatedClass(InterventionPaymentAllocation.class)
            .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class).addAnnotatedClass(InvoiceNumberSequence.class)
            .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
            .setProperty("hibernate.connection.url", "jdbc:h2:mem:refundnotes;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("jakarta.persistence.validation.mode", "none")
            .buildSessionFactory();
    }
    static void mapping(StringBuilder xml, Class<?> entity, Set<String> fields) {
        xml.append("<entity class=\"").append(entity.getName())
            .append("\" access=\"FIELD\" metadata-complete=\"true\"><attributes><id name=\"id\"/>");
        for (var field : entity.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) || field.getName().equals("id")) continue;
            if (fields.contains(field.getName())) {
                xml.append("<basic name=\"").append(field.getName()).append("\">");
                if (field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                xml.append("</basic>");
            } else xml.append("<transient name=\"").append(field.getName()).append("\"/>");
        }
        xml.append("</attributes></entity>");
    }
    @AfterAll static void stop() { if (factory != null) factory.close(); }
    @BeforeEach void seed() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            for (var name : List.of("InvoiceLine", "Invoice", "InterventionPaymentAllocation", "PaymentTransaction", "Intervention", "Reservation", "InvoiceNumberSequence"))
                em.createQuery("delete from " + name).executeUpdate();
            em.persist(new InvoiceNumberSequence(7L, "FA", LocalDate.now().getYear()));
            var payment = transaction("TX-original", TransactionType.CHECKOUT); payment.setProviderTxId("cs_original"); em.persist(payment);
            var refund = transaction("REF-test", TransactionType.REFUND); refund.setProviderTxId("re_test");
            refund.setMetadata(Map.of("originalTransactionRef", "TX-original", "managedRefund", true)); em.persist(refund);
            var mission = new Intervention(); mission.setId(364L); mission.setOrganizationId(7L); mission.setPaymentStatus(PaymentStatus.REFUNDED);
            mission.setEstimatedCost(new BigDecimal("45")); mission.setCurrency("EUR"); mission.setStripeSessionId("cs_original"); em.persist(mission);
            var invoice = new Invoice(); invoice.setOrganizationId(7L); invoice.setInvoiceNumber("FA-ORIGINAL"); invoice.setInvoiceDate(LocalDate.of(2026, 3, 1));
            invoice.setStatus(InvoiceStatus.PAID); invoice.setInvoiceType(InvoiceType.GUEST); invoice.setInterventionId(364L);
            invoice.setTotalHt(new BigDecimal("38.64")); invoice.setTotalTax(new BigDecimal("6.36")); invoice.setTotalTtc(new BigDecimal("45"));
            invoice.setSellerName("Prestataire Baitly"); invoice.setBuyerName("Client test");
            invoice.addLine(line(1, "25", "5", "30", "0.20")); invoice.addLine(line(2, "13.64", "1.36", "15", "0.10"));
            em.persist(invoice); em.getTransaction().commit(); originalId = invoice.getId();
        }
    }
    static InvoiceLine line(int number, String ht, String tax, String ttc, String rate) {
        var l = new InvoiceLine(); l.setLineNumber(number); l.setDescription("Ligne <" + number + ">");
        l.setQuantity(BigDecimal.ONE); l.setUnitPriceHt(new BigDecimal(ht)); l.setTaxCategory("VAT"); l.setTaxRate(new BigDecimal(rate));
        l.setTotalHt(new BigDecimal(ht)); l.setTaxAmount(new BigDecimal(tax)); l.setTotalTtc(new BigDecimal(ttc)); return l;
    }
    static PaymentTransaction transaction(String ref, TransactionType type) {
        var p = new PaymentTransaction(); p.setOrganizationId(7L); p.setTransactionRef(ref); p.setSourceType("INTERVENTION"); p.setSourceId(364L);
        p.setPaymentType(type); p.setProviderType(PaymentProviderType.STRIPE); p.setStatus(TransactionStatus.COMPLETED);
        p.setAmount(new BigDecimal("45")); p.setCurrency("EUR"); return p;
    }
    <T> T repo(EntityManager em, Class<T> type) { return new JpaRepositoryFactory(em).getRepository(type); }
    RefundCreditNoteService service(EntityManager em) { return service(em, repo(em, InvoiceRepository.class)); }
    RefundCreditNoteService service(EntityManager em, InvoiceRepository invoices) {
        return new RefundCreditNoteService(em, invoices, repo(em, PaymentTransactionRepository.class),
            new InvoiceNumberingService(repo(em, InvoiceNumberSequenceRepository.class), tenant, em), tenant,
            new BaitlyBatchRefundPersistence(em, repo(em, PaymentTransactionRepository.class), mock(InterventionPaymentCoordination.class), org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class)));
    }
    PaymentTransaction refund(EntityManager em) { return repo(em, PaymentTransactionRepository.class).findByTransactionRef("REF-test").orElseThrow(); }
    long notes(EntityManager em) { return em.createQuery("select count(i) from Invoice i where i.status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE", Long.class).getSingleResult(); }

    @ParameterizedTest @ValueSource(booleans={true,false})
    void externalProofCreatesAnIdempotentCreditOnlyAfterFinancialReconciliation(boolean confirmed) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); refund(em).setMetadata(Map.of("externalRefund",true,"externalRefundConfirmed",confirmed,
                "originalTransactionRef","TX-original","stripeStatus","succeeded","reviewRequired",false));
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            Long credit=service(em).reconcile("REF-test"); em.getTransaction().commit();
            if(!confirmed) { assertThat(credit).isNull(); assertThat(notes(em)).isZero(); return; }
            assertThat(em.find(Invoice.class,credit).getTotalTtc()).isEqualByComparingTo("-45");
            assertThat(em.find(Invoice.class,credit).getOriginalInvoiceId()).isEqualTo(originalId);
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isEqualTo(credit); em.getTransaction().commit();
            assertThat(notes(em)).isEqualTo(1);
        }
    }

    @ParameterizedTest @ValueSource(booleans={true,false})
    void lateExternalRejectionNeverCreatesOrDeletesACredit(boolean existingCredit) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); refund(em).setMetadata(Map.of("externalRefund",true,"externalRefundConfirmed",true,
                "originalTransactionRef","TX-original","stripeStatus","succeeded","reviewRequired",false));
            Long existing=existingCredit ? service(em).reconcile("REF-test") : null;
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            var metadata=new HashMap<>(refund(em).getMetadata()); metadata.put("stripeStatus","failed"); metadata.put("reviewRequired",true);
            refund(em).setMetadata(metadata); em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            if(existingCredit) {
                assertThat(service(em).reconcile("REF-test")).isEqualTo(existing); em.getTransaction().commit();
            } else {
                assertThatThrownBy(() -> service(em).reconcile("REF-test")).hasMessageContaining("externe à rapprocher");
                em.getTransaction().rollback();
            }
            assertThat(notes(em)).isEqualTo(existingCredit ? 1 : 0);
            assertThat(em.find(Invoice.class,originalId).getStatus()).isEqualTo(InvoiceStatus.PAID);
        }
    }

    @ParameterizedTest @ValueSource(strings={"5","0.01","44.99"})
    void partialExternalCreditPreservesOriginalTaxRatesAndOnlyCreditsTheConfirmedAmount(String amount) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); var refund=refund(em); refund.setAmount(new BigDecimal(amount));
            refund.setMetadata(Map.of("externalRefund",true,"externalRefundConfirmed",true,
                "originalTransactionRef","TX-original","stripeStatus","succeeded","reviewRequired",false));
            em.find(Intervention.class,364L).setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            Long id=service(em).reconcile("REF-test"); em.getTransaction().commit();
            var note=em.find(Invoice.class,id);
            assertThat(note.getTotalTtc()).isEqualByComparingTo(new BigDecimal(amount).negate());
            assertThat(note.getTotalHt().add(note.getTotalTax())).isEqualByComparingTo(note.getTotalTtc());
            assertThat(note.getOriginalInvoiceId()).isEqualTo(originalId);
            assertThat(note.getLines()).allMatch(l -> l.getTotalTtc().signum()<0);
            assertThat(note.getLines()).extracting(InvoiceLine::getTaxRate).allMatch(rate -> rate.compareTo(new BigDecimal("0.20"))==0 || rate.compareTo(new BigDecimal("0.10"))==0);
            assertThat(em.find(Invoice.class,originalId).getTotalTtc()).isEqualByComparingTo("45");
            assertThat(em.find(Invoice.class,originalId).getStatus()).isEqualTo(InvoiceStatus.PAID);
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isEqualTo(id); em.getTransaction().commit();
            assertThat(notes(em)).isEqualTo(1);
        }
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void successiveCreditsConserveEveryHistoricalTaxCentAndReplayIndependently(boolean batch) {
        if(batch) allocated();
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); var first=refund(em); first.setAmount(new BigDecimal("0.01"));
            var metadata=new HashMap<>(first.getMetadata());
            metadata.putAll(Map.of("managedRefund",true,"cumulativeRefund",true,"originalTransactionRef","TX-original","refundBefore","0","refundAfter","0.01"));
            first.setMetadata(metadata);
            em.find(Intervention.class,364L).setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);em.getTransaction().commit();
            em.getTransaction().begin();Long firstId=service(em).reconcile("REF-test");em.getTransaction().commit();
            em.getTransaction().begin();var second=transaction("REF-second",TransactionType.REFUND);second.setAmount(new BigDecimal("44.99"));second.setProviderTxId("re_second");
            var nextMetadata=new HashMap<>(metadata); nextMetadata.put("refundBefore","0.01"); nextMetadata.put("refundAfter","45.00");
            second.setMetadata(nextMetadata);
            em.persist(second);em.find(Intervention.class,364L).setPaymentStatus(PaymentStatus.REFUNDED);em.getTransaction().commit();em.clear();
            em.getTransaction().begin();Long secondId=service(em).reconcile("REF-second");em.getTransaction().commit();
            var a=em.find(Invoice.class,firstId);var b=em.find(Invoice.class,secondId);
            assertThat(a.getTotalTtc().add(b.getTotalTtc())).isEqualByComparingTo("-45");
            assertThat(a.getTotalTax().add(b.getTotalTax())).isEqualByComparingTo("-6.36");
            assertThat(a.getTotalHt().add(b.getTotalHt())).isEqualByComparingTo("-38.64");
            em.getTransaction().begin();assertThat(service(em).reconcile("REF-test")).isEqualTo(firstId);
            assertThat(service(em).reconcile("REF-second")).isEqualTo(secondId);em.getTransaction().commit();
            assertThat(notes(em)).isEqualTo(2);
        }
    }

    private void allocated() {
        try (var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            var payment=repo(em,PaymentTransactionRepository.class).findByTransactionRef("TX-original").orElseThrow();
            payment.setSourceType("INTERVENTION_BATCH"); payment.setAmount(new BigDecimal("80"));
            payment.setMetadata(Map.of("interventionIds","364,365"));
            var first=new InterventionPaymentAllocation(payment,364L,new BigDecimal("45")); first.confirm(); em.persist(first);
            var second=new InterventionPaymentAllocation(payment,365L,new BigDecimal("35")); second.confirm(); em.persist(second);
            refund(em).setMetadata(Map.of("managedRefund",true,"originalTransactionRef","TX-original","batchAllocationId",first.getId().toString()));
            em.find(Invoice.class,originalId).setPaymentTransactionId(payment.getId());
            em.getTransaction().commit();
        }
    }

    @Test void batchRefundCreditsOnlyTheLinkedMissionInvoice() {
        allocated();
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); Long id=service(em).reconcile("REF-test"); em.getTransaction().commit();
            var note=em.find(Invoice.class,id);
            assertThat(note.getTotalTtc()).isEqualByComparingTo("-45");
            assertThat(note.getInterventionId()).isEqualTo(364L);
            assertThat(note.getOriginalInvoiceId()).isEqualTo(originalId);
            assertThat(note.getLines()).hasSize(2);
            assertThat(repo(em,PaymentTransactionRepository.class).findByTransactionRef("TX-original").orElseThrow().getAmount()).isEqualByComparingTo("80");
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isEqualTo(id); em.getTransaction().commit();
            assertThat(notes(em)).isEqualTo(1);
        }
    }

    @ParameterizedTest @ValueSource(booleans={true,false})
    void batchCreditIgnoresOnlyAnExpiredCheckoutWithProof(boolean proven) {
        allocated();
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            var expired=transaction("TX-expired",TransactionType.CHECKOUT);
            expired.setStatus(TransactionStatus.FAILED); expired.setProviderTxId("cs_expired");
            if(proven) expired.setMetadata(Map.of("standaloneRetryAllowed",true,"expiredSessionId","cs_expired"));
            em.persist(expired); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin();
            if(!proven) {
                assertThatThrownBy(()->service(em).reconcile("REF-test")).hasMessageContaining("Plusieurs encaissements");
                em.getTransaction().rollback(); return;
            }
            Long id=service(em).reconcile("REF-test"); em.getTransaction().commit();
            assertThat(em.find(Invoice.class,id).getTotalTtc()).isEqualByComparingTo("-45");
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isEqualTo(id);
            em.getTransaction().commit(); assertThat(notes(em)).isEqualTo(1L);
        }
    }

    @ParameterizedTest @ValueSource(strings={"another-invoice-payment","wrong-part","partial-part","unconfirmed-part"})
    void batchCreditNoteRequiresExactAllocationAndInvoiceBinding(String scenario) {
        allocated();
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            switch(scenario) {
                case "another-invoice-payment" -> em.find(Invoice.class,originalId).setPaymentTransactionId(999L);
                case "wrong-part" -> { var metadata=new HashMap<>(refund(em).getMetadata()); metadata.put("batchAllocationId","999"); refund(em).setMetadata(metadata); }
                case "partial-part" -> refund(em).setAmount(BigDecimal.TEN);
                case "unconfirmed-part" -> em.createQuery("update InterventionPaymentAllocation a set a.confirmedAt=null").executeUpdate();
            }
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            assertThatThrownBy(() -> service(em).reconcile("REF-test")).isInstanceOf(RuntimeException.class);
            em.getTransaction().rollback(); assertThat(notes(em)).isZero();
        }
    }

    @Test void lateIssuedInvoiceIsBoundToTheConfirmedPartBeforeCreditNoteWithoutANewCollection() {
        allocated();
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); var invoice=em.find(Invoice.class,originalId);
            invoice.setPaymentTransactionId(null); invoice.setStatus(InvoiceStatus.ISSUED); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); Long id=service(em).reconcile("REF-test"); em.getTransaction().commit(); em.clear();
            invoice=em.find(Invoice.class,originalId);
            assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.PAID); assertThat(invoice.getPaidAt()).isNotNull();
            assertThat(invoice.getPaymentTransactionId()).isEqualTo(repo(em,PaymentTransactionRepository.class).findByTransactionRef("TX-original").orElseThrow().getId());
            assertThat(em.find(Invoice.class,id).getTotalTtc()).isEqualByComparingTo("-45");
            assertThat(repo(em,PaymentTransactionRepository.class).count()).isEqualTo(2);
        }
    }

    @Test void createsOneCreditNoteFromHistoricalInvoiceAndKeepsThePaidOriginalImmutable() {
        try (var em = factory.createEntityManager()) {
            Long id = null;
            for (int replay = 0; replay < 2; replay++) {
                em.getTransaction().begin(); var next = service(em).reconcile("REF-test");
                if (id != null) assertThat(next).isEqualTo(id); id = next;
                em.getTransaction().commit(); em.clear();
            }
            var credit = em.find(Invoice.class, id);
            assertThat(credit.getOriginalInvoiceId()).isEqualTo(originalId);
            assertThat(credit.getRefundTransactionId()).isEqualTo(refund(em).getId());
            assertThat(credit.getTotalHt()).isEqualByComparingTo("-38.64");
            assertThat(credit.getTotalTax()).isEqualByComparingTo("-6.36");
            assertThat(credit.getTotalTtc()).isEqualByComparingTo("-45");
            assertThat(credit.getLines()).extracting(InvoiceLine::getTaxRate).containsExactly(new BigDecimal("0.2000"), new BigDecimal("0.1000"));
            assertThat(credit.getLines()).extracting(InvoiceLine::getQuantity).allMatch(q -> q.compareTo(BigDecimal.ONE.negate()) == 0);
            assertThat(credit.getLegalMentions()).contains("FA-ORIGINAL", "2026-03-01", "REF-test", "re_test");
            assertThat(credit.getBuyerName()).isEqualTo("Client test"); assertThat(credit.isImmutable()).isTrue();
            var original = em.find(Invoice.class, originalId);
            assertThat(original.getStatus()).isEqualTo(InvoiceStatus.PAID); assertThat(original.getTotalTtc()).isEqualByComparingTo("45");
            assertThat(original.getPaymentTransactionId()).isNull(); assertThat(notes(em)).isEqualTo(1);
            assertThat(repo(em, InvoiceRepository.class).findByInterventionId(364L)).get().extracting(Invoice::getId).isEqualTo(originalId);
        }
    }

    @ParameterizedTest @ValueSource(strings={"pending","partial","currency","original-org","mission-org","mission-pending","new-session","invoice-amount","invoice-org","invoice-payment","wrong-type","line-tax","second-payment","legacy-note","duplicate-invoice"})
    void refusesUnprovenOrAmbiguousDocuments(String scenario) {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); var refund = refund(em); var invoice = em.find(Invoice.class, originalId); var mission = em.find(Intervention.class, 364L);
            switch (scenario) {
                case "pending" -> refund.setStatus(TransactionStatus.PROCESSING);
                case "partial" -> refund.setAmount(BigDecimal.TEN);
                case "currency" -> refund.setCurrency("USD");
                case "original-org" -> repo(em, PaymentTransactionRepository.class).findByTransactionRef("TX-original").orElseThrow().setOrganizationId(8L);
                case "mission-org" -> mission.setOrganizationId(8L);
                case "mission-pending" -> mission.setPaymentStatus(PaymentStatus.PAID);
                case "new-session" -> mission.setStripeSessionId("cs_new");
                case "invoice-amount" -> invoice.setTotalTtc(BigDecimal.TEN);
                case "invoice-org" -> { when(tenant.getRequiredOrganizationId()).thenReturn(8L); }
                case "invoice-payment" -> invoice.setPaymentTransactionId(999L);
                case "wrong-type" -> invoice.setInvoiceType(InvoiceType.COMMISSION);
                case "line-tax" -> invoice.getLines().getFirst().setTaxAmount(BigDecimal.ZERO);
                case "second-payment" -> em.persist(transaction("TX-second", TransactionType.CHECKOUT));
                case "legacy-note" -> { var c = copyInvoice(); c.setStatus(InvoiceStatus.CREDIT_NOTE); c.setInterventionId(null); c.setLegalMentions("Avoir sur facture FA-ORIGINAL"); em.persist(c); }
                case "duplicate-invoice" -> em.persist(copyInvoice());
            }
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            assertThatThrownBy(() -> service(em).reconcile("REF-test")).isInstanceOf(RuntimeException.class);
            em.getTransaction().rollback(); em.clear();
            assertThat(notes(em)).isEqualTo(scenario.equals("legacy-note") ? 1 : 0);
        }
    }
    Invoice copyInvoice() {
        var i = new Invoice(); i.setOrganizationId(7L); i.setInvoiceNumber("OTHER"); i.setInvoiceDate(LocalDate.now());
        i.setStatus(InvoiceStatus.PAID); i.setInvoiceType(InvoiceType.GUEST); i.setInterventionId(364L);
        i.setTotalHt(new BigDecimal("45")); i.setTotalTax(BigDecimal.ZERO); i.setTotalTtc(new BigDecimal("45")); return i;
    }
    @Test void lateInvoiceIsPickedUpWithoutCreatingAReplacementInvoice() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); em.find(Invoice.class, originalId).setInterventionId(null); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isNull(); em.getTransaction().commit();
            assertThat(notes(em)).isZero();
            em.getTransaction().begin(); em.find(Invoice.class, originalId).setInterventionId(364L);
            assertThat(service(em).reconcile("REF-test")).isNotNull(); em.getTransaction().commit();
            assertThat(notes(em)).isEqualTo(1);
        }
    }
    @Test void insertFailureRollsBackTheCreditAndTheNumberThenRetrySucceeds() {
        try (var em = factory.createEntityManager()) {
            var real = repo(em, InvoiceRepository.class);
            var invoices = mock(InvoiceRepository.class, org.mockito.AdditionalAnswers.delegatesTo(real));
            doAnswer(call -> { real.saveAndFlush(call.getArgument(0)); throw new IllegalStateException("document unavailable"); }).when(invoices).saveAndFlush(any());
            em.getTransaction().begin(); assertThatThrownBy(() -> service(em, invoices).reconcile("REF-test")).hasMessage("document unavailable");
            em.getTransaction().rollback(); em.clear(); assertThat(notes(em)).isZero();
            em.getTransaction().begin(); var id = service(em).reconcile("REF-test"); em.getTransaction().commit(); em.clear();
            assertThat(em.find(Invoice.class, id).getInvoiceNumber()).endsWith("-00001");
            assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.COMPLETED);
        }
    }
    @Test void simultaneousWorkerAndKafkaReuseTheSameCreditNote() throws Exception {
        var started = new CountDownLatch(1);
        try (var first = factory.createEntityManager(); var pool = Executors.newSingleThreadExecutor()) {
            first.getTransaction().begin(); Long id = service(first).reconcile("REF-test");
            var second = pool.submit(() -> {
                try (var em = factory.createEntityManager()) {
                    em.getTransaction().begin(); started.countDown();
                    var note = service(em).reconcile("REF-test"); em.getTransaction().commit(); return note;
                }
            });
            try { assertThat(started.await(2, TimeUnit.SECONDS)).isTrue(); assertThatThrownBy(() -> second.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { first.getTransaction().commit(); }
            assertThat(second.get(5, TimeUnit.SECONDS)).isEqualTo(id); assertThat(notes(first)).isEqualTo(1);
        }
    }

    void booking(String amount) {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            var payment = repo(em, PaymentTransactionRepository.class).findByTransactionRef("TX-original").orElseThrow();
            payment.setSourceType("RESERVATION"); payment.setSourceId(549L);
            var refund = refund(em); refund.setSourceType("BOOKING_CANCELLATION"); refund.setSourceId(549L);
            refund.setAmount(new BigDecimal(amount));
            refund.setMetadata(Map.of("cancellationRefund", true, "originalTransactionRef", "TX-original",
                "originalAmount", "45.00", "checkoutSessionId", "cs_original"));
            var stay = new Reservation(); stay.setId(549L); stay.setOrganizationId(7L); stay.setStatus("cancelled");
            stay.setTotalPrice(new BigDecimal("45")); stay.setCurrency("EUR"); stay.setPaymentCollection(PaymentCollection.PMS);
            stay.setStripeSessionId("cs_original"); stay.setPaymentStatus(new BigDecimal(amount).compareTo(new BigDecimal("45")) == 0
                ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED); em.persist(stay);
            var original = em.find(Invoice.class, originalId); original.setInterventionId(null); original.setReservationId(549L);
            em.getTransaction().commit();
        }
    }

    @ParameterizedTest @ValueSource(strings={"45", "22.50", "0.01", "44.99", "17.19", "19.99"})
    void bookingCreditPreservesEveryCentAndHistoricalTaxWithoutAnotherMoneyMovement(String amount) {
        booking(amount);
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); var id = service(em).reconcile("REF-test"); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isEqualTo(id); em.getTransaction().commit(); em.clear();
            var credit = em.find(Invoice.class, id);
            assertThat(credit.getTotalTtc()).isEqualByComparingTo(new BigDecimal(amount).negate());
            assertThat(credit.getTotalHt().add(credit.getTotalTax())).isEqualByComparingTo(credit.getTotalTtc());
            assertThat(credit.getReservationId()).isEqualTo(549L); assertThat(credit.getInterventionId()).isNull();
            assertThat(credit.getInvoiceType()).isEqualTo(InvoiceType.GUEST); assertThat(credit.getOriginalInvoiceId()).isEqualTo(originalId);
            assertThat(credit.getLines()).allSatisfy(l -> {
                assertThat(l.getTotalTtc()).isNegative();
                assertThat(l.getTotalHt().add(l.getTaxAmount())).isEqualByComparingTo(l.getTotalTtc());
                assertThat(l.getQuantity().multiply(l.getUnitPriceHt())).isEqualByComparingTo(l.getTotalHt());
                assertThat(l.getTaxRate()).isEqualByComparingTo(l.getLineNumber() == 1 ? "0.20" : "0.10");
            });
            assertThat(credit.getLines().stream().map(InvoiceLine::getTotalTtc).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo(credit.getTotalTtc());
            if (amount.equals("22.50")) {
                assertThat(credit.getTotalHt()).isEqualByComparingTo("-19.32");
                assertThat(credit.getTotalTax()).isEqualByComparingTo("-3.18");
                assertThat(credit.getLegalMentions()).contains("partiel au prorata", "FA-ORIGINAL", "REF-test", "re_test");
            }
            assertThat(em.find(Invoice.class, originalId).getStatus()).isEqualTo(InvoiceStatus.PAID);
            assertThat(em.find(Invoice.class, originalId).getTotalTtc()).isEqualByComparingTo("45");
            assertThat(em.createQuery("select count(p) from PaymentTransaction p", Long.class).getSingleResult()).isEqualTo(2);
            assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.COMPLETED); assertThat(notes(em)).isEqualTo(1);
        }
    }

    @ParameterizedTest @ValueSource(strings={"pending", "unmanaged", "review", "late-error", "over-refund", "currency", "stay-org",
        "payment-org", "payment-type", "payment-pending", "wrong-source", "session", "metadata-session", "original-amount", "stay-total",
        "credit", "ota", "stay-active", "stay-paid", "wrong-refund-status", "invoice-amount", "invoice-payment", "invoice-mission",
        "second-payment", "legacy-note", "linked-note", "duplicate-invoice", "line-tax", "negative-line"})
    void bookingAmbiguityNeverCreatesACredit(String scenario) {
        booking("22.50");
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            var refund = refund(em); var stay = em.find(Reservation.class, 549L); var invoice = em.find(Invoice.class, originalId);
            var payment = repo(em, PaymentTransactionRepository.class).findByTransactionRef("TX-original").orElseThrow();
            var metadata = new HashMap<>(refund.getMetadata());
            switch (scenario) {
                case "pending" -> refund.setStatus(TransactionStatus.PROCESSING);
                case "unmanaged" -> metadata.remove("cancellationRefund");
                case "review" -> metadata.put("reviewRequired", true);
                case "late-error" -> refund.setErrorMessage("Rapprochement tardif requis");
                case "over-refund" -> refund.setAmount(new BigDecimal("46"));
                case "currency" -> refund.setCurrency("USD");
                case "stay-org" -> stay.setOrganizationId(8L);
                case "payment-org" -> payment.setOrganizationId(8L);
                case "payment-type" -> payment.setPaymentType(TransactionType.REFUND);
                case "payment-pending" -> payment.setStatus(TransactionStatus.PROCESSING);
                case "wrong-source" -> payment.setSourceType("INTERVENTION");
                case "session" -> stay.setStripeSessionId("cs_other");
                case "metadata-session" -> metadata.put("checkoutSessionId", "cs_other");
                case "original-amount" -> metadata.put("originalAmount", "44");
                case "stay-total" -> stay.setTotalPrice(new BigDecimal("44"));
                case "credit" -> stay.setCreditApplied(BigDecimal.ONE);
                case "ota" -> stay.setPaymentCollection(PaymentCollection.CHANNEL);
                case "stay-active" -> stay.setStatus("confirmed");
                case "stay-paid" -> stay.setPaymentStatus(PaymentStatus.PAID);
                case "wrong-refund-status" -> stay.setPaymentStatus(PaymentStatus.REFUNDED);
                case "invoice-amount" -> invoice.setTotalTtc(BigDecimal.TEN);
                case "invoice-payment" -> invoice.setPaymentTransactionId(999L);
                case "invoice-mission" -> invoice.setInterventionId(364L);
                case "second-payment" -> { var other = transaction("TX-second", TransactionType.CHECKOUT); other.setSourceType("BOOKING_BALANCE"); other.setSourceId(549L); em.persist(other); }
                case "legacy-note", "linked-note", "duplicate-invoice" -> {
                    var other = copyInvoice(); other.setInterventionId(null); other.setReservationId(549L);
                    if (!scenario.equals("duplicate-invoice")) other.setStatus(InvoiceStatus.CREDIT_NOTE);
                    if (scenario.equals("linked-note")) other.setOriginalInvoiceId(originalId);
                    em.persist(other);
                }
                case "line-tax" -> invoice.getLines().getFirst().setTaxAmount(BigDecimal.ZERO);
                case "negative-line" -> { var l = invoice.getLines().getFirst(); l.setTotalHt(new BigDecimal("-1")); l.setTaxAmount(new BigDecimal("31")); }
            }
            refund.setMetadata(metadata); em.getTransaction().commit(); em.clear();
            long before = notes(em); em.getTransaction().begin();
            assertThatThrownBy(() -> service(em).reconcile("REF-test")).isInstanceOf(RuntimeException.class);
            em.getTransaction().rollback(); em.clear(); assertThat(notes(em)).isEqualTo(before);
        }
    }

    @Test void commissionIsNotCreditedAndLateGuestInvoiceIsFound() {
        booking("22.50");
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); var original = em.find(Invoice.class, originalId);
            original.setInvoiceType(InvoiceType.COMMISSION); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isNull(); em.getTransaction().commit();
            em.getTransaction().begin(); original = em.find(Invoice.class, originalId); original.setInvoiceType(InvoiceType.GUEST);
            var commission = copyInvoice(); commission.setInterventionId(null); commission.setReservationId(549L);
            commission.setInvoiceType(InvoiceType.COMMISSION); em.persist(commission); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); assertThat(service(em).reconcile("REF-test")).isNotNull(); em.getTransaction().commit();
            assertThat(notes(em)).isEqualTo(1);
        }
    }

    @Test void bookingDocumentFailureRollsBackNumberAndCanBeRetried() {
        booking("22.50");
        insertFailureRollsBackTheCreditAndTheNumberThenRetrySucceeds();
    }

    @Test void bookingWorkerWaitsForTheFinancialReservationLockAndReusesTheDocument() throws Exception {
        booking("22.50");
        var started = new CountDownLatch(1);
        try (var first = factory.createEntityManager(); var pool = Executors.newSingleThreadExecutor()) {
            first.getTransaction().begin(); first.find(Reservation.class, 549L, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            var second = pool.submit(() -> {
                try (var em = factory.createEntityManager()) {
                    em.getTransaction().begin(); started.countDown();
                    var id = service(em).reconcile("REF-test"); em.getTransaction().commit(); return id;
                }
            });
            try { assertThat(started.await(2, TimeUnit.SECONDS)).isTrue(); assertThatThrownBy(() -> second.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { first.getTransaction().commit(); }
            Long id = second.get(5, TimeUnit.SECONDS);
            first.getTransaction().begin(); assertThat(service(first).reconcile("REF-test")).isEqualTo(id); first.getTransaction().commit();
            assertThat(notes(first)).isEqualTo(1);
        }
    }
}
