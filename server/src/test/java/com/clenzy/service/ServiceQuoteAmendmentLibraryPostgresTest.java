package com.clenzy.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.util.Set;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class ServiceQuoteAmendmentLibraryPostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate jdbc;
    ServiceQuoteAmendmentLibrary library;
    ServiceQuoteAmendmentService amendments;
    String schema;

    @BeforeEach void setup() throws Exception {
        source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), "", true);
        jdbc = new JdbcTemplate(source);
        schema = "baitly_library_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("CREATE SCHEMA " + schema);
        jdbc.execute("SET search_path TO " + schema);
        jdbc.execute("CREATE TABLE users(id bigint PRIMARY KEY, keycloak_id text)");
        jdbc.execute("INSERT INTO users VALUES (3,'provider'),(4,'other-provider'),(5,'owner'),(6,'other-owner')");
        jdbc.execute("CREATE TABLE properties(id bigint PRIMARY KEY, owner_id bigint REFERENCES users(id))");
        jdbc.execute("INSERT INTO properties VALUES (1,5),(2,6)");
        jdbc.execute("CREATE TABLE interventions(id bigint PRIMARY KEY, organization_id bigint, property_id bigint REFERENCES properties(id))");
        jdbc.execute("INSERT INTO interventions VALUES(1,7,1),(2,7,1),(3,7,1),(4,9,1),(5,7,2),(6,9,1)");
        jdbc.execute("CREATE TABLE service_quotes(id bigint PRIMARY KEY, organization_id bigint, intervention_id bigint, provider_team_id bigint, provider_user_id bigint)");
        jdbc.execute("INSERT INTO service_quotes VALUES(1,7,1,8,3),(2,7,2,9,3),(3,7,3,NULL,3),(4,9,4,8,4),(5,7,5,9,4),(6,9,6,9,4)");
        migration("0442__service_quote_amendments.sql");
        jdbc.execute("""
                INSERT INTO service_quote_amendments(organization_id,quote_id,intervention_id,proposed_by,
                original_amount,proposed_amount,currency,reason,created_at,status,decided_at,decided_by)
                SELECT organization_id,id,intervention_id,3,120,150,'EUR',
                    CASE WHEN id=1 THEN 'Réparation 100%' ELSE 'Travaux' END,now(),'ACCEPTED',now(),5
                FROM service_quotes ORDER BY id
                """);
        migration("0443__service_quote_amendment_archives.sql");
        amendments = mock(ServiceQuoteAmendmentService.class);
        library = new ServiceQuoteAmendmentLibrary(amendments, new NamedParameterJdbcTemplate(jdbc));
    }
    void migration(String name) throws Exception {
        try (var in = getClass().getResourceAsStream("/db/changelog/changes/" + name)) {
            jdbc.execute(new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        }
    }
    void access(long actor, Set<Long> teams, boolean staff, boolean owner) {
        when(amendments.libraryAccess(7L, null)).thenReturn(new ServiceQuoteAmendmentService.LibraryAccess(
                actor, 7L, owner ? "owner" : "provider", teams, staff, owner));
    }
    @AfterEach void cleanup() {
        if (jdbc != null) jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        if (source != null) source.destroy();
    }

    @Test void teamRightsApplyBeforeCountAndPaginationIncludingExternalProviders() {
        access(3, Set.of(8L), false, false);
        var first = library.list(7L, null, 0, 2, "");
        assertThat(first.getTotalElements()).isEqualTo(3);
        assertThat(first.getContent()).extracting(ServiceQuoteAmendmentLibrary.Entry::id).containsExactly(4L,3L);
        assertThat(library.list(7L, null, 1, 2, "").getContent())
                .extracting(ServiceQuoteAmendmentLibrary.Entry::id).containsExactly(1L);
        assertThat(library.list(7L, null, 0, 20, "2").getTotalElements()).isZero();
        // Auteur du devis 2, mais membre de l'équipe 8 seulement : l'auteur ne contourne pas l'équipe figée.
        access(3, Set.of(), false, false);
        assertThat(library.list(7L, null, 0, 20, "").getContent())
                .extracting(ServiceQuoteAmendmentLibrary.Entry::id).containsExactly(3L);
    }

    @Test void ownerAndStaffStayWithinTheirAuthorizedScope() {
        access(5, Set.of(), false, true);
        assertThat(library.list(7L, null, 0, 20, "").getContent())
                .extracting(ServiceQuoteAmendmentLibrary.Entry::id).containsExactly(3L,2L,1L);
        access(5, Set.of(), true, false);
        assertThat(library.list(7L, null, 0, 20, "").getContent())
                .extracting(ServiceQuoteAmendmentLibrary.Entry::id).containsExactly(5L,3L,2L,1L);
    }

    @Test void literalSearchAndArchiveStatesDoNotExposePdfBytes() {
        access(3, Set.of(8L), false, false);
        var found = library.list(7L, null, 0, 20, "%");
        assertThat(found.getTotalElements()).isEqualTo(1);
        assertThat(found.getContent().getFirst().archiveStatus()).isEqualTo("PREPARING");
        jdbc.execute("UPDATE service_quote_amendment_archives SET attempts=1 WHERE amendment_id=1");
        assertThat(library.list(7L, null, 0, 20, "réPARation").getContent().getFirst().archiveStatus()).isEqualTo("RETRYING");
        var archives = new ServiceQuoteAmendmentArchives(jdbc);
        var claim = archives.claimForDownload(1L,7L);
        archives.complete(claim, "%PDF-test".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        var ready = library.list(7L, null, 0, 20, "%").getContent().getFirst();
        assertThat(ready.archiveStatus()).isEqualTo("READY");
        assertThat(ready.archivedAt()).isNotNull();
    }

    @Test void invalidPagingAndInconsistentReferencesFailClosed() {
        access(3, Set.of(8L), false, false);
        assertThatThrownBy(() -> library.list(7L, null, -1, 20, "")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> library.list(7L, null, 0, 51, "")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> library.list(7L, null, 0, 20, "a".repeat(101))).isInstanceOf(IllegalArgumentException.class);
        jdbc.execute("UPDATE service_quotes SET organization_id=99 WHERE id=1");
        assertThat(library.list(7L, null, 0, 20, "%").getTotalElements()).isZero();
    }
}
