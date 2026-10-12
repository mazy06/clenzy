package com.clenzy.marketplace.sectors;

import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La requête de couverture des secteurs, exécutée telle quelle avec la fonction
 * {@code baitly_zone_covers} reprise de son changeset : la carte et l'affectation
 * appliquent la même règle.
 */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class ProviderSectorCoveragePostgresTest {

    private static final long ORG = 7L;
    private static String schema;
    private static String url;
    private static String user;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void database() throws Exception {
        url = System.getProperty("baitly.test.jdbc");
        user = System.getProperty("baitly.test.user", "postgres");
        schema = "baitly_sectors_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, ""); var s = c.createStatement()) {
            s.execute("CREATE SCHEMA " + schema);
        }
        jdbc = new JdbcTemplate(new DriverManagerDataSource(url + "?currentSchema=" + schema, user, ""));
        jdbc.execute("CREATE TABLE properties(id bigint PRIMARY KEY, organization_id bigint, status varchar(30), "
                + "country_code varchar(2), department varchar(3), arrondissement varchar(5), city varchar(100))");
        jdbc.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY, user_id bigint)");
        jdbc.execute("CREATE TABLE marketplace_provider_zones(id bigint PRIMARY KEY, provider_id bigint, user_id bigint, "
                + "country_code varchar(2), department varchar(3), arrondissement varchar(5), city varchar(100))");
        // La fonction vit dans public : on reprend sa définition exacte depuis le changeset.
        String changeset = Files.readString(Path.of("src/main/resources/db/changelog/changes/0452__shared_geographic_eligibility.sql"));
        var definition = Pattern.compile("CREATE OR REPLACE FUNCTION public\\.baitly_zone_covers\\(.*?\\$fn\\$;", Pattern.DOTALL)
                .matcher(changeset);
        assertThat(definition.find()).isTrue();
        jdbc.execute(definition.group().replace("public.baitly_zone_covers", schema + ".baitly_zone_covers"));
    }

    @AfterAll
    static void cleanup() throws Exception {
        if (schema == null) return;
        try (var c = DriverManager.getConnection(url, user, ""); var s = c.createStatement()) {
            s.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    @BeforeEach
    void reset() {
        jdbc.execute("TRUNCATE properties, marketplace_providers, marketplace_provider_zones");
        jdbc.update("INSERT INTO properties VALUES "
                + "(1, 7, 'ACTIVE', 'FR', '75', '75111', 'Paris'),"
                + "(2, 7, 'ACTIVE', NULL, '93', NULL, 'Montreuil'),"
                + "(3, 7, 'ARCHIVED', 'FR', '75', '75111', 'Paris'),"
                + "(4, 8, 'ACTIVE', 'FR', '75', '75111', 'Paris'),"
                + "(5, 7, 'ACTIVE', 'MA', NULL, NULL, 'Casablanca')");
        // 10 : fiche avec personne (zones portées par user_id) ; 11 : fiche sans personne.
        jdbc.update("INSERT INTO marketplace_providers VALUES (10, 100), (11, NULL)");
        jdbc.update("INSERT INTO marketplace_provider_zones VALUES "
                + "(1, NULL, 100, 'FR', '75', '75111', NULL),"
                + "(2, NULL, 100, 'FR', '93', NULL, NULL),"
                + "(3, 11, NULL, 'MA', NULL, NULL, 'casablanca')");
    }

    private List<String> coverage(String sql, Object... args) {
        return jdbc.query(sql.replace("public.baitly_zone_covers", schema + ".baitly_zone_covers")
                        .replace(":orgId", "?").replace(":providerId", "?"),
                (rs, i) -> rs.getLong("providerId") + "→" + rs.getLong("propertyId"), args);
    }

    @Test
    void whenComputingOrganizationCoverage_thenTheAssignmentRuleDecides() {
        assertThat(coverage(MarketplaceProviderZoneRepository.PROPERTY_COVERAGE, ORG))
                // 3 archivé et 4 d'une autre organisation : exclus ; 2 sans pays = France par défaut.
                .containsExactlyInAnyOrder("10→1", "10→2", "11→5");
    }

    @Test
    void whenComputingOneProviderCoverage_thenOnlyItsPairsAreReturned() {
        assertThat(coverage(MarketplaceProviderZoneRepository.PROPERTY_COVERAGE + " AND pr.id = :providerId", ORG, 11L))
                .containsExactly("11→5");
    }
}
