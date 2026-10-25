package com.clenzy.config;

import javax.sql.DataSource;

/** Installs the JDBC-only Baitly proof journal beside Hibernate's integration schema. */
public final class BaitlyAutomationIntegrationSchema {
    private BaitlyAutomationIntegrationSchema() {}

    public static void install(DataSource source) {
        installAssignmentTables(source);
        try (var connection = source.getConnection()) {
            var database = liquibase.database.DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
            var resources = new liquibase.resource.ClassLoaderResourceAccessor();
            try (var master = new liquibase.Liquibase("db/changelog/db.changelog-master.yaml", resources, database)) {
                var selected = new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream()
                        .filter(set -> "0604-baitly-automation-outcome-proofs".equals(set.getId()))
                        .forEach(selected::addChangeSet);
                if (selected.getChangeSets().size() != 1) throw new IllegalStateException("Proof changeset required");
                new liquibase.Liquibase(selected, resources, database).update("");
            }
        } catch (Exception failure) {
            throw new IllegalStateException("Baitly integration proof journal migration failed", failure);
        }
    }

    private static void installAssignmentTables(DataSource source) {
        // Hibernate already supplies the mapped columns from 0473. Only its three
        // JDBC-owned tables are absent. This is a hybrid test fixture, not a claim
        // that the complete migration boot or assignment delivery was qualified.
        var resource = new org.springframework.core.io.ClassPathResource(
                "db/changelog/changes/0473__service_assignment_proposals.sql");
        try (var input = resource.getInputStream()) {
            String sql = new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            var tables = java.util.regex.Pattern.compile(
                    "(?ms)^CREATE TABLE service_assignment_(?:proposals|policies|notifications) \\(.*?^\\);")
                    .matcher(sql).results().map(java.util.regex.MatchResult::group).toList();
            if (tables.size() != 3) throw new IllegalStateException("Assignment fixture requires three JDBC tables");
            var db = new org.springframework.jdbc.core.JdbcTemplate(source);
            for (String table : tables) db.execute(table.replaceFirst("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "));
            var indexes = java.util.regex.Pattern.compile("(?m)^CREATE (?:UNIQUE )?INDEX service_assignment_[^;]+;")
                    .matcher(sql).results().map(java.util.regex.MatchResult::group).toList();
            for (String index : indexes) db.execute(index.replaceFirst("INDEX ", "INDEX IF NOT EXISTS "));
        } catch (Exception failure) {
            throw new IllegalStateException("Baitly assignment fixture initialization failed", failure);
        }
    }

    /** These scenarios qualify durable creation, with assignment explicitly manual. */
    public static void manualAssignment(com.clenzy.service.assignment.AssignmentPolicyStore policies, Long org) {
        var defaults = com.clenzy.service.assignment.AssignmentPolicyStore.Policy.defaults();
        policies.save(org, new com.clenzy.service.assignment.AssignmentPolicyStore.Policy(false, false,
                defaults.timezone(), defaults.contactFromHour(), defaults.contactUntilHour(), defaults.deadlines()));
    }
}
