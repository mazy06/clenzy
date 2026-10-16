package com.clenzy.marketplace.sectors;

import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;
import java.util.UUID;

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
                + "country_code varchar(2), department varchar(3), arrondissement varchar(5), city varchar(100), latitude numeric, longitude numeric)");
        jdbc.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY, user_id bigint, base_country_code varchar(2), latitude numeric, longitude numeric, travel_radius_km integer)");
        jdbc.execute("CREATE TABLE marketplace_provider_zones(id bigint PRIMARY KEY, provider_id bigint, user_id bigint, "
                + "country_code varchar(2), department varchar(3), arrondissement varchar(5), city varchar(100))");
        // La fonction vit dans public : on reprend sa définition exacte depuis le changeset.
        jdbc.execute("CREATE TABLE teams(id bigint PRIMARY KEY, personal_user_id bigint, organization_id bigint)");
        jdbc.execute("CREATE TABLE team_coverage_zones(team_id bigint,country text,department text,arrondissement text,city text)");
        String changeset = Files.readString(Path.of("src/main/resources/db/changelog/changes/0452__shared_geographic_eligibility.sql"));
        jdbc.execute(changeset.replace("public",schema));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0562__baitly_radius_and_declared_coverage.sql")).replace("public",schema));
        normalizeLegacyData();
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
        jdbc.execute("TRUNCATE properties, marketplace_providers, marketplace_provider_zones, teams, team_coverage_zones");
        jdbc.update("INSERT INTO properties(id,organization_id,status,country_code,department,arrondissement,city) VALUES "
                + "(1, 7, 'ACTIVE', 'FR', '75', '75111', 'Paris'),"
                + "(2, 7, 'ACTIVE', NULL, '93', NULL, 'Montreuil'),"
                + "(3, 7, 'ARCHIVED', 'FR', '75', '75111', 'Paris'),"
                + "(4, 8, 'ACTIVE', 'FR', '75', '75111', 'Paris'),"
                + "(5, 7, 'ACTIVE', 'MA', NULL, NULL, 'Casablanca')");
        // 10 : fiche avec personne (zones portées par user_id) ; 11 : fiche sans personne.
        jdbc.update("INSERT INTO marketplace_providers(id,user_id) VALUES (10, 100), (11, NULL)");
        jdbc.update("INSERT INTO marketplace_provider_zones VALUES "
                + "(1, NULL, 100, 'FR', '75', '75111', NULL),"
                + "(2, NULL, 100, 'FR', '93', NULL, NULL),"
                + "(3, 11, NULL, 'MA', NULL, NULL, 'casablanca')");
    }

    private List<String> coverage(String sql, Object... args) {
        return jdbc.query(sql.replace("public.", schema + ".")
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

    @Test
    void radiusAloneAndAdministrativeAreasAreAlternativesAcrossEveryVerdict() {
        jdbc.update("UPDATE properties SET latitude=48.8566,longitude=2.3522 WHERE id IN (1,4)");
        jdbc.update("UPDATE properties SET latitude=48.863,longitude=2.448 WHERE id=2");
        jdbc.update("INSERT INTO marketplace_providers(id,user_id,base_country_code,latitude,longitude,travel_radius_km) "
            + "VALUES (12,120,'FR',48.8566,2.3522,10), (13,130,'FR',48.8566,2.3522,0), (14,NULL,'MA',34.02,-6.84,10)");
        jdbc.update("INSERT INTO teams(id,personal_user_id) VALUES(1200,120)");
        assertThat(coverage(MarketplaceProviderZoneRepository.PROPERTY_COVERAGE, ORG))
            .containsExactlyInAnyOrder("10→1","10→2","11→5","12→1","12→2","13→1");
        assertThat(verdict("baitly_provider_covers",12,"FR","93",null,"Montreuil",48.863,2.448)).isTrue();
        assertThat(verdict("baitly_team_covers",1200,"FR","93",null,"Montreuil",48.863,2.448)).isTrue();
        assertThat(verdict("baitly_provider_covers",12,"FR","69",null,"Lyon",45.76,4.84)).isFalse();
        // Le secteur reste valable même loin du rayon, ou sans géolocalisation du logement.
        jdbc.update("INSERT INTO marketplace_provider_zones VALUES(4,NULL,120,'FR','69',NULL,NULL)");
        assertThat(verdict("baitly_provider_covers",12,"FR","69",null,"Lyon",45.76,4.84)).isTrue();
        assertThat(verdict("baitly_provider_covers",12,"FR","69",null,"Lyon",null,null)).isTrue();
        assertThat(verdict("baitly_provider_covers",12,"FR","93",null,"Montreuil",null,null)).isFalse();
        assertThat(verdict("baitly_provider_covers",14,"FR","75","75111","Paris",48.8566,2.3522)).isFalse();
    }

    private boolean verdict(String function,long id,String country,String department,String arrondissement,String city,Double lat,Double lon) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT "+schema+"."+function+"(?,?,?,?,?,CAST(? AS double precision),CAST(? AS double precision))",
            Boolean.class,id,country,department,arrondissement,city,lat,lon));
    }

    @ParameterizedTest
    @CsvFileSource(resources="/geo/baitly-arrondissement-cases.csv",numLinesToSkip=1,nullValues="NULL")
    void sqlAndJavaShareTheSameNormalization(String country,String department,String input,String expected) {
        assertThat(jdbc.queryForObject("SELECT "+schema+".baitly_normalize_arrondissement(?,?,?)",String.class,country,department,input))
            .isEqualTo(expected);
    }

    @Test void salmaReappearsInMapCoverageAndTeamSuggestionsWithoutCoveringTheEleventh() throws Exception {
        jdbc.update("TRUNCATE properties, marketplace_providers, marketplace_provider_zones, teams, team_coverage_zones");
        jdbc.update("INSERT INTO properties(id,organization_id,status,country_code,department,arrondissement,city) VALUES "
            + "(75,7,'ACTIVE','FR','75','11e','Paris'),(76,7,'ACTIVE','FR','75','10e','Paris'),"
            + "(81,7,'ACTIVE','FR','69','3e','Lyon'),(82,7,'ACTIVE','MA','75','10e','Rabat'),"
            + "(83,7,'ACTIVE','FR','75','21e','Paris')");
        jdbc.update("INSERT INTO marketplace_providers(id,user_id) VALUES(27,35)");
        jdbc.update("INSERT INTO marketplace_provider_zones VALUES "
            + "(117,NULL,35,'FR','75','75103',NULL),(118,NULL,35,'FR','75','75110',NULL),(119,NULL,35,'FR','75','75118',NULL),"
            + "(120,NULL,99,'FR','69','69003',NULL)");
        jdbc.update("INSERT INTO teams VALUES(8,35,7),(9,NULL,7),(10,99,7)");
        jdbc.update("INSERT INTO team_coverage_zones VALUES(9,'FR','69','69003',NULL)");
        // La règle commune prend déjà en charge un ancien logement non encore repris.
        assertThat(verdict("baitly_provider_covers",27,"FR","75","10e","Paris",null,null)).isTrue();
        assertThat(coverage(MarketplaceProviderZoneRepository.PROPERTY_COVERAGE,ORG)).containsExactly("27→76");
        normalizeLegacyData();
        assertThat(jdbc.queryForObject("SELECT arrondissement FROM properties WHERE id=76",String.class)).isEqualTo("75110");
        assertThat(jdbc.queryForObject("SELECT arrondissement FROM properties WHERE id=81",String.class)).isEqualTo("69383");
        assertThat(jdbc.queryForObject("SELECT arrondissement FROM properties WHERE id=82",String.class)).isEqualTo("10e");
        assertThat(jdbc.queryForObject("SELECT arrondissement FROM properties WHERE id=83",String.class)).isEqualTo("21e");
        assertThat(jdbc.queryForObject("SELECT arrondissement FROM team_coverage_zones WHERE team_id=9",String.class)).isEqualTo("69383");
        assertThat(jdbc.queryForObject("SELECT arrondissement FROM marketplace_provider_zones WHERE id=120",String.class)).isEqualTo("69383");
        assertThat(coverage(MarketplaceProviderZoneRepository.PROPERTY_COVERAGE,ORG)).containsExactly("27→76");
        String suggestions=com.clenzy.repository.TeamCoverageZoneRepository.class
            .getMethod("findTeamIdsByDepartmentAndArrondissement",String.class,String.class,Long.class)
            .getAnnotation(org.springframework.data.jpa.repository.Query.class).value()
            .replace("public.",schema+".").replace(":orgId","?").replace(":dept","?").replace(":arr","?");
        assertThat(jdbc.queryForList(suggestions,Long.class,ORG,"75","75110")).containsExactly(8L);
        assertThat(jdbc.queryForList(suggestions,Long.class,ORG,"75","75111")).isEmpty();
        assertThat(verdict("baitly_team_covers",8,"FR","75","10e","Paris",48.87,2.36)).isTrue();
        assertThat(jdbc.queryForObject("SELECT "+schema+".baitly_zone_covers('FR','75','21e',NULL,'FR','75','21e','Paris')",Boolean.class)).isFalse();
        normalizeLegacyData(); // La reprise est stable si elle est rejouée dans un test de recovery.
        assertThat(coverage(MarketplaceProviderZoneRepository.PROPERTY_COVERAGE,ORG)).containsExactly("27→76");
    }

    private static void normalizeLegacyData() throws Exception {
        String sql=Files.readString(Path.of("src/main/resources/db/changelog/changes/0563__baitly_normalize_municipal_arrondissements.sql"))
            .replace("public",schema) + "\n" + Files.readString(Path.of("src/main/resources/db/changelog/changes/0564__baitly_french_city_coverage.sql")).replace("public",schema);
        jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            connection.setAutoCommit(false);
            try(var statement=connection.createStatement()) {
                statement.execute("SET LOCAL app.bypass_rls='off'");
                statement.execute(sql);
                try(var result=statement.executeQuery("SELECT current_setting('app.bypass_rls')")) {
                    result.next();assertThat(result.getString(1)).isEqualTo("off");
                }
                connection.commit();
            } catch(Exception failure) { connection.rollback();throw failure; }
            finally {connection.setAutoCommit(true);}
            return null;
        });
    }

    @Test void cityRestrictionIsSharedByTheMapAssignmentSuggestionsAndRadiusAlternative() {
        jdbc.update("INSERT INTO properties(id,organization_id,status,country_code,department,city) VALUES "
            + "(20,7,'ACTIVE','FR','92','Courbevoie'),(21,7,'ACTIVE','FR','92','Neuilly-sur-Seine'),"
            + "(22,7,'ACTIVE','FR','93','Courbevoie'),(23,7,'ACTIVE','FR','92',NULL)");
        jdbc.update("INSERT INTO marketplace_provider_zones VALUES(20,11,NULL,'FR','92',NULL,'Courbevoie')");
        jdbc.update("INSERT INTO teams VALUES(20,NULL,7),(21,100,7)");
        jdbc.update("INSERT INTO team_coverage_zones VALUES(20,'FR','92',NULL,'Courbevoie')");
        assertThat(coverage(MarketplaceProviderZoneRepository.PROPERTY_COVERAGE, ORG))
            .contains("11→20").doesNotContain("11→21","11→22","11→23");
        assertThat(verdict("baitly_provider_covers",11,"FR","92",null," COURBEVOIE ",null,null)).isTrue();
        assertThat(verdict("baitly_team_covers",20,"FR","92",null,"Courbevoie",null,null)).isTrue();
        assertThat(verdict("baitly_team_covers",20,"FR","92",null,"Neuilly-sur-Seine",null,null)).isFalse();
        jdbc.update("INSERT INTO marketplace_provider_zones VALUES(21,NULL,100,'FR','92',NULL,'Châtenay-Malabry')");
        assertThat(verdict("baitly_team_covers",21,"FR","92",null,"Chatenay Malabry",null,null)).isTrue();
        assertThat(verdict("baitly_team_covers",21,"FR","92",null,"Courbevoie",null,null)).isFalse();
        jdbc.update("UPDATE marketplace_provider_zones SET city=NULL WHERE id=20");
        assertThat(verdict("baitly_provider_covers",11,"FR","92",null,"Neuilly-sur-Seine",null,null)).isTrue();
        jdbc.update("UPDATE marketplace_provider_zones SET city='Courbevoie' WHERE id=20");
        jdbc.update("UPDATE marketplace_providers SET latitude=48.884,longitude=2.241,travel_radius_km=2 WHERE id=11");
        assertThat(verdict("baitly_provider_covers",11,"FR","92",null,"Neuilly-sur-Seine",48.884,2.241)).isTrue();
    }

    @Test void everyOfficialFrenchCityUsesTheSameSqlAndMapNormalization() throws Exception {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var names = new java.util.ArrayList<String>();
        try (var input = new org.springframework.core.io.ClassPathResource("geo/baitly-communes.json").getInputStream()) {
            mapper.readTree(input).forEach(department -> department.forEach(city -> names.add(city.asText())));
        }
        jdbc.query("SELECT city,"+schema+".baitly_normalize_city(city) normalized FROM jsonb_array_elements_text(CAST(? AS jsonb)) cities(city)",
            (org.springframework.jdbc.core.RowCallbackHandler) row -> assertThat(row.getString("normalized")).as(row.getString("city"))
                .isEqualTo(SectorKey.normalizeCity(row.getString("city"))), mapper.writeValueAsString(names));
    }
}
