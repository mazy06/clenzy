package com.clenzy.config;

import javax.sql.DataSource;

/** Installs the JDBC-only Baitly proof journal beside Hibernate's integration schema. */
public final class BaitlyAutomationIntegrationSchema {
    private BaitlyAutomationIntegrationSchema() {}

    public static void install(DataSource source) {
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
}
