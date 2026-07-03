package com.clenzy;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinTable;
import jakarta.persistence.SecondaryTable;
import jakarta.persistence.Table;
import liquibase.Liquibase;
import liquibase.change.Change;
import liquibase.change.core.SQLFileChange;
import liquibase.changelog.ChangeSet;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Garde-fous du changelog Liquibase (strategie de tests, vague T1).
 *
 * <p><b>Historique</b> : le changelog a ete converti depuis Flyway
 * <b>V2</b>→V58 et le schema initial (V1, cree par {@code ddl-auto=update})
 * n'etait capture dans aucun changeset — un replay sur base vierge echouait
 * des 0001 ({@code relation "users" does not exist}). Cet ecart est COMBLE
 * depuis le chantier 0000-baseline : le changeset {@code 0000-baseline-schema}
 * (preconditionne {@code onFail=MARK_RAN} si {@code users} existe) recree ce
 * schema manquant, et {@link LiquibaseVirginReplayIT} prouve le replay
 * INTEGRAL sur Postgres vierge + validation Hibernate, ainsi que le chemin
 * MARK_RAN des environnements existants.</p>
 *
 * <p>Ce test verifie deux proprietes statiques complementaires, qui couvrent
 * la classe d'incidents reels 0249/0251 (changeset ecrit contre une table au
 * mauvais nom — « singulier vs pluriel ») et les changesets casses :</p>
 * <ol>
 *   <li><b>Parse + validate Liquibase</b> du master changelog INTEGRAL : YAML
 *       malforme, fichier SQL manquant/renomme, IDs dupliques, attributs
 *       invalides — tout ce que SpringLiquibase verifierait au boot AVANT
 *       d'executer ;</li>
 *   <li><b>Cross-check referentiel des tables</b> : chaque table ciblee par un
 *       {@code ALTER TABLE} / {@code CREATE INDEX ... ON} / {@code COMMENT ON
 *       TABLE} d'un changeset doit exister — soit creee par un changeset
 *       ANTERIEUR, soit presente dans le schema des entites JPA (le baseline de
 *       fait). C'est exactement le test qui aurait bloque 0249/0251
 *       ({@code booking_engine_config} au singulier, table inexistante).</li>
 * </ol>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true",
        disabledReason = "Tests d'integration (Docker/Testcontainers) — poser CLENZY_IT=true pour les executer")
class LiquibaseMigrationIT {

    private static final String MASTER_CHANGELOG = "db/changelog/db.changelog-master.yaml";

    /**
     * Tables referencees par des changesets HISTORIQUES mais absentes des
     * entites actuelles et jamais creees par un changeset. Vide depuis le
     * chantier 0000-baseline : {@code invitations} (ancienne entite ddl-auto,
     * ALTER non garde par 0041) est desormais creee par le changeset
     * {@code 0000-baseline-schema}. Toute NOUVELLE entree ici doit etre
     * justifiee — pour un nouveau changeset c'est probablement un nom de
     * table errone (incident 0249/0251).
     */
    private static final Set<String> LEGACY_PRE_BASELINE_TABLES = Set.of();

    // Container dedie et VIERGE : validate() a besoin d'une connexion reelle
    // (implementation Postgres) mais n'execute aucun changeset.
    static final PostgreSQLContainer<?> postgres;

    static {
        if (AbstractIntegrationTest.IT_ENABLED) {
            postgres = new PostgreSQLContainer<>(
                    DockerImageName.parse("pgvector/pgvector:pg15").asCompatibleSubstituteFor("postgres"))
                    .withDatabaseName("clenzy_liquibase")
                    .withUsername("test")
                    .withPassword("test");
            postgres.start();
        } else {
            postgres = null;
        }
    }

    // ── 1. Parse + validate du changelog integral ──────────────────────────────

    @Test
    void masterChangelog_parsesAndValidates_endToEnd() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (Liquibase liquibase = new Liquibase(
                    MASTER_CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                // Parse le YAML + resout chaque sqlFile + verifie la structure.
                liquibase.validate();
                DatabaseChangeLog changeLog = liquibase.getDatabaseChangeLog();
                int count = changeLog.getChangeSets().size();
                assertTrue(count >= 306,
                        "Changelog incomplet : " + count + " changesets parses (>= 306 attendus)");
            }
        }
    }

    // ── 2. Cross-check des tables referencees (incident 0249/0251) ────────────

    private static final Pattern CREATE_TABLE = Pattern.compile(
            "CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([\\w\".]+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern RENAME_TABLE = Pattern.compile(
            "ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?([\\w\".]+)\\s+RENAME\\s+TO\\s+([\\w\".]+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern ALTER_TABLE = Pattern.compile(
            "ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?([\\w\".]+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CREATE_INDEX_ON = Pattern.compile(
            "CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?[\\w\"]+\\s+ON\\s+(?:ONLY\\s+)?([\\w\".]+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern COMMENT_ON_TABLE = Pattern.compile(
            "COMMENT\\s+ON\\s+TABLE\\s+([\\w\".]+)", Pattern.CASE_INSENSITIVE);
    /** Corps dollar-quotes ($$...$$, $fn$...$fn$) : SQL dynamique, hors perimetre du lint. */
    private static final Pattern DOLLAR_QUOTED = Pattern.compile(
            "\\$([A-Za-z_]*)\\$.*?\\$\\1\\$", Pattern.DOTALL);
    private static final Pattern LINE_COMMENT = Pattern.compile("--[^\n]*");
    private static final Pattern BLOCK_COMMENT = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL);

    @Test
    void changesets_onlyReferenceTablesThatExist() throws Exception {
        Set<String> knownTables = entityTables();
        knownTables.add("databasechangelog");
        knownTables.add("databasechangeloglock");
        knownTables.addAll(LEGACY_PRE_BASELINE_TABLES);

        List<String> violations = new ArrayList<>();
        for (SqlOfChangeSet sql : orderedChangesetSql()) {
            String cleaned = stripNonDdl(sql.sql());
            // Les creations du changeset courant sont connues pour lui-meme et la suite.
            Matcher create = CREATE_TABLE.matcher(cleaned);
            while (create.find()) {
                knownTables.add(normalize(create.group(1)));
            }
            Matcher rename = RENAME_TABLE.matcher(cleaned);
            while (rename.find()) {
                knownTables.add(normalize(rename.group(2)));
            }
            checkReferences(cleaned, ALTER_TABLE, knownTables, sql.id(), violations);
            checkReferences(cleaned, CREATE_INDEX_ON, knownTables, sql.id(), violations);
            checkReferences(cleaned, COMMENT_ON_TABLE, knownTables, sql.id(), violations);
        }

        assertTrue(violations.isEmpty(),
                "Changesets referencant des tables inconnues (mauvais nom de table ? "
                        + "cf. incidents 0249/0251) :\n" + String.join("\n", violations));
    }

    private void checkReferences(String sql, Pattern pattern, Set<String> knownTables,
                                 String changeSetId, List<String> violations) {
        Matcher matcher = pattern.matcher(sql);
        while (matcher.find()) {
            String table = normalize(matcher.group(1));
            if (knownTables.contains(table) || isPartitionOfKnownTable(table, knownTables)) {
                continue;
            }
            String violation = changeSetId + " -> table inconnue: " + table;
            if (!violations.contains(violation)) {
                violations.add(violation);
            }
        }
    }

    /** Partitions declaratives (ex. calendar_days_2026_01) : rattachees a leur table mere. */
    private boolean isPartitionOfKnownTable(String table, Set<String> knownTables) {
        return knownTables.stream().anyMatch(known -> table.startsWith(known + "_"));
    }

    private static String normalize(String raw) {
        String name = raw.replace("\"", "").toLowerCase(Locale.ROOT).trim();
        return name.startsWith("public.") ? name.substring("public.".length()) : name;
    }

    private static String stripNonDdl(String sql) {
        String cleaned = BLOCK_COMMENT.matcher(sql).replaceAll(" ");
        cleaned = LINE_COMMENT.matcher(cleaned).replaceAll(" ");
        return DOLLAR_QUOTED.matcher(cleaned).replaceAll(" ");
    }

    /** SQL de chaque changeset, dans l'ordre du master changelog. */
    private record SqlOfChangeSet(String id, String sql) {}

    private List<SqlOfChangeSet> orderedChangesetSql() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (Liquibase liquibase = new Liquibase(
                    MASTER_CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                DatabaseChangeLog changeLog = liquibase.getDatabaseChangeLog();
                List<SqlOfChangeSet> result = new ArrayList<>();
                for (ChangeSet changeSet : changeLog.getChangeSets()) {
                    for (Change change : changeSet.getChanges()) {
                        if (change instanceof SQLFileChange sqlFile) {
                            result.add(new SqlOfChangeSet(changeSet.getId(),
                                    readChangesetFile(sqlFile.getPath())));
                        }
                    }
                }
                assertTrue(result.size() >= 300, "Extraction SQL incomplete : " + result.size());
                return result;
            }
        }
    }

    private String readChangesetFile(String path) throws Exception {
        // path est relatif au master changelog (relativeToChangelogFile: true).
        String resource = path.startsWith("changes/") ? "db/changelog/" + path : path;
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Fichier changeset introuvable: " + resource);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    // ── Tables du schema des entites JPA (baseline de fait) ───────────────────

    private Set<String> entityTables() throws Exception {
        Set<String> tables = new LinkedHashSet<>();
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (BeanDefinition candidate : scanner.findCandidateComponents("com.clenzy")) {
            Class<?> entity = Class.forName(candidate.getBeanClassName());
            Table table = entity.getAnnotation(Table.class);
            tables.add(table != null && !table.name().isBlank()
                    ? normalize(table.name())
                    : camelToSnake(entity.getSimpleName()));
            SecondaryTable secondary = entity.getAnnotation(SecondaryTable.class);
            if (secondary != null) {
                tables.add(normalize(secondary.name()));
            }
            for (Field field : entity.getDeclaredFields()) {
                JoinTable joinTable = field.getAnnotation(JoinTable.class);
                if (joinTable != null && !joinTable.name().isBlank()) {
                    tables.add(normalize(joinTable.name()));
                }
                CollectionTable collectionTable = field.getAnnotation(CollectionTable.class);
                if (collectionTable != null && !collectionTable.name().isBlank()) {
                    tables.add(normalize(collectionTable.name()));
                }
            }
        }
        assertTrue(tables.size() > 100, "Scan des entites anormalement pauvre : " + tables.size());
        return new HashSet<>(tables);
    }

    /** Meme convention que CamelCaseToUnderscoresNamingStrategy (implicite Hibernate/Boot). */
    private static String camelToSnake(String name) {
        return name.replaceAll("([a-z\\d])([A-Z])", "$1_$2").toLowerCase(Locale.ROOT);
    }
}
