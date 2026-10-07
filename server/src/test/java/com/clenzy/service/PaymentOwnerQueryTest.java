package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/** Exécute le HQL de production sur H2, avec deux propriétaires et deux organisations. */
class PaymentOwnerQueryTest {
    static SessionFactory factory;
    jakarta.persistence.EntityManager em;

    @BeforeAll static void mappings() {
        Map<Class<?>, Set<String>> fields = new LinkedHashMap<>();
        fields.put(User.class, Set.of("id"));
        fields.put(Property.class, Set.of("id"));
        fields.put(Guest.class, Set.of("id"));
        fields.put(Reservation.class, Set.of("id", "organizationId", "totalPrice", "paymentStatus", "createdAt"));
        fields.put(ServiceRequest.class, Set.of("id", "organizationId", "estimatedCost", "status"));
        Map<Class<?>, Set<String>> relations = Map.of(Property.class, Set.of("owner"),
                Reservation.class, Set.of("property", "guest"), ServiceRequest.class, Set.of("user"));
        StringBuilder xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        fields.forEach((type, basics) -> {
            xml.append("<entity class=\"").append(type.getName()).append("\" access=\"FIELD\" metadata-complete=\"true\"><table name=\"payment_")
                    .append(type.getSimpleName()).append("\"/><attributes><id name=\"id\"/>");
            for (var field : type.getDeclaredFields()) {
                String name = field.getName();
                if (Modifier.isStatic(field.getModifiers()) || name.equals("id")) continue;
                if (basics.contains(name)) {
                    xml.append("<basic name=\"").append(name).append("\">");
                    if (field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                    xml.append("</basic>");
                } else if (relations.getOrDefault(type, Set.of()).contains(name)) {
                    xml.append("<many-to-one name=\"").append(name).append("\"/>");
                } else xml.append("<transient name=\"").append(name).append("\"/>");
            }
            xml.append("</attributes></entity>");
        });
        xml.append("</entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model")
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:paymentowners;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none").buildSessionFactory();
    }

    @AfterAll static void close() { if (factory != null) factory.close(); }
    @BeforeEach void seed() {
        em = factory.createEntityManager(); em.getTransaction().begin();
        var owner = new User(); owner.setId(42L); em.persist(owner);
        var other = new User(); other.setId(43L); em.persist(other);
        row(1L, 7L, owner); row(2L, 7L, other); row(3L, 8L, owner); row(4L, 7L, null);
        em.flush(); em.clear();
    }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }

    void row(long id, long org, User owner) {
        var property = new Property(); property.setId(id); property.setOwner(owner); em.persist(property);
        var r = new Reservation(); r.setId(id); r.setOrganizationId(org); r.setProperty(property);
        r.setTotalPrice(BigDecimal.TEN); r.setPaymentStatus(PaymentStatus.PAID); r.setCreatedAt(LocalDateTime.now()); em.persist(r);
        var sr = new ServiceRequest(); sr.setId(id); sr.setOrganizationId(org); sr.setUser(owner);
        sr.setStatus(RequestStatus.AWAITING_PAYMENT); sr.setEstimatedCost(BigDecimal.TEN); em.persist(sr);
    }

    @Test void reservationHistoryAndSummaryShareOwnerAndOrganizationScope() throws Exception {
        String history = ReservationRepository.class.getMethod("findPaymentHistory", PaymentStatus.class, Long.class, Pageable.class, Long.class)
                .getAnnotation(Query.class).value();
        String summary = ReservationRepository.class.getMethod("findAllWithPayment", Long.class, Long.class)
                .getAnnotation(Query.class).value();
        for (String hql : List.of(history, summary)) {
            var query = em.createQuery(hql, Reservation.class).setParameter("orgId", 7L);
            if (hql.equals(history)) query.setParameter("status", null);
            assertThat(query.setParameter("hostId", 42L).getResultList()).extracting(Reservation::getId).containsExactly(1L);
            assertThat(query.setParameter("hostId", 43L).getResultList()).extracting(Reservation::getId).containsExactly(2L);
            assertThat(query.setParameter("hostId", null).getResultList()).extracting(Reservation::getId).containsExactlyInAnyOrder(1L, 2L, 4L);
        }
    }

    @Test void serviceRequestSummaryFiltersBeforeReturningRows() throws Exception {
        String hql = ServiceRequestRepository.class.getMethod("findAwaitingPaymentForHost", Long.class, Long.class)
                .getAnnotation(Query.class).value();
        var query = em.createQuery(hql, ServiceRequest.class).setParameter("orgId", 7L);
        assertThat(query.setParameter("hostId", 42L).getResultList()).extracting(ServiceRequest::getId).containsExactly(1L);
        assertThat(query.setParameter("hostId", null).getResultList()).extracting(ServiceRequest::getId).containsExactlyInAnyOrder(1L, 2L, 4L);
    }
}
