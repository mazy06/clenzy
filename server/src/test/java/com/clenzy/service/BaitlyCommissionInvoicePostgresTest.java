package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Transactions et verrous PostgreSQL réels ; fiscalité et numérotation remplacées par des fixtures. */
@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyCommissionInvoicePostgresTest {
    static SessionFactory factory;
    static String url, user, schema;
    final AtomicInteger generated = new AtomicInteger();

    @BeforeAll static void mapping() throws Exception {
        url = System.getProperty("baitly.test.jdbc"); user = System.getProperty("baitly.test.user", "postgres");
        schema = "baitly_commission_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, ""); var s = c.createStatement()) {
            s.execute("CREATE SCHEMA " + schema);
        }
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, Reservation.class, Set.of("organizationId"));
        RefundCreditNotePersistenceTest.mapping(xml, Property.class, Set.of("organizationId"));
        // Conserver la vraie association et recharger le logement depuis la réservation verrouillée.
        var mapped = xml.append("</entity-mappings>").toString()
                .replace("<transient name=\"property\"/>", "<many-to-one name=\"property\" target-entity=\"com.clenzy.model.Property\"/>");
        factory = new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class)
                .addInputStream(new ByteArrayInputStream(mapped.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema)
                .setProperty("hibernate.connection.username", user)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none").buildSessionFactory();
    }
    @AfterAll static void close() throws Exception {
        if (factory != null) factory.close();
        if (schema != null) try (var c = DriverManager.getConnection(url, user, ""); var s = c.createStatement()) {
            s.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }
    static <T> T tx(Function<EntityManager, T> work) {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            try { T result = work.apply(em); em.getTransaction().commit(); return result; }
            catch (RuntimeException e) { em.getTransaction().rollback(); throw e; }
        }
    }
    @BeforeEach void seed() {
        tx(em -> {
            for (String name : List.of("InvoiceLine", "Invoice", "Reservation", "Property")) em.createQuery("delete from " + name).executeUpdate();
            var property = new Property(); property.setId(70L); property.setOrganizationId(7L); em.persist(property);
            var stay = new Reservation(); stay.setId(700L); stay.setOrganizationId(7L); stay.setProperty(property); em.persist(stay);
            return null;
        });
    }
    CommissionInvoiceService service(EntityManager em, ManagementContract.PaymentModel model) {
        var generator = mock(InvoiceGeneratorService.class);
        when(generator.generateCommissionFromReservation(any(), any(), eq(7L))).thenAnswer(call -> {
            generated.incrementAndGet();
            var invoice = new Invoice(); invoice.setOrganizationId(7L); invoice.setReservationId(700L);
            invoice.setInvoiceNumber("DRAFT-test"); invoice.setInvoiceDate(LocalDate.now()); invoice.setInvoiceType(InvoiceType.COMMISSION);
            invoice.setTotalHt(new BigDecimal("200")); invoice.setTotalTax(new BigDecimal("40")); invoice.setTotalTtc(new BigDecimal("240"));
            em.persist(invoice); return invoice;
        });
        var numbering = mock(InvoiceNumberingService.class); when(numbering.generateNextNumber(7L)).thenReturn("FA-test-1");
        var fiscal = mock(FiscalProfileRepository.class); when(fiscal.findByOrganizationId(7L)).thenReturn(Optional.of(new FiscalProfile()));
        var contract = new ManagementContract(); contract.setPaymentModel(model); contract.setCommissionRate(new BigDecimal("0.20"));
        var contracts = mock(ManagementContractService.class); when(contracts.getActiveContract(70L, 7L)).thenReturn(Optional.of(contract));
        return new CommissionInvoiceService(generator, numbering, new JpaRepositoryFactory(em).getRepository(InvoiceRepository.class), fiscal, contracts, em);
    }
    Reservation incoming(Long org) { var r = new Reservation(); r.setId(700L); r.setOrganizationId(org); return r; }

    @Test void concurrentOtaImportsProduceOneUnpaidCommissionAndNeverInventMoney() throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CyclicBarrier(2);
            Callable<Invoice> importReservation = () -> {
                ready.await(5, TimeUnit.SECONDS);
                return tx(em -> service(em, ManagementContract.PaymentModel.CONCIERGE_COLLECTS).generateForReservation(incoming(7L)));
            };
            var first = pool.submit(importReservation); var second = pool.submit(importReservation);
            var results = Arrays.asList(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
            assertThat(results.stream().filter(Objects::nonNull)).hasSize(1);
        }
        tx(em -> {
            var rows = em.createQuery("from Invoice", Invoice.class).getResultList(); assertThat(rows).hasSize(1);
            var invoice = rows.getFirst();
            assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(invoice.getPaidAt()).isNull(); assertThat(invoice.getPaymentTransactionId()).isNull();
            assertThat(invoice.getPaymentMethod()).isEqualTo("RETENUE_REVERSEMENT");
            assertThat(invoice.getDueDate()).isNull(); assertThat(invoice.getTotalTtc()).isEqualByComparingTo("240");
            return null;
        });
        assertThat(generated).hasValue(1);
    }
    @Test void foreignOrganizationCannotInvoiceTheReservation() {
        assertThatThrownBy(() -> tx(em -> service(em, ManagementContract.PaymentModel.OWNER_COLLECTS)
                .generateForReservation(incoming(8L)))).hasMessageContaining("inaccessible");
        assertThat(generated).hasValue(0);
        assertThat((long) tx(em -> em.createQuery("select count(i) from Invoice i", Long.class).getSingleResult())).isZero();
    }
    @Test void rollbackDoesNotLeaveADraftOrBlockTheNextImport() {
        assertThatThrownBy(() -> tx(em -> {
            service(em, ManagementContract.PaymentModel.OWNER_COLLECTS).generateForReservation(incoming(7L));
            throw new IllegalStateException("Incident simulé après génération");
        })).hasMessageContaining("Incident simulé");
        assertThat((long) tx(em -> em.createQuery("select count(i) from Invoice i", Long.class).getSingleResult())).isZero();
        var invoice = tx(em -> service(em, ManagementContract.PaymentModel.OWNER_COLLECTS).generateForReservation(incoming(7L)));
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
        assertThat(invoice.getPaymentMethod()).isNull(); assertThat(invoice.getPaidAt()).isNull();
    }
}
