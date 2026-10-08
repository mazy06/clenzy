package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.Query;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** La relance reste utilisable après fermeture de la session de lecture. */
class BaitlyPayoutMissionLoadingTest {
    static SessionFactory factory;

    @BeforeAll static void start() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, Intervention.class, Set.of("organizationId"));
        RefundCreditNotePersistenceTest.mapping(xml, ServiceRequest.class, Set.of("organizationId", "convertedInterventionId"));
        RefundCreditNotePersistenceTest.mapping(xml, User.class, Set.of("firstName"));
        xml.append("</entity-mappings>");
        String mappings = xml.toString()
                .replace("<transient name=\"assignedUser\"/>", "<many-to-one name=\"assignedUser\" fetch=\"LAZY\"/>")
                .replace("<transient name=\"serviceRequest\"/>", "<many-to-one name=\"serviceRequest\" fetch=\"LAZY\"/>");
        factory = new Configuration().addPackage("com.clenzy.model")
                .addInputStream(new ByteArrayInputStream(mappings.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:payoutloading;MODE=PostgreSQL")
                .setProperty("jakarta.persistence.validation.mode", "none")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("hibernate.globally_quoted_identifiers", "true")
                .buildSessionFactory();
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            var user = new User(); user.setId(3L); user.setFirstName("Jean"); em.persist(user);
            var need = new ServiceRequest(); need.setId(221L); need.setOrganizationId(2L);
            need.setConvertedInterventionId(352L); em.persist(need);
            var mission = new Intervention(); mission.setId(352L); mission.setOrganizationId(2L);
            mission.setAssignedUser(user); mission.setServiceRequest(need); em.persist(mission);
            em.getTransaction().commit();
        }
    }

    @AfterAll static void stop() { if (factory != null) factory.close(); }

    @Test void payoutQueryLoadsNeededRelationsBeforeDetachment() throws Exception {
        Intervention mission;
        try (var em = factory.createEntityManager()) {
            mission = em.createQuery(query(), Intervention.class)
                    .setParameter("id", 352L).setParameter("orgId", 2L).getSingleResult();
        }
        assertThat(mission.getServiceRequest().getOrganizationId()).isEqualTo(2L);
        assertThat(mission.getServiceRequest().getConvertedInterventionId()).isEqualTo(352L);
        assertThat(mission.getAssignedUser().getFirstName()).isEqualTo("Jean");
    }

    @Test void payoutQueryNeverLoadsAnotherOrganizationsMission() throws Exception {
        try (var em = factory.createEntityManager()) {
            assertThat(em.createQuery(query(), Intervention.class)
                    .setParameter("id", 352L).setParameter("orgId", 7L).getResultList()).isEmpty();
        }
    }

    private String query() throws Exception {
        return InterventionRepository.class.getMethod("findForPayout", Long.class, Long.class)
                .getAnnotation(Query.class).value();
    }
}
