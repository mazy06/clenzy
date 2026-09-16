package com.clenzy.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Changesets et requêtes de production, sur PostgreSQL isolé avec tables parentes réduites. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class ServiceQuoteAmendmentArchivesPostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate jdbc;
    ServiceQuoteAmendmentArchives archives;
    String schema;
    static final byte[] PDF = "%PDF-1.7\narchive".getBytes(StandardCharsets.US_ASCII);

    @BeforeEach void setup() throws Exception {
        source = connection(); jdbc = new JdbcTemplate(source);
        schema = "baitly_archive_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("CREATE SCHEMA " + schema);
        jdbc.execute("SET search_path TO " + schema);
        for (String table : java.util.List.of("service_quotes", "interventions", "users")) {
            jdbc.execute("CREATE TABLE " + table + " (id bigint PRIMARY KEY)");
            jdbc.execute("INSERT INTO " + table + " VALUES (1)");
        }
        migration("0442__service_quote_amendments.sql");
        insertAccepted();
        migration("0443__service_quote_amendment_archives.sql");
        archives = new ServiceQuoteAmendmentArchives(jdbc);
    }

    SingleConnectionDataSource connection() {
        return new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), "", true);
    }
    void migration(String file) throws Exception {
        try (var sql = getClass().getResourceAsStream("/db/changelog/changes/" + file)) {
            jdbc.execute(new String(sql.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
    void insertAccepted() {
        jdbc.execute("""
                INSERT INTO service_quote_amendments(organization_id,quote_id,intervention_id,proposed_by,
                original_amount,proposed_amount,currency,reason,created_at,status,decided_at,decided_by)
                VALUES(7,1,1,1,120,150,'EUR','Travaux',now(),'ACCEPTED',now(),1)
                """);
    }
    @AfterEach void cleanup() {
        if (jdbc != null) jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        if (source != null) source.destroy();
    }

    @Test void backfillArchivesOnceAndSeparatesOrganizations() {
        assertThat(archives.claimForDownload(1L, 99L)).isNull();
        var claim = archives.claimNext();
        assertThat(claim.id()).isEqualTo(1L);
        assertThat(archives.snapshot(claim).proposedAmount()).isEqualByComparingTo("150");
        assertThat(archives.complete(claim, PDF)).isTrue();
        assertThat(archives.read(1L, 7L)).isEqualTo(PDF);
        assertThat(archives.read(1L, 99L)).isNull();
        assertThat(archives.claimNext()).isNull();
        assertThat(archives.complete(claim, "%PDF-replacement".getBytes(StandardCharsets.US_ASCII))).isFalse();
        archives.retry(claim);
        archives.request(1L, 7L);
        assertThat(archives.read(1L, 7L)).isEqualTo(PDF);
    }

    @Test void discoversDecisionsFromOlderInstancesWithoutResettingExistingJobs() {
        insertAccepted();
        var first = archives.claimNext();
        archives.discoverMissing();
        archives.discoverMissing();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM service_quote_amendment_archives", Integer.class)).isEqualTo(2);
        assertThat(archives.snapshot(first).id()).isEqualTo(1L);
        assertThat(archives.claimNext().id()).isEqualTo(2L);
    }

    @Test void expiredWorkerCannotReplaceNewerArchive() {
        var first = archives.claimNext();
        assertThat(archives.claimNext()).isNull();
        jdbc.update("UPDATE service_quote_amendment_archives SET lease_until = now() - interval '1 second'");
        assertThat(archives.complete(first, PDF)).isFalse();
        var second = archives.claimNext();
        assertThat(second.token()).isNotEqualTo(first.token());
        archives.retry(first);
        assertThat(archives.snapshot(second).id()).isEqualTo(1L);
        assertThat(archives.complete(second, PDF)).isTrue();
        assertThat(archives.complete(first, "%PDF-stale".getBytes(StandardCharsets.US_ASCII))).isFalse();
        assertThat(archives.read(1L, 7L)).isEqualTo(PDF);
    }

    @Test void failureBacksOffAndInvalidPdfCannotBecomeReady() {
        var claim = archives.claimNext();
        assertThatThrownBy(() -> archives.complete(claim, "<html>error</html>".getBytes(StandardCharsets.US_ASCII)))
                .isInstanceOf(IllegalArgumentException.class);
        archives.retry(claim);
        assertThat(archives.claimNext()).isNull();
        assertThat(archives.read(1L, 7L)).isNull();
        jdbc.update("UPDATE service_quote_amendment_archives SET retry_at = now() - interval '1 second'");
        var next = archives.claimNext();
        assertThat(next).isNotNull();
        assertThat(archives.complete(next, PDF)).isTrue();
        jdbc.update("UPDATE service_quote_amendment_archives SET pdf_content = ?", "%PDF-corrupt".getBytes(StandardCharsets.US_ASCII));
        assertThatThrownBy(() -> archives.read(1L, 7L)).hasMessageContaining("altérée");
    }

    @Test void requestRequiresTransactionAndRollsBackWithDecision() {
        var manager = new DataSourceTransactionManager(source);
        var proxy = new org.springframework.aop.framework.ProxyFactory(archives);
        proxy.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(manager,
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var transactional = (ServiceQuoteAmendmentArchives) proxy.getProxy();
        assertThatThrownBy(() -> transactional.request(1L, 7L))
                .isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
        var tx = new TransactionTemplate(manager);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            insertAccepted();
            transactional.request(2L, 7L);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM service_quote_amendment_archives", Integer.class)).isEqualTo(2);
            throw new IllegalStateException("Message refusé");
        })).hasMessage("Message refusé");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM service_quote_amendments", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM service_quote_amendment_archives", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> transactional.request(1L, 99L)))
                .hasMessageContaining("Décision acceptée requise");
    }

    @Test void secondConnectionSkipsLockedJobAndCanClaimAfterRollback() {
        var other = connection();
        try {
            var otherJdbc = new JdbcTemplate(other);
            otherJdbc.execute("SET search_path TO " + schema);
            otherJdbc.execute("SET statement_timeout = '2s'");
            var otherArchives = new ServiceQuoteAmendmentArchives(otherJdbc);
            new TransactionTemplate(new DataSourceTransactionManager(source)).executeWithoutResult(status -> {
                jdbc.queryForObject("SELECT amendment_id FROM service_quote_amendment_archives FOR UPDATE", Long.class);
                assertThat(otherArchives.claimNext()).isNull();
                status.setRollbackOnly();
            });
            assertThat(otherArchives.claimNext()).isNotNull();
        } finally { other.destroy(); }
    }
}
