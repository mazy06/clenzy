package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.sql.DriverManager;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Vérifie filtrage, pagination et compteurs sur PostgreSQL, hors migrations et RLS. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceQuoteInboxPostgresTest {
    @Test void onlyCurrentTeamsAndIndividualRequestsContributeToPagesAndCounts() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_quote_inbox_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(url, user, ""); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
            try (var sessions = new Configuration().addAnnotatedClass(MarketplaceQuoteRequest.class)
                    .setProperty("hibernate.connection.url", url)
                    .setProperty("hibernate.connection.username", user)
                    .setProperty("hibernate.default_schema", schema)
                    .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory();
                 var em = sessions.createEntityManager()) {
                em.getTransaction().begin();
                em.createNativeQuery("CREATE TABLE "+schema+".users(id bigint PRIMARY KEY,keycloak_id text)").executeUpdate();
                em.createNativeQuery("CREATE TABLE "+schema+".properties(id bigint PRIMARY KEY,organization_id bigint,owner_id bigint)").executeUpdate();
                em.createNativeQuery("INSERT INTO "+schema+".users VALUES(22,'owner'),(23,'other')").executeUpdate();
                em.createNativeQuery("INSERT INTO "+schema+".properties VALUES(42,7,22),(43,7,23)").executeUpdate();
                var individual = request(1L, null, QuoteRequestStatus.SENT);
                var currentTeam = request(1L, 77L, QuoteRequestStatus.SENT);
                var formerTeam = request(1L, 78L, QuoteRequestStatus.SENT);
                var otherProvider = request(2L, 77L, QuoteRequestStatus.SENT);
                var accepted = request(1L, 77L, QuoteRequestStatus.ACCEPTED);
                individual.setPropertyId(42L);
                currentTeam.setRequestedByUserId(22L);
                formerTeam.setPropertyId(43L);
                otherProvider.setPropertyId(43L);
                accepted.setPropertyId(43L);
                for (var request : List.of(individual, currentTeam, formerTeam, otherProvider, accepted)) em.persist(request);
                em.getTransaction().commit();
                var repository = new JpaRepositoryFactory(em).getRepository(MarketplaceQuoteRequestRepository.class);

                var first = repository.findAccessibleForProvider(1L, List.of(77L), List.of(QuoteRequestStatus.SENT), PageRequest.of(0, 1));
                assertThat(first.getTotalElements()).isEqualTo(2);
                assertThat(first.getContent()).extracting(MarketplaceQuoteRequest::getId).containsExactly(currentTeam.getId());
                var second = repository.findAccessibleForProvider(1L, List.of(77L), List.of(QuoteRequestStatus.SENT), PageRequest.of(1, 1));
                assertThat(second.getContent()).extracting(MarketplaceQuoteRequest::getId).containsExactly(individual.getId());
                assertThat(repository.countAccessibleForProvider(1L, List.of(77L), QuoteRequestStatus.SENT)).isEqualTo(2);

                // Après départ de la dernière équipe, les demandes individuelles restent accessibles.
                var afterDeparture = repository.findAccessibleForProvider(1L, List.of(), List.of(QuoteRequestStatus.values()), PageRequest.of(0, 1));
                assertThat(afterDeparture.getTotalElements()).isEqualTo(1);
                assertThat(afterDeparture.getContent()).extracting(MarketplaceQuoteRequest::getId).containsExactly(individual.getId());
                assertThat(repository.countAccessibleForProvider(1L, List.of(), QuoteRequestStatus.SENT)).isEqualTo(1);
                var allStatuses = repository.findAccessibleForProvider(1L, List.of(77L), List.of(QuoteRequestStatus.values()), PageRequest.of(0, 1));
                assertThat(allStatuses.getTotalElements()).isEqualTo(3);
                assertThat(allStatuses.getContent()).extracting(MarketplaceQuoteRequest::getId).containsExactly(accepted.getId());
                em.getTransaction().begin();
                em.createNativeQuery("SET LOCAL search_path TO "+schema).executeUpdate();
                var own=repository.findAccessibleForRequester(7L,22L,"owner",false,List.of("SENT","ACCEPTED"),PageRequest.of(0,1));
                assertThat(own.getTotalElements()).isEqualTo(2);
                assertThat(own.getContent()).extracting(MarketplaceQuoteRequest::getId).containsExactly(currentTeam.getId());
                var staff=repository.findAccessibleForRequester(7L,22L,"owner",true,List.of("SENT","ACCEPTED"),PageRequest.of(0,1));
                assertThat(staff.getTotalElements()).isEqualTo(5);
                var foreign=repository.findAccessibleForRequester(8L,22L,"owner",true,List.of("SENT","ACCEPTED"),PageRequest.of(0,1));
                assertThat(foreign.getTotalElements()).isZero();
                em.getTransaction().commit();
            } finally {
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    private MarketplaceQuoteRequest request(Long provider, Long team, QuoteRequestStatus status) {
        var request = new MarketplaceQuoteRequest();
        request.setProviderId(provider); request.setProviderTeamId(team);
        request.setRequesterOrganizationId(7L); request.setStatus(status);
        request.setTitle("Demande Baitly");
        request.setCreatedAt(LocalDateTime.of(2026, 9, 15, 12, 0));
        return request;
    }
}
