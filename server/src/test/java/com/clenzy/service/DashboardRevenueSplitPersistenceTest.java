package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.DashboardRevenueSplitRepository;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import static org.assertj.core.api.Assertions.*;

/** Exécute les vraies requêtes JPQL sans conteneur ni données applicatives. */
class DashboardRevenueSplitPersistenceTest {
    static SessionFactory factory;
    @BeforeAll static void start() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, User.class, Set.of("keycloakId"));
        RefundCreditNotePersistenceTest.mapping(xml, Property.class, Set.of("organizationId"));
        RefundCreditNotePersistenceTest.mapping(xml, Reservation.class, Set.of("organizationId", "checkIn", "checkOut", "totalPrice", "otaFeeAmount", "source", "currency", "status", "hiddenFromPlanning"));
        RefundCreditNotePersistenceTest.mapping(xml, Intervention.class, Set.of("organizationId", "scheduledDate", "actualCost", "estimatedCost"));
        RefundCreditNotePersistenceTest.mapping(xml, OwnerPayout.class, Set.of("organizationId", "ownerId", "periodStart", "netAmount", "status"));
        xml.append("</entity-mappings>");
        String mapping = xml.toString().replace("<transient name=\"owner\"/>", "<many-to-one name=\"owner\" fetch=\"LAZY\"/>")
            .replace("<transient name=\"property\"/>", "<many-to-one name=\"property\" fetch=\"LAZY\"/>")
            .replace("<transient name=\"intervention\"/>", "<many-to-one name=\"intervention\" fetch=\"LAZY\"/>");
        factory = new Configuration().addPackage("com.clenzy.model")
            .addInputStream(new ByteArrayInputStream(mapping.getBytes(StandardCharsets.UTF_8)))
            .setProperty("hibernate.connection.url", "jdbc:h2:mem:dashboardrevenue;MODE=PostgreSQL")
            .setProperty("jakarta.persistence.validation.mode", "none")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop")
            .setProperty("hibernate.globally_quoted_identifiers", "true")
            .setProperty("hibernate.generate_statistics", "true").buildSessionFactory();
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            var a = new User(); a.setId(1L); a.setKeycloakId("owner-a"); em.persist(a);
            var b = new User(); b.setId(2L); b.setKeycloakId("owner-b"); em.persist(b);
            var p = new Property(); p.setId(1L); p.setOrganizationId(7L); p.setOwner(a); em.persist(p);
            var q = new Property(); q.setId(2L); q.setOrganizationId(7L); q.setOwner(b); em.persist(q);
            var foreign = new Property(); foreign.setId(3L); foreign.setOrganizationId(9L); foreign.setOwner(a); em.persist(foreign);
            em.persist(stay(1, p, "2025-12-31", "2026-02-02", "330", "33"));
            em.persist(stay(2, q, "2026-01-01", "2026-01-03", "200", "0"));
            em.persist(stay(3, foreign, "2026-01-01", "2026-01-03", "9999", "0"));
            var cancelled = stay(4, p, "2026-01-01", "2026-01-03", "9999", "0");
            cancelled.setStatus("cancelled"); cancelled.setHiddenFromPlanning(true);
            var hiddenCost = cost(3, p, "777"); em.persist(hiddenCost); cancelled.setIntervention(hiddenCost); em.persist(cancelled);
            em.persist(cost(1, p, "20"));
            var estimated = cost(2, q, "10"); estimated.setActualCost(null); estimated.setEstimatedCost(new BigDecimal("10"));
            em.persist(estimated); em.persist(cost(4, foreign, "9999"));
            long id = 1;
            for (var status : OwnerPayout.PayoutStatus.values())
                em.persist(payout(id++, 7, 1, "2026-01-01", status, status == OwnerPayout.PayoutStatus.PAID ? "100" : status == OwnerPayout.PayoutStatus.APPROVED ? "20" : status == OwnerPayout.PayoutStatus.PROCESSING ? "5" : "999"));
            em.persist(payout(id++, 7, 2, "2026-01-01", OwnerPayout.PayoutStatus.PAID, "50"));
            em.persist(payout(id++, 9, 1, "2026-01-01", OwnerPayout.PayoutStatus.PAID, "9999"));
            em.persist(payout(id++, 7, 1, "2025-01-01", OwnerPayout.PayoutStatus.PAID, "9999"));
            em.persist(payout(id, 7, 1, "2026-02-01", OwnerPayout.PayoutStatus.PAID, "500"));
            em.getTransaction().commit();
        }
    }
    @AfterAll static void stop() { if (factory != null) factory.close(); }

    @Test void ownerSummaryUsesThreeQueriesWithoutHydratingEntities() {
        try (var em = factory.createEntityManager()) {
            var repo = new JpaRepositoryFactory(em).getRepository(DashboardRevenueSplitRepository.class);
            factory.getStatistics().clear();
            var rows = new DashboardRevenueSplitService(repo, new ChannelCommissionResolver()).getYear(7L, 2026, UserRole.HOST, "owner-a");
            assertThat(rows).hasSize(12);
            var jan = rows.getFirst();
            assertThat(jan.revenue()).isEqualByComparingTo("310");
            assertThat(jan.fees()).isEqualByComparingTo("31");
            assertThat(jan.interventions()).isEqualByComparingTo("20");
            assertThat(jan.payout()).isEqualByComparingTo("125");
            assertThat(jan.retained()).isEqualByComparingTo("134");
            assertThat(rows.get(1).revenue()).isEqualByComparingTo("10");
            assertThat(rows.get(1).retained()).isEqualByComparingTo("-491");
            assertThat(factory.getStatistics().getPrepareStatementCount()).isEqualTo(3);
            assertThat(factory.getStatistics().getEntityLoadCount()).isZero();
        }
    }
    @Test void staffSeesOnlyTheirOrganizationAndEmptyYearsKeepTwelveMonths() {
        try (var em = factory.createEntityManager()) {
            var service = new DashboardRevenueSplitService(new JpaRepositoryFactory(em).getRepository(DashboardRevenueSplitRepository.class), new ChannelCommissionResolver());
            var staff = service.getYear(7L, 2026, UserRole.SUPER_ADMIN, "staff").getFirst();
            assertThat(staff.revenue()).isEqualByComparingTo("510");
            assertThat(staff.interventions()).isEqualByComparingTo("30");
            assertThat(service.getYear(7L, 2026, UserRole.PROPERTY_OWNER, "owner-b").getFirst().payout()).isEqualByComparingTo("50");
            var empty = service.getYear(7L, 2024, UserRole.HOST, "owner-a");
            assertThat(empty).hasSize(12).allSatisfy(row -> assertThat(row.revenue()).isZero());
            assertThatThrownBy(() -> service.getYear(7L, 10000, UserRole.HOST, "owner-a")).isInstanceOf(IllegalArgumentException.class);
        }
    }
    static Reservation stay(long id, Property p, String from, String to, String price, String fee) {
        var r = new Reservation(); r.setId(id); r.setOrganizationId(p.getOrganizationId()); r.setProperty(p);
        r.setCheckIn(LocalDate.parse(from)); r.setCheckOut(LocalDate.parse(to)); r.setTotalPrice(new BigDecimal(price));
        r.setOtaFeeAmount(new BigDecimal(fee)); r.setCurrency("EUR"); r.setStatus("confirmed"); return r;
    }
    static Intervention cost(long id, Property p, String amount) {
        var i = new Intervention(); i.setId(id); i.setOrganizationId(p.getOrganizationId()); i.setProperty(p);
        i.setScheduledDate(LocalDate.of(2026, 1, 10).atStartOfDay()); i.setActualCost(new BigDecimal(amount)); i.setEstimatedCost(new BigDecimal("99")); return i;
    }
    static OwnerPayout payout(long id, long org, long owner, String date, OwnerPayout.PayoutStatus status, String amount) {
        var p = new OwnerPayout(); p.setId(id); p.setOrganizationId(org); p.setOwnerId(owner);
        p.setPeriodStart(LocalDate.parse(date)); p.setStatus(status); p.setNetAmount(new BigDecimal(amount)); return p;
    }
}
