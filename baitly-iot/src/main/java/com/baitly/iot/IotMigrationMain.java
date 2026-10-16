package com.baitly.iot;

import liquibase.integration.spring.SpringLiquibase;

/** Separate CI/CD entry point; no HTTP server and no runtime credential reuse. */
public final class IotMigrationMain {
    private IotMigrationMain() {}

    public static void main(String[] args) throws Exception {
        var config = PrivateDatabaseConfiguration.load(args, "migration");
        var migration = new SpringLiquibase();
        migration.setDataSource(PrivateDatabaseConfiguration.dataSource(config));
        migration.setChangeLog("classpath:db/changelog/db.changelog-master.yaml");
        migration.afterPropertiesSet();
    }
}
