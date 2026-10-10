package com.clenzy.service;

import com.clenzy.dto.BaitlyPlanningReservationIndex;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

/** Vraies projections et prédicats d'isolation, sur H2, sans Docker. */
class BaitlyPlanningReadQueriesTest {
    static SessionFactory sessions;
    EntityManager em;

    @BeforeAll static void mapping() {
        String xml = "<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">"
                + entity(User.class, "users", Set.of("firstName", "lastName", "keycloakId"), Map.of())
                + entity(Property.class, "properties", Set.of("organizationId", "name", "address", "city", "maxGuests", "type",
                    "nightlyPrice", "minimumNights", "defaultCheckInTime", "defaultCheckOutTime", "cleaningFrequency",
                    "cleaningBasePrice", "defaultCurrency", "latitude", "longitude", "createdAt"), Map.of("owner", User.class))
                + entity(Reservation.class, "reservations", Set.of("organizationId", "guestName", "guestCount", "checkIn", "checkOut",
                    "checkInTime", "checkOutTime", "status", "source", "sourceName", "totalPrice", "paymentStatus", "paymentCollection",
                    "hiddenFromPlanning"), Map.of("property", Property.class))
                + entity(PropertyPhoto.class, "property_photos", Set.of("organizationId", "propertyId", "externalUrl", "sortOrder"), Map.of())
                + "</entity-mappings>";
        sessions = new Configuration().addPackage("com.clenzy.model")
                .addInputStream(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:baitly_planning_reads;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none")
                .setProperty("hibernate.generate_statistics", "true").buildSessionFactory();
    }

    static String entity(Class<?> type, String table, Set<String> basic, Map<String, Class<?>> relations) {
        var xml = new StringBuilder("<entity class=\"").append(type.getName())
                .append("\" access=\"FIELD\" metadata-complete=\"true\"><table name=\"").append(table)
                .append("\"/><attributes><id name=\"id\"/>");
        for (var field : type.getDeclaredFields()) {
            String name = field.getName();
            if (Modifier.isStatic(field.getModifiers()) || name.equals("id")) continue;
            if (relations.containsKey(name)) {
                xml.append("<many-to-one name=\"").append(name).append("\" target-entity=\"")
                        .append(relations.get(name).getName()).append("\"><join-column name=\"")
                        .append(name).append("_id\"/></many-to-one>");
            } else if (basic.contains(name)) {
                xml.append("<basic name=\"").append(name).append("\">");
                if (name.equals("organizationId")) xml.append("<column name=\"organization_id\"/>");
                if (field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                xml.append("</basic>");
            } else xml.append("<transient name=\"").append(name).append("\"/>");
        }
        return xml.append("</attributes></entity>").toString();
    }

    @AfterAll static void close() { if (sessions != null) sessions.close(); }
    @BeforeEach void setup() { em = sessions.createEntityManager(); em.getTransaction().begin(); }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }

    User owner(long id, String kc) {
        User user = new User(); user.setId(id); user.setKeycloakId(kc); user.setFirstName("Alice"); user.setLastName("Martin");
        em.persist(user); return user;
    }
    Property property(long id, long org, User owner) {
        Property p = new Property(); p.setId(id); p.setOrganizationId(org); p.setOwner(owner); p.setName("Logement " + id);
        p.setAddress("Adresse"); p.setCreatedAt(LocalDateTime.of(2026, 10, 1, 0, 0)); em.persist(p); return p;
    }

    @Test void cataloguePaginationAndOwnerScopeAreAppliedInSqlBeyondThousandProperties() throws Exception {
        User host = owner(1, "host"), other = owner(2, "other");
        for (int i = 1; i <= 1101; i++) property(i, 1, host);
        property(2000, 1, other); property(2001, 2, host);
        em.flush(); em.clear();
        Query annotation = PropertyRepository.class.getMethod("findBaitlyPlanningProperties", Long.class, String.class, Pageable.class).getAnnotation(Query.class);
        var rows = em.createQuery(annotation.value(), Tuple.class).setParameter("orgId", 1L).setParameter("ownerKc", "host")
                .setFirstResult(1000).setMaxResults(200).getResultList();
        assertThat(rows).hasSize(101);
        assertThat(rows.getFirst().get("ownerFirstName")).isEqualTo("Alice");
        assertThat(em.createQuery(annotation.countQuery(), Long.class).setParameter("orgId", 1L).setParameter("ownerKc", "host")
                .getSingleResult()).isEqualTo(1101);
    }

    @Test void indexUsesTheRealConstructorAndExcludesHiddenForeignAndOutOfRangeStays() throws Exception {
        User host = owner(1, "host"); Property p = property(1, 1, host), foreign = property(2, 2, host);
        for (int i = 1; i <= 4; i++) {
            Reservation r = new Reservation(); r.setId((long)i); r.setOrganizationId(i == 3 ? 2L : 1L);
            r.setProperty(i == 3 ? foreign : p); r.setGuestName("Voyageur"); r.setGuestCount(2);
            r.setCheckIn(LocalDate.of(2026, 10, i == 4 ? 20 : 1)); r.setCheckOut(LocalDate.of(2026, 10, 25));
            r.setStatus("confirmed"); r.setSource("airbnb"); r.setPaymentStatus(PaymentStatus.PAID);
            r.setPaymentCollection(PaymentCollection.CHANNEL); r.setHiddenFromPlanning(i == 2); em.persist(r);
        }
        em.flush(); em.clear();
        var query = ReservationRepository.class.getMethod("findBaitlyPlanningIndex", Collection.class, LocalDate.class, LocalDate.class, Long.class)
                .getAnnotation(Query.class).value();
        sessions.getStatistics().clear();
        var rows = em.createQuery(query, BaitlyPlanningReservationIndex.class).setParameter("propertyIds", List.of(1L, 2L))
                .setParameter("orgId", 1L).setParameter("from", LocalDate.of(2026, 10, 5)).setParameter("to", LocalDate.of(2026, 10, 10)).getResultList();
        assertThat(rows).singleElement().satisfies(row -> { assertThat(row.id()).isEqualTo(1L); assertThat(row.collectedByChannel()).isTrue(); });
        assertThat(sessions.getStatistics().getPrepareStatementCount()).isEqualTo(1);
        assertThat(sessions.getStatistics().getEntityLoadCount()).isZero();
    }

    @Test void accessProjectionIncludesOrganizationForTheServiceGuardWithoutHydratingProperties() throws Exception {
        User host = owner(1, "host"); property(1, 1, host); property(2, 2, host); em.flush(); em.clear();
        sessions.getStatistics().clear();
        String sql = PropertyRepository.class.getMethod("findBaitlyPropertyAccess", Collection.class).getAnnotation(Query.class).value();
        var rows = em.createNativeQuery(sql).setParameter("ids", List.of(1L, 2L)).getResultList();
        assertThat(rows).hasSize(2);
        assertThat(sessions.getStatistics().getEntityLoadCount()).isZero();
    }
}
